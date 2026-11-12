# `vintasend-prisma`

Prisma backend implementation for VintaSend.

This package stores and updates notifications using your app's generated Prisma client. It is designed to stay **strictly typed** without importing Prisma runtime types from inside this package.

## Install

```bash
npm install vintasend-prisma
```

You also need your own Prisma setup in the consuming app (`@prisma/client` + generated client).

## Quick start

```ts
import { PrismaClient } from '@prisma/client';
import type { Notification, User } from '@prisma/client';
import { PrismaNotificationBackendFactory } from 'vintasend-prisma';

const prisma = new PrismaClient();

type NotificationTypeConfig = {
	ContextMap: {
		// add your generators map type here
		welcome: {
			generate: (params: { firstName: string }) => Promise<{ firstName: string }>;
		};
	};
	NotificationIdType: Notification['id'];
	UserIdType: User['id'];
};

const backend = new PrismaNotificationBackendFactory<NotificationTypeConfig>().create(prisma);
```

## Why this is still strict

Even though creation is now simpler, typing is still strict:

- `Config` still comes from your app (`ContextMap`, `NotificationIdType`, `UserIdType`).
- Prisma delegate args/results and transaction runner types are inferred from your generated `PrismaClient` passed to `create(...)`.
- If Prisma delegate signatures change, type errors surface in your code.

If you need explicit types in app code, you can still import `InferNotificationPrismaDelegateTypesFromClient`.

## With attachments

If you want attachment storage/deletion support, pass a VintaSend attachment manager:

```ts
const backend = new PrismaNotificationBackendFactory<NotificationTypeConfig>().create(
	prisma,
	attachmentManager,
);
```

If no attachment manager is provided, attachment-specific operations throw when called.

## Common operations

The backend created by the factory supports methods like:

- `persistNotification`
- `persistOneOffNotification`
- `getPendingNotifications`
- `markAsSent`
- `markAsFailed`
- `markAsRead`
- `filterNotifications`

These methods are intended to be used through your VintaSend service, but can also be called directly when needed.

## Template versions

The backend stores the two fields VintaSend uses for
[template version pinning](https://github.com/vintasoftware/vintasend-ts#template-version-pinning),
so your `Notification` model needs two nullable integer columns:

```prisma
model Notification {
  // ...
  requestedTemplateVersion Int? // which version to render; null means "whatever is current"
  usedTemplateVersion      Int? // which version actually rendered, written at send time
}
```

Both are nullable and stay null with a renderer whose templates are not versioned, which is every
file-based one. Add them and nothing else changes; leave them off and Prisma rejects the write, so
this is the one part of the feature that is not opt-in for this backend.

`requestedTemplateVersion` is settable through create and update. `usedTemplateVersion` is written
only by `storeTemplateVersion`, which the service calls at send time. Both are filterable, by a
single version or a list:

```typescript
await service.filterNotifications({ usedTemplateVersion: [1, 2] }, 0, 20);
```

`hasRequestedTemplateVersion` and `hasSendAfter` filter on whether either column is set
(`IS NOT NULL` / `IS NULL`), negation included, and combine with a version list or a
`sendAfterRange` on the same column.

## Moving notifications safely

The backend implements every optional action `VintaSend` offers for moving notifications, and
reports all four in `getActionCapabilities()` (`repin.expectedVersion`, `requeue.expectedVersion`,
`requeue.templateVersion`, `versions.filter`):

```typescript
const failed = { bodyTemplate: 'welcome', status: 'FAILED' } as const;

// `select: { id, notificationVersion, updatedAt }` and no include: no recipient, context or
// content is read.
for (const { id, version } of await service.filterNotificationVersions(failed, 0, 100)) {
  // One UPDATE: pin, re-queue, and only if the row is unchanged since it was listed.
  await service.requeueNotification(id, { templateVersion: 4, expectedVersion: version });
}
```

* **Every move is one conditional `UPDATE`.** The `WHERE` carries the statuses the move is allowed
  from, so a notification a worker sends in between is never re-pinned or re-queued. A re-pin also
  skips a notification already on the version, writing nothing.
* **`expectedVersion` joins the `WHERE` as `notificationVersion`.** A notification written since
  it was listed no longer has that token, so the `UPDATE` matches nothing and the move is refused
  with `NotificationActionError` reason `CHANGED`. Nothing is written, including when the other
  write lands between the service reading the notification and the `UPDATE`.
* **When an `UPDATE` matches nothing**, the row is read once to say why: not found, `CHANGED`, or
  the wrong status (`INVALID_STATUS` for a re-pin).

## Version tokens

The version token `filterNotificationVersions` lists and `expectedVersion` is checked against is
stored in its own column, and every read returns it as `notificationVersion`:

```prisma
model Notification {
  // ...
  notificationVersion String? // generated by the primary backend, copied by replication
}
```

Every write that changes a notification sets it. Used as the primary backend, this one writes a
new random UUID each time. Used as an additional backend, it is handed the token the primary
wrote, and stores it as it is. That way every backend holds the same token for the same version
of a notification, and a token listed from an additional backend works for a re-queue or re-pin on
the primary once that backend has caught up. Until then the move is refused with `CHANGED`, and
listing again gives the current token.

`cancelNotification`, `storeAdapterAndContextUsed` and `storeTemplateVersion` return no
notification, so they return `{ notificationVersion }` with the token they stored, for `VintaSend`
to pass on to the additional backends.

A row no write has touched since the column was added has it null. Its token is then `updatedAt` as
an ISO string, the token earlier versions of this backend handed out, so tokens listed before the
upgrade keep working. `filterNotificationVersions` and reads return that token, and
`expectedVersion` matches it only while the column is still null and `updatedAt` has not moved. The
row's next write gives it a real token.

A write made outside this backend, such as raw SQL, has to set `notificationVersion` to a new value
itself (any string not used before), or `expectedVersion` does not notice it.

### Migration

Add the column, nullable and with no default:

```sql
ALTER TABLE "Notification" ADD COLUMN "notificationVersion" TEXT;
```

With Prisma Migrate, add the field to your schema and run
`npx prisma migrate dev --name add_notification_version`, which generates the same statement.

Do not backfill it. Each backend keeps its own copy of the table, so a backfill run in each
database would give each backend a different token for the same row, and a token listed from one
would never match another. Left null, a row keeps its `updatedAt` token until its first write
after the upgrade, and that write gives it a token generated by the primary and copied everywhere.

Run the migration before deploying this version: it writes the column on every write, and Prisma
rejects a write to a column the table does not have. Finish the rollout before relying on
`expectedVersion`, too. An instance still on the old version does not set the column, so its
writes leave the token where it was.

### Rollback

Deploy the previous version of `vintasend-prisma` first. It does not read or write the column, so
the column can stay in place, and its tokens are back to `updatedAt`: tokens listed before the
rollback are refused with `CHANGED`, and listing again gives working ones.

Before upgrading again, clear the column, since the old version's writes did not move it and the
tokens left in it may name versions that are gone:

```sql
UPDATE "Notification" SET "notificationVersion" = NULL;
```

To remove it instead, drop it once no instance runs the new version:

```sql
ALTER TABLE "Notification" DROP COLUMN "notificationVersion";
```

## Notes

- This package does **not** assume a concrete Prisma client at build time.
- All strict Prisma compatibility is provided by the consuming app's generated client types.
- Keep your app's Prisma client generated and in sync with your schema to preserve type safety.

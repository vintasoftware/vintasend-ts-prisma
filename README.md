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

// `select: { id, updatedAt }` and no include: no recipient, context or content is read.
for (const { id, version } of await service.filterNotificationVersions(failed, 0, 100)) {
  // One UPDATE: pin, re-queue, and only if the row is unchanged since it was listed.
  await service.requeueNotification(id, { templateVersion: 4, expectedVersion: version });
}
```

* **Every move is one conditional `UPDATE`.** The `WHERE` carries the statuses the move is allowed
  from, so a notification a worker sends in between is never re-pinned or re-queued. A re-pin also
  skips a notification already on the version, writing nothing.
* **`expectedVersion` joins the `WHERE` as `updatedAt`.** The version token is the row's
  `updatedAt` as an ISO string; a notification written since it was listed is refused with
  `NotificationActionError` reason `CHANGED`, and nothing is written. A malformed token is refused
  the same way, before any query.
* **When an `UPDATE` matches nothing**, the row is read once to say why: not found, `CHANGED`, or
  the wrong status (`INVALID_STATUS` for a re-pin).

No schema change or migration is needed, but the token relies on `updatedAt` being
`@updatedAt`, as in `schema.prisma.example`:

```prisma
model Notification {
  // ...
  updatedAt DateTime @updatedAt
}
```

Two limits follow from using a timestamp. `updatedAt` has millisecond precision, so two writes to
the same row within one millisecond leave the token unchanged, and the second goes unnoticed by
`expectedVersion` (the status condition in the `WHERE` still applies). And a write made outside
Prisma, such as raw SQL, does not move it unless your database does; set `updatedAt` yourself there.

## Notes

- This package does **not** assume a concrete Prisma client at build time.
- All strict Prisma compatibility is provided by the consuming app's generated client types.
- Keep your app's Prisma client generated and in sync with your schema to preserve type safety.

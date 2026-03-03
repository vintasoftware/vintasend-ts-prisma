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

## Notes

- This package does **not** assume a concrete Prisma client at build time.
- All strict Prisma compatibility is provided by the consuming app's generated client types.
- Keep your app's Prisma client generated and in sync with your schema to preserve type safety.

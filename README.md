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
import type { Notification, Prisma, User } from '@prisma/client';
import {
	InferNotificationPrismaDelegateTypesFromClient,
	PrismaNotificationBackendFactory,
} from 'vintasend-prisma';

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

type DelegateTypes = InferNotificationPrismaDelegateTypesFromClient<
	PrismaClient,
	Notification['id'],
	User['id']
>;

const backend = new PrismaNotificationBackendFactory<
	NotificationTypeConfig,
	Prisma.TransactionIsolationLevel,
	PrismaClient['$transaction'],
	DelegateTypes
>().create(prisma);
```

## Why these generic parameters?

`PrismaNotificationBackendFactory` receives four generic parameters:

1. `Config`  
	 Your VintaSend notification type config (`ContextMap`, `NotificationIdType`, `UserIdType`).
2. `TransactionIsolationLevel`  
	 Usually `Prisma.TransactionIsolationLevel` from your generated client.
3. `TransactionRunner`  
	 Use `PrismaClient['$transaction']`.
4. `DelegateTypes`  
	 Use `InferNotificationPrismaDelegateTypesFromClient<PrismaClient, NotificationId, UserId>`.

This keeps the backend strict and ensures type errors surface if Prisma delegate signatures change.

## With attachments

If you want attachment storage/deletion support, pass a VintaSend attachment manager:

```ts
const backend = new PrismaNotificationBackendFactory<
	NotificationTypeConfig,
	Prisma.TransactionIsolationLevel,
	PrismaClient['$transaction'],
	DelegateTypes
>().create(prisma, attachmentManager);
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

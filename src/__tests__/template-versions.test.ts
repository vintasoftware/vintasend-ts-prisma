/**
 * The two template-version columns: how they are written, read back and filtered on.
 *
 * `requestedTemplateVersion` travels with ordinary create and update writes; `usedTemplateVersion`
 * is written only by `storeTemplateVersion`, which the service calls at send time. Keeping the
 * second one out of every other write path is the point — a caller must not be able to rewrite
 * which version actually went out.
 */

import type { NotificationFilter } from 'vintasend';
import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';

import { PrismaNotificationBackendFactory } from '../index';
import type {
  NotificationPrismaClientInterface,
  PrismaNotificationBackend,
} from '../prisma-notification-backend';
import { NotificationStatusEnum, NotificationTypeEnum } from '../prisma-notification-backend';

let prisma: Mocked<NotificationPrismaClientInterface<string, string>>;
let backend: PrismaNotificationBackend<typeof prisma, any>;

const storedNotification = {
  id: '1',
  userId: 'user1',
  emailOrPhone: null,
  firstName: null,
  lastName: null,
  notificationType: NotificationTypeEnum.EMAIL,
  title: 'Hi',
  bodyTemplate: 'welcome',
  contextName: 'testContext',
  contextParameters: {},
  sendAfter: null,
  subjectTemplate: null,
  status: NotificationStatusEnum.PENDING_SEND,
  contextUsed: null,
  extraParams: null,
  tenant: null,
  adapterUsed: null,
  sentAt: null,
  readAt: null,
  gitCommitSha: null,
  requestedTemplateVersion: 3,
  usedTemplateVersion: 2,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const createInput = {
  userId: 'user1',
  notificationType: NotificationTypeEnum.EMAIL,
  title: 'Hi',
  bodyTemplate: 'welcome',
  contextName: 'testContext' as const,
  contextParameters: {},
  sendAfter: null,
  subjectTemplate: null,
  extraParams: null,
};

beforeEach(() => {
  prisma = {
    $transaction: vi.fn(<R>(fn: (client: typeof prisma) => Promise<R>) => fn(prisma)) as any,
    notification: {
      findMany: vi.fn().mockResolvedValue([storedNotification]),
      create: vi.fn().mockResolvedValue(storedNotification),
      createManyAndReturn: vi.fn().mockResolvedValue([storedNotification]),
      update: vi.fn().mockResolvedValue(storedNotification),
      findUnique: vi.fn().mockResolvedValue(storedNotification),
    },
    attachmentFile: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    notificationAttachment: {
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as unknown as Mocked<NotificationPrismaClientInterface<string, string>>;

  backend = new PrismaNotificationBackendFactory().create(prisma);
});

describe('reading', () => {
  it('reads both versions back off a stored row', async () => {
    const notification = await backend.getNotification('1', false);

    expect(notification).toMatchObject({
      requestedTemplateVersion: 3,
      usedTemplateVersion: 2,
    });
  });
});

describe('writing', () => {
  it('persists a requested version on create', async () => {
    await backend.persistNotification({ ...createInput, requestedTemplateVersion: 4 } as any);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedTemplateVersion: 4 }),
      }),
    );
  });

  it('writes null when a create names no version', async () => {
    await backend.persistNotification(createInput as any);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedTemplateVersion: null }),
      }),
    );
  });

  it('repoints a notification through an update', async () => {
    await backend.persistNotificationUpdate('1', { requestedTemplateVersion: 5 } as any);

    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedTemplateVersion: 5 }),
      }),
    );
  });

  it('leaves the pin alone on an update that does not mention it', async () => {
    await backend.persistNotificationUpdate('1', { title: 'New title' } as any);

    const data = prisma.notification.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty('requestedTemplateVersion');
  });

  it('never writes usedTemplateVersion through an ordinary update', async () => {
    // The service rejects this before it gets here; the backend not writing it is the second lock.
    await backend.persistNotificationUpdate('1', {
      usedTemplateVersion: 9,
      title: 'New title',
    } as any);

    const data = prisma.notification.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty('usedTemplateVersion');
  });

  it('writes usedTemplateVersion through storeTemplateVersion, and only that', async () => {
    await backend.storeTemplateVersion('1', 7);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { usedTemplateVersion: 7 },
    });
  });

  it('persists a requested version on a one-off create', async () => {
    await backend.persistOneOffNotification({
      emailOrPhone: 'someone@example.com',
      firstName: 'Ana',
      lastName: 'Silva',
      notificationType: NotificationTypeEnum.EMAIL,
      title: 'Hi',
      bodyTemplate: 'welcome',
      contextName: 'testContext',
      contextParameters: {},
      sendAfter: null,
      subjectTemplate: null,
      extraParams: null,
      requestedTemplateVersion: 4,
    } as any);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedTemplateVersion: 4 }),
      }),
    );
  });

  it('repoints a one-off notification through an update', async () => {
    await backend.persistOneOffNotificationUpdate('1', { requestedTemplateVersion: 5 } as any);

    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedTemplateVersion: 5 }),
      }),
    );
  });
});

describe('filtering', () => {
  async function whereFor(filter: NotificationFilter<any>) {
    await backend.filterNotifications(filter, 0, 10);
    const call = prisma.notification.findMany.mock.calls[0]?.[0] as { where: unknown } | undefined;
    return call?.where;
  }

  it('matches a single version', async () => {
    expect(await whereFor({ requestedTemplateVersion: 3 })).toMatchObject({
      requestedTemplateVersion: 3,
    });
  });

  it('matches any of a list', async () => {
    expect(await whereFor({ usedTemplateVersion: [1, 2] })).toMatchObject({
      usedTemplateVersion: { in: [1, 2] },
    });
  });

  it('negates through the same translation', async () => {
    expect(await whereFor({ not: { usedTemplateVersion: 1 } })).toMatchObject({
      NOT: { usedTemplateVersion: 1 },
    });
  });

  it('combines with the other fields', async () => {
    expect(await whereFor({ status: 'SENT', requestedTemplateVersion: 3 })).toMatchObject({
      status: 'SENT',
      requestedTemplateVersion: 3,
    });
  });

  it('reports both fields as filterable', () => {
    const capabilities = backend.getFilterCapabilities();

    expect(capabilities['fields.requestedTemplateVersion']).toBe(true);
    expect(capabilities['fields.usedTemplateVersion']).toBe(true);
    expect(capabilities['negation.requestedTemplateVersion']).toBe(true);
    expect(capabilities['negation.usedTemplateVersion']).toBe(true);
  });
});

describe('the capability report matches the behaviour', () => {
  /** A filter value that makes sense for each field this backend can claim. */
  const SAMPLE: Record<string, unknown> = {
    status: 'SENT',
    notificationType: 'EMAIL',
    adapterUsed: 'nodemailer',
    userId: 'user1',
    bodyTemplate: 'welcome',
    subjectTemplate: 'subject',
    contextName: 'testContext',
    tenant: 't1',
    requestedTemplateVersion: 3,
    usedTemplateVersion: 3,
    sendAfterRange: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
    createdAtRange: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
    sentAtRange: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
    readAtRange: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
  };

  async function whereClauseFor(filter: NotificationFilter<any>) {
    prisma.notification.findMany.mockClear();
    await backend.filterNotifications(filter, 0, 10);
    const call = prisma.notification.findMany.mock.calls[0]?.[0] as { where: unknown } | undefined;
    return call?.where as Record<string, unknown> | undefined;
  }

  it('produces a where clause for every field it declares filterable', async () => {
    // A declared field that translated to nothing would return the whole table while the caller
    // believed it had narrowed — the failure the capability report exists to prevent.
    const capabilities = backend.getFilterCapabilities();
    const broken: string[] = [];

    for (const [key, declared] of Object.entries(capabilities)) {
      if (!declared || !key.startsWith('fields.')) continue;
      const field = key.slice('fields.'.length);
      const sample = SAMPLE[field];
      if (sample === undefined) continue;
      try {
        const where = await whereClauseFor({ [field]: sample } as never);
        const column = field.replace(/Range$/, '');
        if (where === undefined || !(column in where)) {
          broken.push(`${key}: produced ${JSON.stringify(where)}`);
        }
      } catch (error) {
        broken.push(`${key}: threw ${(error as Error).message}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it('produces a NOT clause for every negation it declares', async () => {
    const capabilities = backend.getFilterCapabilities();
    const broken: string[] = [];

    for (const [key, declared] of Object.entries(capabilities)) {
      if (!declared || !key.startsWith('negation.')) continue;
      const field = key.slice('negation.'.length);
      const sample = SAMPLE[field];
      if (sample === undefined) continue;
      try {
        const where = await whereClauseFor({ not: { [field]: sample } } as never);
        if (where === undefined || !('NOT' in where)) {
          broken.push(`${key}: produced ${JSON.stringify(where)}`);
        }
      } catch (error) {
        broken.push(`${key}: threw ${(error as Error).message}`);
      }
    }

    expect(broken).toEqual([]);
  });
});

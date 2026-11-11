/**
 * Moving notifications safely on Prisma: listing them without reading their content, then
 * re-pinning and re-queuing them only while they are at the version that was listed.
 *
 * The other tests here mock each Prisma call. These run against a small in-memory `notification`
 * delegate instead, which applies a `WHERE` the way SQL does (three-valued, so `<> v` never matches
 * NULL) and moves `updatedAt` on every write, as `@updatedAt` does. That is what makes "nothing was
 * written" something a test can check rather than assume.
 */

import {
  type BaseNotificationAdapter,
  NotificationActionError,
  type NotificationFilter,
  VintaSendFactory,
} from 'vintasend';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaNotificationBackendFactory } from '../index';
import type {
  NotificationPrismaClientInterface,
  PrismaNotificationBackend,
} from '../prisma-notification-backend';
import { NotificationStatusEnum, NotificationTypeEnum } from '../prisma-notification-backend';

type Row = Record<string, unknown> & { id: string; updatedAt: Date };
type Where = Record<string, unknown>;
/** SQL's three values: a comparison with NULL is neither true nor false. */
type Truth = boolean | null;

const FUTURE = new Date('2999-01-01T00:00:00.000Z');
const V = 4;

function and(values: Truth[]): Truth {
  if (values.includes(false)) return false;
  return values.includes(null) ? null : true;
}

function or(values: Truth[]): Truth {
  if (values.includes(true)) return true;
  return values.includes(null) ? null : false;
}

function not(value: Truth): Truth {
  return value === null ? null : !value;
}

function same(a: unknown, b: unknown): boolean {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}

function fieldTruth(value: unknown, condition: unknown): Truth {
  if (condition === null) return value === null;
  if (typeof condition !== 'object' || condition instanceof Date) {
    return value === null || value === undefined ? null : same(value, condition);
  }
  const ops = condition as Record<string, unknown>;
  const results: Truth[] = [];
  for (const [op, operand] of Object.entries(ops)) {
    if (op === 'not' && operand === null) {
      results.push(value !== null);
      continue;
    }
    if (value === null || value === undefined) {
      results.push(null);
      continue;
    }
    if (op === 'not') results.push(!same(value, operand));
    else if (op === 'in') results.push((operand as unknown[]).some((item) => same(value, item)));
    else if (op === 'equals') results.push(same(value, operand));
    else if (op === 'gte') results.push((value as Date) >= (operand as Date));
    else if (op === 'lte') results.push((value as Date) <= (operand as Date));
    else if (op === 'gt') results.push((value as Date) > (operand as Date));
    else if (op === 'mode') continue;
    else throw new Error(`The fake does not know the operator ${op}`);
  }
  return and(results);
}

function truth(row: Row, where: Where): Truth {
  const results: Truth[] = [];
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'AND') {
      results.push(and((condition as Where[]).map((sub) => truth(row, sub))));
    } else if (key === 'OR') {
      results.push(or((condition as Where[]).map((sub) => truth(row, sub))));
    } else if (key === 'NOT') {
      const subs = Array.isArray(condition) ? condition : [condition];
      results.push(and(subs.map((sub) => not(truth(row, sub as Where)))));
    } else {
      results.push(fieldTruth(row[key], condition));
    }
  }
  return and(results);
}

/** The `notification` delegate, holding rows in memory. */
class FakeNotifications {
  readonly rows = new Map<string, Row>();
  private clock = Date.parse('2026-01-01T00:00:00.000Z');
  writes = 0;

  private tick(): Date {
    this.clock += 1;
    return new Date(this.clock);
  }

  seed(fields: Record<string, unknown>): string {
    const id = String(this.rows.size + 1).padStart(3, '0');
    this.rows.set(id, {
      id,
      userId: 'user-1',
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
      requestedTemplateVersion: null,
      usedTemplateVersion: null,
      createdAt: new Date(this.clock),
      updatedAt: this.tick(),
      ...fields,
    });
    return id;
  }

  snapshot(id: string): Row {
    return { ...(this.rows.get(id) as Row) };
  }

  update = vi.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
    const row = this.rows.get(where.id as string);
    if (!row || truth(row, where) !== true) {
      throw Object.assign(new Error('No record was found for an update.'), { code: 'P2025' });
    }
    Object.assign(row, data, { updatedAt: this.tick() });
    this.writes += 1;
    return { ...row, attachments: [] };
  });

  findUnique = vi.fn(async ({ where }: { where: Where }) => {
    const row = this.rows.get(where.id as string);
    return row && truth(row, where) === true ? { ...row, attachments: [] } : null;
  });

  findMany = vi.fn(
    async (args: {
      where?: Where;
      select?: Record<string, true>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      take?: number;
    }) => {
      const matched = [...this.rows.values()]
        .filter((row) => truth(row, args.where ?? {}) === true)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const page = matched.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? matched.length));
      return page.map((row) =>
        args.select
          ? Object.fromEntries(Object.keys(args.select).map((key) => [key, row[key]]))
          : { ...row },
      );
    },
  );
}

let notifications: FakeNotifications;
let backend: PrismaNotificationBackend<any, any>;
let adapter: { send: ReturnType<typeof vi.fn> } & Record<string, unknown>;

beforeEach(() => {
  notifications = new FakeNotifications();
  const prisma = {
    $transaction: vi.fn(),
    notification: notifications,
  } as unknown as NotificationPrismaClientInterface<string, string>;
  backend = new PrismaNotificationBackendFactory().create(prisma);
  adapter = {
    notificationType: 'EMAIL',
    key: 'test-adapter',
    enqueueNotifications: false,
    send: vi.fn().mockResolvedValue(undefined),
    injectBackend: vi.fn(),
    injectLogger: vi.fn(),
    getTemplateRenderer: () => ({ getLatestTemplateVersion: async () => V }),
    supportsAttachments: false,
  };
});

function makeService(options: { withoutAdapters?: boolean } = {}) {
  return new VintaSendFactory<any>().create({
    adapters: (options.withoutAdapters ? [] : [adapter]) as unknown as BaseNotificationAdapter<
      any,
      any
    >[],
    backend,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    contextGeneratorsMap: { testContext: { generate: async () => ({}) } },
    options: { raiseErrorOnFailedSend: false },
  });
}

async function expectActionError(promise: Promise<unknown>, reason: string) {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to throw');
    },
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(NotificationActionError);
  expect((error as NotificationActionError).reason).toBe(reason);
  return error as NotificationActionError;
}

/** Pending emails with a send time pinned to another version, and failed ones. */
function movableTo(version: number): NotificationFilter<any> {
  return {
    and: [
      { bodyTemplate: 'welcome' },
      {
        or: [
          {
            and: [
              { status: 'PENDING_SEND', hasSendAfter: true, hasRequestedTemplateVersion: true },
              { not: { requestedTemplateVersion: version } },
            ],
          },
          { status: 'FAILED' },
        ],
      },
    ],
  };
}

describe('filterNotificationVersions', () => {
  it('finds the pending and failed emails to move, and nothing else', async () => {
    const pendingOnOld = notifications.seed({ sendAfter: FUTURE, requestedTemplateVersion: 1 });
    notifications.seed({ sendAfter: FUTURE, requestedTemplateVersion: V }); // already on V
    notifications.seed({ sendAfter: null, requestedTemplateVersion: 1 }); // no send time
    notifications.seed({ sendAfter: FUTURE, requestedTemplateVersion: null }); // unpinned
    const failed = notifications.seed({ status: 'FAILED', requestedTemplateVersion: V });
    notifications.seed({ status: 'FAILED', bodyTemplate: 'reset' }); // another key
    notifications.seed({ status: 'SENT', requestedTemplateVersion: 1 }); // delivered

    const listed = await makeService().filterNotificationVersions(movableTo(V), 0, 50);

    expect(listed).toEqual([
      { id: pendingOnOld, version: notifications.snapshot(pendingOnOld).updatedAt.toISOString() },
      { id: failed, version: notifications.snapshot(failed).updatedAt.toISOString() },
    ]);
  });

  it('selects id and updatedAt only, with no include', async () => {
    notifications.seed({ status: 'FAILED' });

    await backend.filterNotificationVersions({ status: 'FAILED' }, 2, 25);

    expect(notifications.findMany).toHaveBeenCalledWith({
      where: { status: 'FAILED' },
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
      skip: 50,
      take: 25,
    });
  });

  it('pages by id', async () => {
    const ids = [1, 2, 3].map(() => notifications.seed({ status: 'FAILED' }));

    const first = await backend.filterNotificationVersions({ status: 'FAILED' }, 0, 2);
    const second = await backend.filterNotificationVersions({ status: 'FAILED' }, 1, 2);

    expect([...first, ...second].map((entry) => entry.id)).toEqual(ids);
  });
});

describe('presence filters', () => {
  it('tells notifications with a send time from those without, negation included', async () => {
    const scheduled = notifications.seed({ sendAfter: FUTURE });
    const unscheduled = notifications.seed({ sendAfter: null });

    const withTime = await backend.filterNotifications({ hasSendAfter: true }, 0, 10);
    const withoutTime = await backend.filterNotifications({ hasSendAfter: false }, 0, 10);
    const negated = await backend.filterNotifications({ not: { hasSendAfter: true } }, 0, 10);

    expect(withTime.map((n) => n.id)).toEqual([scheduled]);
    expect(withoutTime.map((n) => n.id)).toEqual([unscheduled]);
    expect(negated.map((n) => n.id)).toEqual([unscheduled]);
  });

  it('tells pinned notifications from unpinned ones', async () => {
    const pinned = notifications.seed({ requestedTemplateVersion: 2 });
    const unpinned = notifications.seed({ requestedTemplateVersion: null });

    const yes = await backend.filterNotifications({ hasRequestedTemplateVersion: true }, 0, 10);
    const no = await backend.filterNotifications(
      { not: { hasRequestedTemplateVersion: true } },
      0,
      10,
    );

    expect(yes.map((n) => n.id)).toEqual([pinned]);
    expect(no.map((n) => n.id)).toEqual([unpinned]);
  });

  it('combines with a range on the same column instead of replacing it', async () => {
    const inRange = notifications.seed({ sendAfter: new Date('2030-01-01T00:00:00.000Z') });
    notifications.seed({ sendAfter: FUTURE });
    notifications.seed({ sendAfter: null });

    const found = await backend.filterNotifications(
      { hasSendAfter: true, sendAfterRange: { to: new Date('2031-01-01T00:00:00.000Z') } },
      0,
      10,
    );

    expect(found.map((n) => n.id)).toEqual([inRange]);
  });

  it('reports the new vocabulary and every optional action', async () => {
    const service = makeService();

    expect(await service.getBackendSupportedFilterCapabilities()).toMatchObject({
      'fields.hasSendAfter': true,
      'negation.hasSendAfter': true,
      'fields.hasRequestedTemplateVersion': true,
      'negation.hasRequestedTemplateVersion': true,
    });
    expect(await service.getBackendSupportedActionCapabilities()).toEqual({
      'repin.expectedVersion': true,
      'requeue.expectedVersion': true,
      'requeue.templateVersion': true,
      'versions.filter': true,
    });
  });
});

describe('requeueNotification', () => {
  it('re-pins and re-queues in one conditional UPDATE on the listed version', async () => {
    const id = notifications.seed({ status: 'FAILED', requestedTemplateVersion: 1 });
    const service = makeService({ withoutAdapters: true });
    const [listed] = await service.filterNotificationVersions(movableTo(V), 0, 10);

    const requeued = await service.requeueNotification(id, {
      templateVersion: V,
      expectedVersion: listed?.version,
      send: false,
    });

    expect(notifications.writes).toBe(1);
    expect(notifications.update.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id,
        status: { in: ['FAILED', 'CANCELLED'] },
        updatedAt: new Date(listed?.version as string),
      },
      data: { status: 'PENDING_SEND', sentAt: null, requestedTemplateVersion: V },
    });
    expect(requeued).toMatchObject({ status: 'PENDING_SEND', requestedTemplateVersion: V });
  });

  it('refuses CHANGED for a notification written since it was listed, writing nothing', async () => {
    const id = notifications.seed({ status: 'FAILED', requestedTemplateVersion: 1 });
    const [listed] = await backend.filterNotificationVersions(movableTo(V), 0, 10);
    await backend.persistNotificationUpdate(id, { title: 'Edited' } as never);
    const before = notifications.snapshot(id);
    notifications.writes = 0;

    const error = await expectActionError(
      makeService().requeueNotification(id, {
        templateVersion: V,
        expectedVersion: listed?.version,
      }),
      'CHANGED',
    );

    expect(error.message).toBe(
      `Cannot requeue notification ${id}: it changed since the version that was expected`,
    );
    expect(notifications.writes).toBe(0);
    expect(notifications.snapshot(id)).toEqual(before);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('refuses a token it could not have handed out without trying the UPDATE', async () => {
    const id = notifications.seed({ status: 'FAILED' });

    await expectActionError(
      backend.requeueNotification(id, { expectedVersion: 'not-a-version' }),
      'CHANGED',
    );

    expect(notifications.update).not.toHaveBeenCalled();
  });

  it.each(['PENDING_SEND', 'SENT'])(
    'refuses a %s notification, writing nothing',
    async (status) => {
      const id = notifications.seed({ status, sendAfter: FUTURE });
      const before = notifications.snapshot(id);

      await expectActionError(
        makeService().requeueNotification(id, {
          templateVersion: V,
          expectedVersion: before.updatedAt.toISOString(),
        }),
        'INVALID_STATUS',
      );
      await expect(backend.requeueNotification(id, { templateVersion: V })).rejects.toThrow(
        `in status ${status}`,
      );

      expect(notifications.writes).toBe(0);
      expect(notifications.snapshot(id)).toEqual(before);
    },
  );

  it('refuses a notification a worker sent after the service read it', async () => {
    const id = notifications.seed({ status: 'SENT' });
    const stale = { ...notifications.snapshot(id), status: 'FAILED', attachments: [] };
    notifications.findUnique.mockResolvedValueOnce(stale);

    await expect(makeService().requeueNotification(id, { templateVersion: V })).rejects.toThrow(
      'in status SENT',
    );

    expect(notifications.writes).toBe(0);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('returns the notification as the send left it', async () => {
    const sentId = notifications.seed({ status: 'FAILED' });
    const failingId = notifications.seed({ status: 'FAILED' });
    const service = makeService();

    const sent = await service.requeueNotification(sentId);
    adapter.send.mockRejectedValueOnce(new Error('provider down'));
    const failing = await service.requeueNotification(failingId);

    expect(sent.status).toBe('SENT');
    expect(failing.status).toBe('FAILED');
  });
});

describe('repinNotification', () => {
  it('re-pins in one conditional UPDATE on the listed version', async () => {
    const id = notifications.seed({ sendAfter: FUTURE, requestedTemplateVersion: 1 });
    const version = notifications.snapshot(id).updatedAt.toISOString();

    const repinned = await makeService().repinNotification(id, { expectedVersion: version });

    expect(repinned.requestedTemplateVersion).toBe(V);
    expect(notifications.writes).toBe(1);
    expect(notifications.snapshot(id).requestedTemplateVersion).toBe(V);
  });

  it('pins a notification that was not pinned before, which `<> v` alone would miss', async () => {
    const id = notifications.seed({ sendAfter: FUTURE, requestedTemplateVersion: null });

    await backend.repinNotification(id, V, {});

    expect(notifications.snapshot(id).requestedTemplateVersion).toBe(V);
  });

  it('refuses CHANGED for a stale version, writing nothing', async () => {
    const id = notifications.seed({ sendAfter: FUTURE, requestedTemplateVersion: 1 });
    const listed = notifications.snapshot(id).updatedAt.toISOString();
    await backend.persistNotificationUpdate(id, { title: 'Edited' } as never);
    const before = notifications.snapshot(id);
    notifications.writes = 0;

    await expectActionError(
      makeService().repinNotification(id, { templateVersion: V, expectedVersion: listed }),
      'CHANGED',
    );

    expect(notifications.writes).toBe(0);
    expect(notifications.snapshot(id)).toEqual(before);
  });

  it('refuses CHANGED even when the pin already matches', async () => {
    const id = notifications.seed({ requestedTemplateVersion: V });
    const listed = notifications.snapshot(id).updatedAt.toISOString();
    await backend.persistNotificationUpdate(id, { title: 'Edited' } as never);
    notifications.writes = 0;

    await expectActionError(
      backend.repinNotification(id, V, { expectedVersion: listed }),
      'CHANGED',
    );

    expect(notifications.writes).toBe(0);
  });

  it('writes nothing when the notification is already on that version', async () => {
    const id = notifications.seed({ requestedTemplateVersion: V });
    const version = notifications.snapshot(id).updatedAt.toISOString();

    const repinned = await backend.repinNotification(id, V, { expectedVersion: version });

    expect(repinned.requestedTemplateVersion).toBe(V);
    expect(notifications.writes).toBe(0);
  });

  it('refuses a notification a worker sent after the service read it, writing nothing', async () => {
    const id = notifications.seed({ status: 'SENT', requestedTemplateVersion: 1 });
    const stale = { ...notifications.snapshot(id), status: 'PENDING_SEND', attachments: [] };
    notifications.findUnique.mockResolvedValueOnce(stale);

    const error = await expectActionError(makeService().repinNotification(id), 'INVALID_STATUS');

    expect(error.status).toBe('SENT');
    expect(notifications.writes).toBe(0);
    expect(notifications.snapshot(id).requestedTemplateVersion).toBe(1);
  });

  it('refuses a notification that does not exist', async () => {
    await expectActionError(backend.repinNotification('missing', V, {}), 'NOT_FOUND');
  });

  it('rejects a version that is not a non-negative integer before writing', async () => {
    const id = notifications.seed({});

    await expect(backend.repinNotification(id, -1, {})).rejects.toThrow(RangeError);
    expect(notifications.update).not.toHaveBeenCalled();
  });
});

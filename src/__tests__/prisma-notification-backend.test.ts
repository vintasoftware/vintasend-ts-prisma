import type {
  AnyDatabaseNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
} from 'vintasend/dist/types/notification';
import { PrismaNotificationBackendFactory } from '../index';
import { NotificationStatusEnum, NotificationTypeEnum } from '../prisma-notification-backend';
import type {
  NotificationPrismaClientInterface,
  PrismaNotificationBackend,
} from '../prisma-notification-backend';

type TestContexts = {
  testContext: {
    generate: (params: { param1: string }) => Promise<{ value1: string }>;
  };
};

describe('PrismaNotificationBackend', () => {
  let mockPrismaClient: jest.Mocked<NotificationPrismaClientInterface<string, string>>;
  let backend: PrismaNotificationBackend<
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    typeof mockPrismaClient,
    any
  >;

  beforeEach(() => {
    mockPrismaClient = {
      notification: {
        findMany: jest.fn(),
        create: jest.fn(),
        createManyAndReturn: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      attachmentFile: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      notificationAttachment: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    backend = new PrismaNotificationBackendFactory().create(mockPrismaClient);
  });

  const mockNotification = {
    id: '1',
    userId: 'user1',
    emailOrPhone: null,
    firstName: null,
    lastName: null,
    notificationType: NotificationTypeEnum.EMAIL,
    title: 'Test Title',
    bodyTemplate: 'Test Body',
    contextName: 'testContext',
    contextParameters: { param1: 'value1' },
    sendAfter: null,
    subjectTemplate: 'Test Subject',
    status: NotificationStatusEnum.PENDING_SEND,
    contextUsed: null,
    extraParams: null,
    adapterUsed: null,
    sentAt: null,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getAllPendingNotifications', () => {
    it('should fetch all pending notifications', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getAllPendingNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: NotificationStatusEnum.PENDING_SEND,
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
      });
    });
  });

  describe('persistNotification', () => {
    it('should create a new notification', async () => {
      const input = {
        id: undefined,
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: { key: 'value' },
        sendAfter: null,
      };

      const createMock = mockPrismaClient.notification.create as jest.Mock;
      createMock.mockResolvedValue(mockNotification);

      const result = await backend.persistNotification(input);

      expect(mockPrismaClient.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user: { connect: { id: 'user1' } },
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Test Body',
        }),
        include: {
          attachments: {
            include: {
              attachmentFile: true,
            },
          },
        },
      });
      expect(result).toMatchObject({
        id: '1',
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
      });
    });
  });

  describe('markAsSent', () => {
    it('should mark a notification as sent', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const sentNotification: DatabaseNotification<any> = {
        ...mockNotification,
        status: NotificationStatusEnum.SENT,
        sentAt: new Date(),
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;

      updateMock.mockResolvedValue(sentNotification);

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const result: AnyDatabaseNotification<any> = await backend.markAsSent('1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: '1',
          status: NotificationStatusEnum.PENDING_SEND,
        },
        data: {
          status: NotificationStatusEnum.SENT,
          sentAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(NotificationStatusEnum.SENT);
      expect(result.sentAt).toBeDefined();
    });

    it('should skip pending send status chack if checkIsPending is false', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const sentNotification: DatabaseNotification<any> = {
        ...mockNotification,
        status: NotificationStatusEnum.SENT,
        sentAt: new Date(),
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;

      updateMock.mockResolvedValue(sentNotification);

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const result: AnyDatabaseNotification<any> = await backend.markAsSent('1', false);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        data: {
          status: NotificationStatusEnum.SENT,
          sentAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(NotificationStatusEnum.SENT);
      expect(result.sentAt).toBeDefined();
    });

    it('markAsSent updates and returns a one-off notification (userId null, emailOrPhone set)', async () => {
      const now = new Date();

      const oneOffNotification = {
        id: 'one-off-1',
        userId: null,
        emailOrPhone: 'oneoff@example.com',
        firstName: null,
        lastName: null,
        notificationType: NotificationTypeEnum.EMAIL,
        title: 'One-off title',
        bodyTemplate: 'One-off body',
        contextName: 'testContext',
        contextParameters: { param1: 'value1' },
        sendAfter: null,
        subjectTemplate: null,
        status: NotificationStatusEnum.SENT,
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: now,
        readAt: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: now,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(oneOffNotification);

      // biome-ignore lint/suspicious/noExplicitAny: tests cover widened notification shape
      const result: AnyDatabaseNotification<any> = await backend.markAsSent('one-off-1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'one-off-1',
          status: NotificationStatusEnum.PENDING_SEND,
        },
        data: {
          status: NotificationStatusEnum.SENT,
          sentAt: expect.any(Date),
        },
      });

      expect(result.status).toBe(NotificationStatusEnum.SENT);
      expect(result.sentAt).toBeInstanceOf(Date);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const readNotification = {
        ...mockNotification,
        status: NotificationStatusEnum.READ,
        readAt: new Date(),
      };

      // Mock findUnique to return a regular notification with userId
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(mockNotification);

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(readNotification);

      const result = await backend.markAsRead('1');

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: '1',
          status: NotificationStatusEnum.SENT,
        },
        data: {
          status: 'READ',
          readAt: expect.any(Date),
        },
      });
      expect(result?.status).toBe(NotificationStatusEnum.READ);
      expect(result?.readAt).toBeDefined();
    });

    it('should skip sent status check if checkIsSent is false', async () => {
      const readNotification = {
        ...mockNotification,
        status: NotificationStatusEnum.READ,
        readAt: new Date(),
      };

      // Mock findUnique to return a regular notification with userId
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(mockNotification);

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(readNotification);

      const result = await backend.markAsRead('1', false);

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        data: {
          status: 'READ',
          readAt: expect.any(Date),
        },
      });
      expect(result?.status).toBe(NotificationStatusEnum.READ);
      expect(result?.readAt).toBeDefined();
    });

    it('should throw error when trying to mark one-off notification as read', async () => {
      const oneOffNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: 'test@example.com',
      };

      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(oneOffNotification);

      await expect(backend.markAsRead('1')).rejects.toThrow(
        'Cannot mark one-off notification as read',
      );

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      // Should not call update
      expect(mockPrismaClient.notification.update).not.toHaveBeenCalled();
    });

    it('should throw error when trying to mark a non-existent notification as read', async () => {
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(null);

      await expect(backend.markAsRead('non-existent-id')).rejects.toThrow('Notification not found');

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
      // Should not call update if the notification does not exist
      expect(mockPrismaClient.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('filterInAppUnreadNotifications', () => {
    it('should return unread notifications with pagination', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.filterInAppUnreadNotifications('user1', 0, 10);

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: NotificationStatusEnum.SENT,
          readAt: null,
        },
        skip: 0,
        take: 10,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserEmailFromNotification', () => {
    it('should return user email for notification', async () => {
      const notificationWithUser = {
        ...mockNotification,
        user: {
          email: 'test@example.com',
        },
      };

      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(notificationWithUser);

      const result = await backend.getUserEmailFromNotification('1');

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { user: true },
      });
      expect(result).toBe('test@example.com');
    });
  });

  describe('getPendingNotifications', () => {
    it('should fetch pending notifications with no sendAfter date', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getPendingNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: NotificationStatusEnum.PENDING_SEND,
          sendAfter: null,
        },
        skip: 0,
        take: 100,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        status: NotificationStatusEnum.PENDING_SEND,
      });
    });

    it('should fetch pending notifications with custom pagination', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getPendingNotifications(2, 50);

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: NotificationStatusEnum.PENDING_SEND,
          sendAfter: null,
        },
        skip: 100,
        take: 50,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getAllFutureNotifications', () => {
    it('should fetch future notifications', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getAllFutureNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('markAsFailed', () => {
    it('should mark a notification as failed', async () => {
      const failedNotification = {
        ...mockNotification,
        status: NotificationStatusEnum.FAILED,
        sentAt: new Date(),
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(failedNotification);

      const result = await backend.markAsFailed('1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: '1',
          status: NotificationStatusEnum.PENDING_SEND,
        },
        data: {
          status: NotificationStatusEnum.FAILED,
          sentAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(NotificationStatusEnum.FAILED);
      expect(result.sentAt).toBeDefined();
    });

    it('should skip pending send status chack if checkIsPending is false', async () => {
      const failedNotification = {
        ...mockNotification,
        status: NotificationStatusEnum.FAILED,
        sentAt: new Date(),
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(failedNotification);

      const result = await backend.markAsFailed('1', false);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        data: {
          status: NotificationStatusEnum.FAILED,
          sentAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(NotificationStatusEnum.FAILED);
      expect(result.sentAt).toBeDefined();
    });

    it('markAsFailed updates and returns a one-off notification (userId null, emailOrPhone set)', async () => {
      const now = new Date();

      const oneOffNotification = {
        id: 'one-off-2',
        userId: null,
        emailOrPhone: 'oneoff-failed@example.com',
        firstName: null,
        lastName: null,
        notificationType: NotificationTypeEnum.EMAIL,
        title: 'One-off failed title',
        bodyTemplate: 'One-off failed body',
        contextName: 'testContext',
        contextParameters: { param1: 'value1' },
        sendAfter: null,
        subjectTemplate: null,
        status: NotificationStatusEnum.FAILED,
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: now,
        readAt: null,
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        updatedAt: now,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(oneOffNotification);

      // biome-ignore lint/suspicious/noExplicitAny: tests cover widened notification shape
      const result: AnyDatabaseNotification<any> = await backend.markAsFailed('one-off-2');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'one-off-2',
          status: NotificationStatusEnum.PENDING_SEND,
        },
        data: {
          status: NotificationStatusEnum.FAILED,
          sentAt: expect.any(Date),
        },
      });

      expect(result.status).toBe(NotificationStatusEnum.FAILED);
      expect(result.sentAt).toBeInstanceOf(Date);
    });
  });

  describe('cancelNotification', () => {
    it('should cancel a notification', async () => {
      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue({
        ...mockNotification,
        status: NotificationStatusEnum.CANCELLED,
      });

      await backend.cancelNotification('1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: NotificationStatusEnum.CANCELLED,
        },
      });
    });
  });

  describe('getNotification', () => {
    it('should get a notification by id', async () => {
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(mockNotification);

      const result = await backend.getNotification('1', false);

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          attachments: {
            include: {
              attachmentFile: true,
            },
          },
        },
      });
      expect(result).toMatchObject({
        id: '1',
        userId: 'user1',
      });
    });

    it('should return null when notification not found', async () => {
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(null);

      const result = await backend.getNotification('1', false);

      expect(result).toBeNull();
    });
  });

  describe('storeContextUsed', () => {
    it('should store the context used for a notification', async () => {
      const context = { value1: 'test' };
      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue({ ...mockNotification, contextUsed: context });

      await backend.storeContextUsed('1', context);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          contextUsed: context,
        },
      });
    });

    it('should handle rejected update', async () => {
      const context = { value1: 'test' };
      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockRejectedValue(new Error('Update failed'));

      await expect(backend.storeContextUsed('1', context)).rejects.toThrow('Update failed');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          contextUsed: context,
        },
      });
    });
  });

  describe('getAllFutureNotificationsFromUser', () => {
    it('should fetch future notifications for a specific user', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getAllFutureNotificationsFromUser('user1');

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user1');
    });

    it('should return empty array when no notifications found', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([]);

      const result = await backend.getAllFutureNotificationsFromUser('user1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getFutureNotificationsFromUser', () => {
    it('should fetch future notifications for a specific user', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getFutureNotificationsFromUser('user1', 0, 10);

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
        skip: 0,
        take: 10,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('persistNotificationUpdate', () => {
    it('should update an existing notification', async () => {
      const updateData = {
        title: 'Updated Title',
        bodyTemplate: 'Updated Body',
        contextParameters: { param1: 'updated' },
      };

      const updatedNotification = {
        ...mockNotification,
        ...updateData,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          title: 'Updated Title',
          bodyTemplate: 'Updated Body',
        }),
      });
      expect(result).toMatchObject(updateData);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        title: 'Updated Title',
      };

      const updatedNotification = {
        ...mockNotification,
        ...updateData,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          title: 'Updated Title',
        }),
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('filterAllInAppUnreadNotifications', () => {
    it('should return all unread notifications for a user', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.filterAllInAppUnreadNotifications('user1');

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: NotificationStatusEnum.SENT,
          readAt: null,
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no unread notifications exist', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([]);

      const result = await backend.filterAllInAppUnreadNotifications('user1');

      expect(result).toHaveLength(0);
    });
  });

  describe('convertJsonValueToRecord', () => {
    it('should throw error for non-object JSON values', async () => {
      const invalidInput = {
        ...mockNotification,
        extraParams: ['invalid array'] as unknown as Record<string, string>,
      };

      const createMock = mockPrismaClient.notification.create as jest.Mock;
      createMock.mockResolvedValue(invalidInput);

      // @ts-ignore - testing invalid input
      await expect(backend.persistNotification(invalidInput)).rejects.toThrow('Invalid JSON value');
    });
  });

  describe('serializeNotification', () => {
    it('should correctly serialize notification with all fields', () => {
      const fullNotification = {
        ...mockNotification,
        emailOrPhone: null,
        firstName: null,
        lastName: null,
        contextUsed: { generatedValue: 'test' },
        extraParams: { param1: 'value1', param2: true, param3: 42 },
      };

      const result = backend.serializeNotification(fullNotification);

      expect(result).toEqual({
        id: fullNotification.id,
        userId: fullNotification.userId,
        notificationType: fullNotification.notificationType,
        title: fullNotification.title,
        bodyTemplate: fullNotification.bodyTemplate,
        contextName: fullNotification.contextName as keyof TestContexts,
        contextParameters: fullNotification.contextParameters,
        sendAfter: fullNotification.sendAfter,
        subjectTemplate: fullNotification.subjectTemplate,
        status: fullNotification.status,
        contextUsed: fullNotification.contextUsed,
        extraParams: fullNotification.extraParams,
        adapterUsed: fullNotification.adapterUsed,
        sentAt: fullNotification.sentAt,
        readAt: fullNotification.readAt,
        createdAt: fullNotification.createdAt,
        updatedAt: fullNotification.updatedAt,
      });
    });

    it('serializes one-off notifications with emailOrPhone into DatabaseOneOffNotification', () => {
      const oneOffNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: 'oneoff@example.com',
        firstName: null,
        lastName: null,
      };

      const serialized = backend.serializeNotification(oneOffNotification);

      expect(serialized).not.toHaveProperty('userId');
      expect(serialized).toHaveProperty('emailOrPhone', 'oneoff@example.com');
      if ('emailOrPhone' in serialized) {
        expect(serialized.firstName).toBe('');
        expect(serialized.lastName).toBe('');
      }
    });

    it('serializes one-off notifications with firstName and lastName', () => {
      const oneOffNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: 'oneoff@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const serialized = backend.serializeNotification(oneOffNotification);

      expect(serialized).not.toHaveProperty('userId');
      expect(serialized).toHaveProperty('emailOrPhone', 'oneoff@example.com');
      if ('emailOrPhone' in serialized) {
        expect(serialized.firstName).toBe('John');
        expect(serialized.lastName).toBe('Doe');
      }
    });

    it('throws error for invalid notification with no userId and no emailOrPhone', () => {
      const invalidNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: null,
      };

      expect(() => backend.serializeNotification(invalidNotification)).toThrow(
        'Invalid notification: missing both userId and emailOrPhone',
      );
    });

    it('correctly handles empty string emailOrPhone as one-off notification', () => {
      const oneOffNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: '',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const serialized = backend.serializeNotification(oneOffNotification);

      // Empty string should still be treated as one-off notification
      expect(serialized).not.toHaveProperty('userId');
      expect(serialized).toHaveProperty('emailOrPhone', '');
      if ('emailOrPhone' in serialized) {
        expect(serialized.firstName).toBe('Jane');
        expect(serialized.lastName).toBe('Smith');
      }
    });

    it('should handle null values in optional fields', () => {
      const nullFieldsNotification = {
        ...mockNotification,
        emailOrPhone: null,
        firstName: null,
        lastName: null,
        contextUsed: null,
        extraParams: null,
      };

      const result = backend.serializeNotification(nullFieldsNotification);

      expect(result.contextUsed).toBeNull();
      expect(result.extraParams).toBeNull();
    });

    it('should handle empty contextParameters', () => {
      const notificationWithEmptyContext = {
        ...mockNotification,
        emailOrPhone: null,
        firstName: null,
        lastName: null,
        contextParameters: {},
      };

      const result = backend.serializeNotification(notificationWithEmptyContext);

      expect(result.contextParameters).toEqual({});
    });

    it('should properly cast contextParameters to the correct type', () => {
      const notificationWithComplexContext = {
        ...mockNotification,
        emailOrPhone: null,
        firstName: null,
        lastName: null,
        contextParameters: {
          param1: 'test value',
          param2: 123,
          param3: true,
        },
      };

      const result = backend.serializeNotification(notificationWithComplexContext);

      expect(result.contextParameters).toEqual({
        param1: 'test value',
        param2: 123,
        param3: true,
      });
      // Verify the type casting worked by checking if it matches TestContexts type
      expect(result.contextName).toBe('testContext');
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      expect(typeof (result.contextParameters as any).param1).toBe('string');
    });
  });

  describe('error handling', () => {
    it('should handle database errors in getAllPendingNotifications', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockRejectedValue(new Error('Database error'));

      await expect(backend.getAllPendingNotifications()).rejects.toThrow('Database error');
    });

    it('should handle invalid JSON values in persistNotification', async () => {
      const invalidInput = {
        ...mockNotification,
        extraParams: [] as unknown as Record<string, string>, // Invalid extra params
      };

      const createMock = mockPrismaClient.notification.create as jest.Mock;
      createMock.mockResolvedValue(invalidInput);

      // @ts-ignore - testing invalid input
      await expect(backend.persistNotification(invalidInput)).rejects.toThrow('Invalid JSON value');
    });

    it('should handle missing user email in getUserEmailFromNotification', async () => {
      const notificationWithoutUser = { ...mockNotification, user: undefined };
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(notificationWithoutUser);

      const result = await backend.getUserEmailFromNotification('1');

      expect(result).toBeUndefined();
    });
  });

  describe('getFutureNotifications', () => {
    it('should fetch future notifications with sendAfter date before now', async () => {
      const futureNotification = {
        ...mockNotification,
        sendAfter: new Date(Date.now() - 1000), // 1 second ago
        status: NotificationStatusEnum.PENDING_SEND,
      };

      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([futureNotification]);

      const result = await backend.getFutureNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
        skip: 0,
        take: 100,
      });
      expect(result).toHaveLength(1);
      expect(result[0].sendAfter).toBeDefined();
      expect(result[0].sendAfter instanceof Date).toBeTruthy();
    });

    it('should fetch future notifications with custom pagination', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getFutureNotifications(3, 25);

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
        skip: 75,
        take: 25,
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no future notifications exist', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([]);

      const result = await backend.getFutureNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
        skip: 0,
        take: 100,
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('deserializeNotificationForUpdate', () => {
    it('should not include contextParameters when undefined', async () => {
      const updateData = {
        title: 'Updated Title',
        contextParameters: undefined,
      };

      const updatedNotification = {
        ...mockNotification,
        title: 'Updated Title',
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.not.objectContaining({
          contextParameters: expect.anything(),
        }),
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should handle empty contextParameters', async () => {
      const updateData = {
        title: 'Updated Title',
        contextParameters: {
          param1: 'valuetest',
        },
      };

      const updatedNotification = {
        ...mockNotification,
        ...updateData,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          contextParameters: {
            param1: 'valuetest',
          },
        }),
      });
      expect(result.contextParameters).toEqual({
        param1: 'valuetest',
      });
    });
  });

  describe('bulkPersistNotifications', () => {
    it('should throw error for notifications missing both userId and emailOrPhone', async () => {
      const notifications = [
        {
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Body invalid',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'invalid' },
          title: 'Invalid notification',
          subjectTemplate: 'Invalid subject',
          extraParams: null,
          sendAfter: null,
          // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
        } as any,
      ];

      // Should throw validation error
      await expect(backend.bulkPersistNotifications(notifications)).rejects.toThrow(
        'Invalid notification: missing both userId and emailOrPhone',
      );
    });

    it('should create multiple regular notifications', async () => {
      const notifications = [
        {
          userId: 'user1',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Body 1',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value1' },
          title: 'Title 1',
          subjectTemplate: 'Subject 1',
          extraParams: null,
          sendAfter: null,
        },
        {
          userId: 'user2',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Body 2',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value2' },
          title: 'Title 2',
          subjectTemplate: 'Subject 2',
          extraParams: null,
          sendAfter: null,
        },
      ];

      const createManyAndReturnMock = mockPrismaClient.notification.createManyAndReturn as jest.Mock;
      createManyAndReturnMock.mockResolvedValue([{ id: 'id1' }, { id: 'id2' }]);

      const result = await backend.bulkPersistNotifications(notifications);

      expect(mockPrismaClient.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            user: { connect: { id: 'user1' } },
            bodyTemplate: 'Body 1',
          }),
          expect.objectContaining({
            user: { connect: { id: 'user2' } },
            bodyTemplate: 'Body 2',
          }),
        ]),
      });
      expect(result).toEqual(['id1', 'id2']);
    });

    it('should create multiple one-off notifications', async () => {
      const notifications = [
        {
          emailOrPhone: 'oneoff1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'One-off Body 1',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value1' },
          title: 'One-off Title 1',
          subjectTemplate: 'One-off Subject 1',
          extraParams: null,
          sendAfter: null,
        },
        {
          emailOrPhone: 'oneoff2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'One-off Body 2',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value2' },
          title: 'One-off Title 2',
          subjectTemplate: 'One-off Subject 2',
          extraParams: null,
          sendAfter: null,
        },
      ];

      const createManyAndReturnMock = mockPrismaClient.notification.createManyAndReturn as jest.Mock;
      createManyAndReturnMock.mockResolvedValue([{ id: 'id3' }, { id: 'id4' }]);

      const result = await backend.bulkPersistNotifications(notifications);

      expect(mockPrismaClient.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            emailOrPhone: 'oneoff1@example.com',
            firstName: 'John',
            lastName: 'Doe',
            bodyTemplate: 'One-off Body 1',
          }),
          expect.objectContaining({
            emailOrPhone: 'oneoff2@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            bodyTemplate: 'One-off Body 2',
          }),
        ]),
      });
      expect(result).toEqual(['id3', 'id4']);
    });

    it('should prefer userId when both userId and emailOrPhone are provided', async () => {
      const notifications = [
        {
          userId: 'user-with-both',
          emailOrPhone: 'both@example.com',
          firstName: 'Both',
          lastName: 'Fields',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Body with both',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value1' },
          title: 'Title with both',
          subjectTemplate: 'Subject with both',
          extraParams: null,
          sendAfter: null,
        },
      ];

      const createManyAndReturnMock = mockPrismaClient.notification.createManyAndReturn as jest.Mock;
      createManyAndReturnMock.mockResolvedValue([{ id: 'id-both' }]);

      const result = await backend.bulkPersistNotifications(notifications);

      // userId should take precedence, creating a regular notification
      expect(mockPrismaClient.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            user: { connect: { id: 'user-with-both' } },
            bodyTemplate: 'Body with both',
          }),
        ]),
      });

      // Should not include one-off fields when userId is present
      const callData = (mockPrismaClient.notification.createManyAndReturn as jest.Mock).mock.calls[0][0]
        .data[0];
      expect(callData).not.toHaveProperty('emailOrPhone');
      expect(callData).not.toHaveProperty('firstName');
      expect(callData).not.toHaveProperty('lastName');
      expect(callData).not.toHaveProperty('userId', null);

      expect(result).toEqual(['id-both']);
    });

    it('should create mix of regular and one-off notifications', async () => {
      const notifications = [
        {
          userId: 'user1',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Regular Body',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value1' },
          title: 'Regular Title',
          subjectTemplate: 'Regular Subject',
          extraParams: null,
          sendAfter: null,
        },
        {
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'One-off Body',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value2' },
          title: 'One-off Title',
          subjectTemplate: 'One-off Subject',
          extraParams: null,
          sendAfter: null,
        },
      ];

      const createManyAndReturnMock = mockPrismaClient.notification.createManyAndReturn as jest.Mock;
      createManyAndReturnMock.mockResolvedValue([{ id: 'id5' }, { id: 'id6' }]);

      const result = await backend.bulkPersistNotifications(notifications);

      expect(mockPrismaClient.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            user: { connect: { id: 'user1' } },
            bodyTemplate: 'Regular Body',
          }),
          expect.objectContaining({
            emailOrPhone: 'oneoff@example.com',
            firstName: 'John',
            lastName: 'Doe',
            bodyTemplate: 'One-off Body',
          }),
        ]),
      });
      expect(result).toEqual(['id5', 'id6']);
    });
  });

  describe('One-off notification methods', () => {
    describe('persistOneOffNotification', () => {
      it('should create a new one-off notification', async () => {
        const input = {
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Test Body',
          contextName: 'testContext' as keyof TestContexts,
          contextParameters: { param1: 'value1' },
          title: 'Test Title',
          subjectTemplate: 'Test Subject',
          extraParams: { key: 'value' },
          sendAfter: null,
        };

        const oneOffNotification = {
          id: '1',
          userId: null,
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          title: 'Test Title',
          bodyTemplate: 'Test Body',
          contextName: 'testContext',
          contextParameters: { param1: 'value1' },
          sendAfter: null,
          subjectTemplate: 'Test Subject',
          status: NotificationStatusEnum.PENDING_SEND,
          contextUsed: null,
          extraParams: { key: 'value' },
          adapterUsed: null,
          sentAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const createMock = mockPrismaClient.notification.create as jest.Mock;
        createMock.mockResolvedValue(oneOffNotification);

        const result = await backend.persistOneOffNotification(input);

        expect(mockPrismaClient.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: null,
            emailOrPhone: 'oneoff@example.com',
            firstName: 'John',
            lastName: 'Doe',
            notificationType: NotificationTypeEnum.EMAIL,
            bodyTemplate: 'Test Body',
            status: NotificationStatusEnum.PENDING_SEND,
          }),
          include: {
            attachments: {
              include: {
                attachmentFile: true,
              },
            },
          },
        });
        expect(result).toMatchObject({
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
        });
        expect(result).not.toHaveProperty('userId');
      });
    });

    describe('persistOneOffNotificationUpdate', () => {
      it('should update a one-off notification', async () => {
        const updateData = {
          emailOrPhone: 'updated@example.com',
          firstName: 'Jane',
          title: 'Updated Title',
        };

        const updatedNotification = {
          id: '1',
          userId: null,
          emailOrPhone: 'updated@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          title: 'Updated Title',
          bodyTemplate: 'Test Body',
          contextName: 'testContext',
          contextParameters: { param1: 'value1' },
          sendAfter: null,
          subjectTemplate: 'Test Subject',
          status: NotificationStatusEnum.PENDING_SEND,
          contextUsed: null,
          extraParams: null,
          adapterUsed: null,
          sentAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const updateMock = mockPrismaClient.notification.update as jest.Mock;
        updateMock.mockResolvedValue(updatedNotification);

        const result = await backend.persistOneOffNotificationUpdate('1', updateData);

        expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
          where: { id: '1' },
          data: expect.objectContaining({
            emailOrPhone: 'updated@example.com',
            firstName: 'Jane',
            title: 'Updated Title',
          }),
        });
        expect(result.emailOrPhone).toBe('updated@example.com');
        expect(result.firstName).toBe('Jane');
        expect(result.title).toBe('Updated Title');
      });

      it('should allow clearing fields with empty string or null', async () => {
        const updateData = {
          title: '',
          subjectTemplate: null,
        };

        const updatedNotification = {
          id: '1',
          userId: null,
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          title: '',
          bodyTemplate: 'Test Body',
          contextName: 'testContext',
          contextParameters: { param1: 'value1' },
          sendAfter: null,
          subjectTemplate: null,
          status: NotificationStatusEnum.PENDING_SEND,
          contextUsed: null,
          extraParams: null,
          adapterUsed: null,
          sentAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const updateMock = mockPrismaClient.notification.update as jest.Mock;
        updateMock.mockResolvedValue(updatedNotification);

        const result = await backend.persistOneOffNotificationUpdate('1', updateData);

        expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
          where: { id: '1' },
          data: {
            title: '',
            subjectTemplate: null,
          },
        });
        expect(result.title).toBe('');
        expect(result.subjectTemplate).toBeNull();
      });
    });

    describe('getOneOffNotification', () => {
      it('should get a one-off notification by id', async () => {
        const oneOffNotification = {
          id: '1',
          userId: null,
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          title: 'Test Title',
          bodyTemplate: 'Test Body',
          contextName: 'testContext',
          contextParameters: { param1: 'value1' },
          sendAfter: null,
          subjectTemplate: 'Test Subject',
          status: NotificationStatusEnum.PENDING_SEND,
          contextUsed: null,
          extraParams: null,
          adapterUsed: null,
          sentAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
        findUniqueMock.mockResolvedValue(oneOffNotification);

        const result = await backend.getOneOffNotification('1', false);

        expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
          where: { id: '1' },
        });
        expect(result).toMatchObject({
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
        });
        expect(result).not.toHaveProperty('userId');
      });

      it('should return null for regular notification (has userId)', async () => {
        const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
        findUniqueMock.mockResolvedValue(mockNotification);

        const result = await backend.getOneOffNotification('1', false);

        expect(result).toBeNull();
      });

      it('should return null when notification not found', async () => {
        const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
        findUniqueMock.mockResolvedValue(null);

        const result = await backend.getOneOffNotification('1', false);

        expect(result).toBeNull();
      });
    });

    describe('getAllOneOffNotifications', () => {
      it('should fetch all one-off notifications', async () => {
        const oneOffNotification = {
          id: '1',
          userId: null,
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          title: 'Test Title',
          bodyTemplate: 'Test Body',
          contextName: 'testContext',
          contextParameters: { param1: 'value1' },
          sendAfter: null,
          subjectTemplate: 'Test Subject',
          status: NotificationStatusEnum.PENDING_SEND,
          contextUsed: null,
          extraParams: null,
          adapterUsed: null,
          sentAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
        findManyMock.mockResolvedValue([oneOffNotification]);

        const result = await backend.getAllOneOffNotifications();

        expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
          where: {
            userId: null,
            emailOrPhone: { not: null },
          },
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          emailOrPhone: 'oneoff@example.com',
        });
      });
    });

    describe('getOneOffNotifications', () => {
      it('should fetch one-off notifications with pagination', async () => {
        const oneOffNotification = {
          id: '1',
          userId: null,
          emailOrPhone: 'oneoff@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: NotificationTypeEnum.EMAIL,
          title: 'Test Title',
          bodyTemplate: 'Test Body',
          contextName: 'testContext',
          contextParameters: { param1: 'value1' },
          sendAfter: null,
          subjectTemplate: 'Test Subject',
          status: NotificationStatusEnum.PENDING_SEND,
          contextUsed: null,
          extraParams: null,
          adapterUsed: null,
          sentAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
        findManyMock.mockResolvedValue([oneOffNotification]);

        const result = await backend.getOneOffNotifications(0, 10);

        expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
          where: {
            userId: null,
            emailOrPhone: { not: null },
          },
          skip: 0,
          take: 10,
        });
        expect(result).toHaveLength(1);
      });
    });
  });
});

import type {
  AttachmentFileRecord,
  NotificationAttachment,
} from 'vintasend/dist/types/attachment';
import type { BaseAttachmentManager } from 'vintasend/dist/services/attachment-manager/base-attachment-manager';
import { PrismaNotificationBackendFactory } from '../index';
import { NotificationStatusEnum, NotificationTypeEnum } from '../prisma-notification-backend';
import type {
  NotificationPrismaClientInterface,
  PrismaNotificationBackend,
  PrismaAttachmentFileModel,
  PrismaNotificationAttachmentModel,
} from '../prisma-notification-backend';
import { vi, type Mock, type Mocked } from 'vitest';

type TestContexts = {
  testContext: {
    generate: (params: { param1: string }) => Promise<{ value1: string }>;
  };
};

describe('PrismaNotificationBackend - Attachments', () => {
  let mockPrismaClient: Mocked<
    NotificationPrismaClientInterface<string, string>
  >;
  let mockAttachmentManager: Mocked<BaseAttachmentManager>;
  let backend: PrismaNotificationBackend<
    // biome-ignore lint/suspicious/noExplicitAny: any just for testing
    typeof mockPrismaClient,
    any
  >;

  const mockAttachmentFile: PrismaAttachmentFileModel = {
    id: 'file-123',
    filename: 'test.pdf',
    contentType: 'application/pdf',
    size: 1024,
    checksum: 'abc123',
    storageIdentifiers: { id: 'file-123', key: 's3://bucket/test.pdf' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNotificationAttachment: PrismaNotificationAttachmentModel = {
    id: 'att-1',
    notificationId: 1,
    fileId: 'file-123',
    description: 'Test attachment',
    createdAt: new Date(),
    updatedAt: new Date(),
    attachmentFile: mockAttachmentFile,
  };

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
    gitCommitSha: null,
    sentAt: null,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [mockNotificationAttachment],
  };

  beforeEach(() => {
    mockPrismaClient = {
      $transaction: vi.fn(<R>(fn: (prisma: typeof mockPrismaClient) => Promise<R>) =>
        fn(mockPrismaClient),
      ) as any,
      notification: {
        findMany: vi.fn(),
        create: vi.fn(),
        createManyAndReturn: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      attachmentFile: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
      notificationAttachment: {
        findMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };

    mockAttachmentManager = {
      reconstructAttachmentFile: vi.fn(),
      uploadFile: vi.fn(),
      deleteFileByIdentifiers: vi.fn(),
      detectContentType: vi.fn(),
      calculateChecksum: vi.fn(),
      fileToBuffer: vi.fn(),
    } as unknown as Mocked<BaseAttachmentManager>;

    backend = new PrismaNotificationBackendFactory().create(
      mockPrismaClient,
      mockAttachmentManager,
    );
  });

  describe('getAttachmentFile', () => {
    it('should retrieve an attachment file by ID', async () => {
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(
        mockAttachmentFile,
      );

      const result = await backend.getAttachmentFile('file-123');

      expect(mockPrismaClient.attachmentFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-123' },
      });
      expect(result).toMatchObject({
        id: 'file-123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        checksum: 'abc123',
      });
    });

    it('should return null if file not found', async () => {
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(null);

      const result = await backend.getAttachmentFile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAttachmentFileByChecksum', () => {
    it('should retrieve an attachment file by checksum', async () => {
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(
        mockAttachmentFile,
      );

      const result = await backend.findAttachmentFileByChecksum('abc123');

      expect(mockPrismaClient.attachmentFile.findUnique).toHaveBeenCalledWith({
        where: { checksum: 'abc123' },
      });
      expect(result).toMatchObject({
        id: 'file-123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        checksum: 'abc123',
      });
    });

    it('should return null if file with checksum is not found', async () => {
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(null);

      const result = await backend.findAttachmentFileByChecksum('missing-checksum');

      expect(mockPrismaClient.attachmentFile.findUnique).toHaveBeenCalledWith({
        where: { checksum: 'missing-checksum' },
      });
      expect(result).toBeNull();
    });
  });

  describe('deleteAttachmentFile', () => {
    it('should delete an attachment file and its storage', async () => {
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(
        mockAttachmentFile,
      );
      (mockPrismaClient.attachmentFile.delete as Mock).mockResolvedValue(
        mockAttachmentFile,
      );

      await backend.deleteAttachmentFile('file-123');

      expect(mockPrismaClient.attachmentFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-123' },
      });
      expect(mockAttachmentManager.deleteFileByIdentifiers).toHaveBeenCalledWith({
        id: 'file-123',
        key: 's3://bucket/test.pdf',
      });
      expect(mockPrismaClient.attachmentFile.delete).toHaveBeenCalledWith({
        where: { id: 'file-123' },
      });
    });

    it('should return early if file not found', async () => {
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(null);

      await backend.deleteAttachmentFile('nonexistent');

      expect(mockAttachmentManager.deleteFileByIdentifiers).not.toHaveBeenCalled();
      expect(mockPrismaClient.attachmentFile.delete).not.toHaveBeenCalled();
    });
  });

  describe('getOrphanedAttachmentFiles', () => {
    it('should retrieve attachment files not referenced by any notifications', async () => {
      (mockPrismaClient.attachmentFile.findMany as Mock).mockResolvedValue([
        mockAttachmentFile,
      ]);

      const result = await backend.getOrphanedAttachmentFiles();

      expect(mockPrismaClient.attachmentFile.findMany).toHaveBeenCalledWith({
        where: {
          notificationAttachments: { none: {} },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('file-123');
    });
  });

  describe('getAttachments', () => {
    it('should retrieve all attachments for a notification', async () => {
      const mockAttachmentFileInterface = {
        read: vi.fn().mockResolvedValue(Buffer.from('test')),
        stream: vi.fn().mockResolvedValue(new ReadableStream()),
        url: vi.fn().mockResolvedValue('https://example.com/file'),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      (mockPrismaClient.notificationAttachment.findMany as Mock).mockResolvedValue([
        mockNotificationAttachment,
      ]);
      (mockAttachmentManager.reconstructAttachmentFile as Mock).mockReturnValue(
        mockAttachmentFileInterface,
      );

      const result = await backend.getAttachments('1');

      expect(mockPrismaClient.notificationAttachment.findMany).toHaveBeenCalledWith({
        where: { notificationId: '1' },
        include: { attachmentFile: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'att-1',
        fileId: 'file-123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
      });
      expect(result[0].file).toBe(mockAttachmentFileInterface);
    });

    it('should return an empty array when a notification has no attachments', async () => {
      (mockPrismaClient.notificationAttachment.findMany as Mock).mockResolvedValue([]);

      const result = await backend.getAttachments('1');

      expect(mockPrismaClient.notificationAttachment.findMany).toHaveBeenCalledWith({
        where: { notificationId: '1' },
        include: { attachmentFile: true },
      });
      expect(result).toEqual([]);
      expect(mockAttachmentManager.reconstructAttachmentFile).not.toHaveBeenCalled();
    });

    it('should throw error if AttachmentManager not provided', async () => {
      const backendWithoutManager = new PrismaNotificationBackendFactory().create(
        mockPrismaClient,
      );

      (mockPrismaClient.notificationAttachment.findMany as Mock).mockResolvedValue([
        mockNotificationAttachment,
      ]);

      await expect(backendWithoutManager.getAttachments('1')).rejects.toThrow(
        'AttachmentManager is required',
      );
    });
  });

  describe('deleteNotificationAttachment', () => {
    beforeEach(() => {
      // Add deleteMany mock to the client
      (mockPrismaClient.notificationAttachment as any).deleteMany = vi.fn();
    });

    it('should delete a notification attachment using deleteMany', async () => {
      (mockPrismaClient.notificationAttachment as any).deleteMany.mockResolvedValue({
        count: 1,
      });

      await backend.deleteNotificationAttachment('1', 'att-1');

      expect(
        (mockPrismaClient.notificationAttachment as any).deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 'att-1',
          notificationId: '1',
        },
      });
    });

    it('should throw error if attachment does not belong to notification', async () => {
      (mockPrismaClient.notificationAttachment as any).deleteMany.mockResolvedValue({
        count: 0,
      });

      await expect(backend.deleteNotificationAttachment('1', 'att-999')).rejects.toThrow(
        'Attachment att-999 not found for notification 1',
      );
    });
  });

  describe('persistNotification with attachments', () => {
    it('should deduplicate inline file attachments by checksum when file already exists', async () => {
      const fixedChecksum = 'fixed-checksum';

      const attachmentInput: NotificationAttachment = {
        file: Buffer.from('test content'),
        filename: 'test.pdf',
        contentType: 'application/pdf',
      };

      const input = {
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        attachments: [attachmentInput],
      };

      // Existing file that should be reused
      const existingAttachmentFile: AttachmentFileRecord = {
        id: 'file-existing-1',
        filename: 'original.pdf',
        contentType: 'application/pdf',
        size: 1024,
        checksum: fixedChecksum,
        storageIdentifiers: { id: 'file-existing-1', key: 's3://bucket/original.pdf' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Stub fileToBuffer and calculateChecksum to produce the fixed checksum
      (mockAttachmentManager.fileToBuffer as Mock).mockResolvedValue(
        attachmentInput.file,
      );
      (mockAttachmentManager.calculateChecksum as Mock).mockReturnValue(fixedChecksum);

      // Return an existing file for the checksum lookup
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue({
        id: existingAttachmentFile.id,
        filename: existingAttachmentFile.filename,
        contentType: existingAttachmentFile.contentType,
        size: existingAttachmentFile.size,
        checksum: existingAttachmentFile.checksum,
        storageIdentifiers: existingAttachmentFile.storageIdentifiers,
        createdAt: existingAttachmentFile.createdAt,
        updatedAt: existingAttachmentFile.updatedAt,
      });

      (mockPrismaClient.notification.create as Mock).mockResolvedValue({
        ...mockNotification,
        id: 'notif-1',
        userId: input.userId,
        notificationType: input.notificationType,
        attachments: [],
      });

      (mockPrismaClient.notificationAttachment.create as Mock).mockResolvedValue({
        id: 'notif-att-1',
        notificationId: 'notif-1',
        fileId: existingAttachmentFile.id,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrismaClient.notification.findUnique as Mock).mockResolvedValue({
        ...mockNotification,
        id: 'notif-1',
        attachments: [
          {
            id: 'notif-att-1',
            notificationId: 'notif-1',
            fileId: existingAttachmentFile.id,
            description: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            attachmentFile: {
              id: existingAttachmentFile.id,
              filename: existingAttachmentFile.filename,
              contentType: existingAttachmentFile.contentType,
              size: existingAttachmentFile.size,
              checksum: existingAttachmentFile.checksum,
              storageIdentifiers: existingAttachmentFile.storageIdentifiers,
              createdAt: existingAttachmentFile.createdAt,
              updatedAt: existingAttachmentFile.updatedAt,
            },
          },
        ],
      });

      const mockAttachmentFileInterface = {
        read: vi.fn().mockResolvedValue(Buffer.from('test')),
        stream: vi.fn().mockResolvedValue(new ReadableStream()),
        url: vi.fn().mockResolvedValue('https://example.com/file'),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      (mockAttachmentManager.reconstructAttachmentFile as Mock).mockReturnValue(
        mockAttachmentFileInterface,
      );

      await backend.persistNotification(input);

      // Ensure we looked up the file by checksum
      expect(mockPrismaClient.attachmentFile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checksum: fixedChecksum,
          }),
        }),
      );

      // Ensure we reused the existing file and did not create a new one
      expect(mockPrismaClient.attachmentFile.create).not.toHaveBeenCalled();
      expect(mockAttachmentManager.uploadFile).not.toHaveBeenCalled();

      // Ensure notificationAttachment points to the existing file id
      expect(mockPrismaClient.notificationAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileId: existingAttachmentFile.id,
          }),
        }),
      );
    });

    it('should create notification with inline file attachments', async () => {
      const attachmentInput: NotificationAttachment = {
        file: Buffer.from('test content'),
        filename: 'test.pdf',
        contentType: 'application/pdf',
      };

      const input = {
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        attachments: [attachmentInput],
      };

      const fileRecord: AttachmentFileRecord = {
        id: 'file-123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        checksum: 'abc123',
        storageIdentifiers: { id: 'file-123', key: 's3://bucket/test.pdf' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock attachment manager methods for processing inline upload
      (mockAttachmentManager.fileToBuffer as Mock).mockResolvedValue(Buffer.from('test content'));
      (mockAttachmentManager.calculateChecksum as Mock).mockReturnValue('abc123');
      (mockAttachmentManager.uploadFile as Mock).mockResolvedValue(fileRecord);

      (mockPrismaClient.notification.create as Mock).mockResolvedValue({
        ...mockNotification,
        attachments: [],
      });

      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(null); // No existing file with checksum
      (mockPrismaClient.attachmentFile.create as Mock).mockResolvedValue(
        mockAttachmentFile,
      );
      (mockPrismaClient.notificationAttachment.create as Mock).mockResolvedValue(
        mockNotificationAttachment,
      );
      (mockPrismaClient.notification.findUnique as Mock).mockResolvedValue(
        mockNotification,
      );

      const mockAttachmentFileInterface = {
        read: vi.fn().mockResolvedValue(Buffer.from('test')),
        stream: vi.fn().mockResolvedValue(new ReadableStream()),
        url: vi.fn().mockResolvedValue('https://example.com/file'),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      (mockAttachmentManager.reconstructAttachmentFile as Mock).mockReturnValue(
        mockAttachmentFileInterface,
      );

      const result = await backend.persistNotification(input);

      // Verify attachment manager methods were called
      expect(mockAttachmentManager.fileToBuffer).toHaveBeenCalledWith(Buffer.from('test content'));
      expect(mockAttachmentManager.calculateChecksum).toHaveBeenCalledWith(Buffer.from('test content'));
      expect(mockAttachmentManager.uploadFile).toHaveBeenCalledWith(
        Buffer.from('test content'),
        'test.pdf',
        'application/pdf'
      );
      expect(mockPrismaClient.attachmentFile.create).toHaveBeenCalled();
      expect(mockPrismaClient.notificationAttachment.create).toHaveBeenCalled();
      expect(result.attachments).toBeDefined();
      expect(result.attachments).toHaveLength(1);
    });

    it('should create notification with file reference attachments', async () => {
      const attachmentInput: NotificationAttachment = {
        fileId: 'file-123',
        description: 'Referenced file',
      };

      const input = {
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        attachments: [attachmentInput],
      };

      // For file reference, no upload is needed
      (mockPrismaClient.notification.create as Mock).mockResolvedValue({
        ...mockNotification,
        attachments: [],
      });

      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(
        mockAttachmentFile,
      );
      (mockPrismaClient.notificationAttachment.create as Mock).mockResolvedValue(
        mockNotificationAttachment,
      );
      (mockPrismaClient.notification.findUnique as Mock).mockResolvedValue(
        mockNotification,
      );

      const mockAttachmentFileInterface = {
        read: vi.fn().mockResolvedValue(Buffer.from('test')),
        stream: vi.fn().mockResolvedValue(new ReadableStream()),
        url: vi.fn().mockResolvedValue('https://example.com/file'),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      (mockAttachmentManager.reconstructAttachmentFile as Mock).mockReturnValue(
        mockAttachmentFileInterface,
      );

      const result = await backend.persistNotification(input);

      // For file reference, no upload methods should be called
      expect(mockAttachmentManager.uploadFile).not.toHaveBeenCalled();
      expect(mockAttachmentManager.fileToBuffer).not.toHaveBeenCalled();
      // Should not create file record if it already exists
      expect(mockPrismaClient.attachmentFile.create).not.toHaveBeenCalled();
      expect(mockPrismaClient.notificationAttachment.create).toHaveBeenCalled();
      expect(result.attachments).toBeDefined();
    });

    it('should fail when referenced attachment file is missing', async () => {
      const attachmentInput: NotificationAttachment = {
        fileId: 'missing-file',
        description: 'Missing referenced file',
      };

      const input = {
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        attachments: [attachmentInput],
      };

      (mockPrismaClient.notification.create as Mock).mockResolvedValue({
        ...mockNotification,
        attachments: [],
      });
      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(null);

      await expect(backend.persistNotification(input)).rejects.toThrow(
        'Referenced file missing-file not found',
      );

      expect(mockPrismaClient.attachmentFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing-file' },
      });
      expect(mockPrismaClient.notificationAttachment.create).not.toHaveBeenCalled();
    });

    it('should create notification without attachments', async () => {
      const input = {
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
      };

      (mockPrismaClient.notification.create as Mock).mockResolvedValue({
        ...mockNotification,
        attachments: undefined,
      });

      const result = await backend.persistNotification(input);

      // No attachment methods should be called when there are no attachments
      expect(mockAttachmentManager.uploadFile).not.toHaveBeenCalled();
      expect(mockAttachmentManager.fileToBuffer).not.toHaveBeenCalled();
      expect(result.attachments).toBeUndefined();
    });

    it('should throw error when attachments provided but no AttachmentManager', async () => {
      const backendWithoutManager = new PrismaNotificationBackendFactory().create(
        mockPrismaClient,
      );

      const input = {
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        attachments: [
          {
            file: Buffer.from('test'),
            filename: 'test.pdf',
          },
        ],
      };

      (mockPrismaClient.notification.create as Mock).mockResolvedValue({
        ...mockNotification,
        attachments: [],
      });

      await expect(backendWithoutManager.persistNotification(input)).rejects.toThrow(
        'AttachmentManager is required',
      );
    });
  });

  describe('persistOneOffNotification with attachments', () => {
    it('should create one-off notification with attachments', async () => {
      const attachmentInput: NotificationAttachment = {
        file: Buffer.from('test content'),
        filename: 'brochure.pdf',
        contentType: 'application/pdf',
      };

      const input = {
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        attachments: [attachmentInput],
      };

      const fileRecord: AttachmentFileRecord = {
        id: 'file-123',
        filename: 'brochure.pdf',
        contentType: 'application/pdf',
        size: 5000,
        checksum: 'def456',
        storageIdentifiers: { id: 'file-123', key: 's3://bucket/brochure.pdf' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock attachment manager methods for processing inline upload
      (mockAttachmentManager.fileToBuffer as Mock).mockResolvedValue(Buffer.from('test content'));
      (mockAttachmentManager.calculateChecksum as Mock).mockReturnValue('def456');
      (mockAttachmentManager.uploadFile as Mock).mockResolvedValue(fileRecord);

      const oneOffNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        attachments: [],
      };

      (mockPrismaClient.notification.create as Mock).mockResolvedValue(
        oneOffNotification,
      );

      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue(null);
      (mockPrismaClient.attachmentFile.create as Mock).mockResolvedValue({
        ...mockAttachmentFile,
        filename: 'brochure.pdf',
      });
      (mockPrismaClient.notificationAttachment.create as Mock).mockResolvedValue({
        ...mockNotificationAttachment,
        notificationId: '1',
      });
      (mockPrismaClient.notification.findUnique as Mock).mockResolvedValue({
        ...oneOffNotification,
        attachments: [
          {
            ...mockNotificationAttachment,
            attachmentFile: { ...mockAttachmentFile, filename: 'brochure.pdf' },
          },
        ],
      });

      const mockAttachmentFileInterface = {
        read: vi.fn().mockResolvedValue(Buffer.from('test')),
        stream: vi.fn().mockResolvedValue(new ReadableStream()),
        url: vi.fn().mockResolvedValue('https://example.com/file'),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      (mockAttachmentManager.reconstructAttachmentFile as Mock).mockReturnValue(
        mockAttachmentFileInterface,
      );

      const result = await backend.persistOneOffNotification(input);

      expect(mockAttachmentManager.uploadFile).toHaveBeenCalled();
      expect(result.attachments).toBeDefined();
      expect(result.attachments).toHaveLength(1);
    });

    it('should create one-off notification with attachment file reference without uploading', async () => {
      const attachmentInput: NotificationAttachment = {
        fileId: 'file-123',
        description: 'Referenced file',
      };

      const input = {
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        attachments: [attachmentInput],
      };

      const fileRecord: AttachmentFileRecord = {
        id: 'file-123',
        filename: 'existing.pdf',
        contentType: 'application/pdf',
        size: 2048,
        checksum: 'xyz789',
        storageIdentifiers: { id: 'file-123', key: 's3://bucket/existing.pdf' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const oneOffNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        attachments: [],
      };

      (mockPrismaClient.notification.create as Mock).mockResolvedValue(
        oneOffNotification,
      );

      (mockPrismaClient.attachmentFile.findUnique as Mock).mockResolvedValue({
        id: fileRecord.id,
        filename: fileRecord.filename,
        contentType: fileRecord.contentType,
        size: fileRecord.size,
        checksum: fileRecord.checksum,
        storageIdentifiers: fileRecord.storageIdentifiers,
        createdAt: fileRecord.createdAt,
        updatedAt: fileRecord.updatedAt,
      });

      (mockPrismaClient.notificationAttachment.create as Mock).mockResolvedValue({
        id: 'notif-att-1',
        notificationId: '1',
        fileId: 'file-123',
        description: 'Referenced file',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrismaClient.notification.findUnique as Mock).mockResolvedValue({
        ...oneOffNotification,
        attachments: [
          {
            id: 'notif-att-1',
            notificationId: '1',
            fileId: 'file-123',
            description: 'Referenced file',
            createdAt: new Date(),
            updatedAt: new Date(),
            attachmentFile: {
              id: fileRecord.id,
              filename: fileRecord.filename,
              contentType: fileRecord.contentType,
              size: fileRecord.size,
              checksum: fileRecord.checksum,
              storageIdentifiers: fileRecord.storageIdentifiers,
              createdAt: fileRecord.createdAt,
              updatedAt: fileRecord.updatedAt,
            },
          },
        ],
      });

      const mockAttachmentFileInterface = {
        read: vi.fn().mockResolvedValue(Buffer.from('test')),
        stream: vi.fn().mockResolvedValue(new ReadableStream()),
        url: vi.fn().mockResolvedValue('https://example.com/file'),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      (mockAttachmentManager.reconstructAttachmentFile as Mock).mockReturnValue(
        mockAttachmentFileInterface,
      );

      const result = await backend.persistOneOffNotification(input);

      expect(mockPrismaClient.attachmentFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-123' },
      });
      expect(mockPrismaClient.notificationAttachment.create).toHaveBeenCalled();
      expect(mockAttachmentManager.uploadFile).not.toHaveBeenCalled();
      expect(mockAttachmentManager.fileToBuffer).not.toHaveBeenCalled();

      expect(result.attachments).toBeDefined();
      expect(result.attachments).toHaveLength(1);
    });

    it('should create one-off notification without attachments and not call attachment helpers', async () => {
      const input = {
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: null,
        sendAfter: null,
        // explicitly omit attachments to mirror persistNotification behaviour
      };

      const oneOffNotification = {
        ...mockNotification,
        userId: null,
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        attachments: undefined,
      };

      (mockPrismaClient.notification.create as Mock).mockResolvedValue(
        oneOffNotification,
      );

      const result = await backend.persistOneOffNotification(input);

      expect(mockPrismaClient.notificationAttachment.create).not.toHaveBeenCalled();
      expect(mockAttachmentManager.uploadFile).not.toHaveBeenCalled();
      expect(mockAttachmentManager.fileToBuffer).not.toHaveBeenCalled();

      // keep one-off behaviour aligned with persistNotification
      expect(result.attachments ?? []).toHaveLength(0);
    });
  });

  describe('getNotification with attachments', () => {
    it('should retrieve notification with attachments', async () => {
      const mockAttachmentFileInterface = {
        read: vi.fn().mockResolvedValue(Buffer.from('test')),
        stream: vi.fn().mockResolvedValue(new ReadableStream()),
        url: vi.fn().mockResolvedValue('https://example.com/file'),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      (mockPrismaClient.notification.findUnique as Mock).mockResolvedValue(
        mockNotification,
      );
      (mockAttachmentManager.reconstructAttachmentFile as Mock).mockReturnValue(
        mockAttachmentFileInterface,
      );

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
      expect(result).not.toBeNull();
      expect(result?.attachments).toBeDefined();
      expect(result?.attachments).toHaveLength(1);
    });
  });
});

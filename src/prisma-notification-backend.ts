import type { BaseNotificationBackend, NotificationFilter } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { InputJsonValue, JsonValue } from 'vintasend/dist/types/json-values';
import type {
  DatabaseNotification,
  Notification,
  NotificationInput,
} from 'vintasend/dist/types/notification';
import type {
  AnyDatabaseNotification,
  AnyNotification,
  DatabaseOneOffNotification,
  OneOffNotificationInput,
} from 'vintasend/dist/types/notification';
import type { NotificationStatus } from 'vintasend/dist/types/notification-status';
import type { NotificationType } from 'vintasend/dist/types/notification-type';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';
import type {
  AttachmentFileRecord,
  StoredAttachment,
  NotificationAttachment,
  StorageIdentifiers,
} from 'vintasend/dist/types/attachment';
import { isAttachmentReference } from 'vintasend/dist/types/attachment';
import type { BaseAttachmentManager } from 'vintasend/dist/services/attachment-manager/base-attachment-manager';
import type { BaseLogger } from 'vintasend/dist/services/loggers/base-logger';

export const NotificationStatusEnum = {
  PENDING_SEND: 'PENDING_SEND',
  SENT: 'SENT',
  FAILED: 'FAILED',
  READ: 'READ',
  CANCELLED: 'CANCELLED',
} as const;

export const NotificationTypeEnum = {
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  SMS: 'SMS',
  IN_APP: 'IN_APP',
} as const;

export interface PrismaNotificationModel<IdType, UserId> {
  id: IdType;
  userId: UserId | null;
  // One-off notification fields (optional)
  emailOrPhone: string | null;
  firstName: string | null;
  lastName: string | null;
  // Common fields
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string;
  contextParameters: JsonValue;
  sendAfter: Date | null;
  subjectTemplate: string | null;
  status: NotificationStatus;
  contextUsed: JsonValue | null;
  extraParams: JsonValue | null;
  adapterUsed: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  gitCommitSha: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    email: string;
  };
  attachments?: PrismaNotificationAttachmentModel[];
}

export interface PrismaAttachmentFileModel {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  storageIdentifiers: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaNotificationAttachmentModel {
  id: string;
  notificationId: number;
  fileId: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachmentFile?: PrismaAttachmentFileModel;
}

type PrismaPendingSendAfterFilter = { or: ({ lte: Date } | { equals: null })[] };

type PrismaDateRangeFilter = {
  gte?: Date;
  lte?: Date;
};

type StringFilterLookup = {
  lookup: 'exact' | 'startsWith' | 'endsWith' | 'includes';
  value: string;
  caseSensitive?: boolean;
};

type StringFieldFilter = string | StringFilterLookup;

function isStringFilterLookup(value: StringFieldFilter): value is StringFilterLookup {
  return typeof value === 'object' && value !== null && 'lookup' in value && 'value' in value;
}

type PrismaStringFilter = {
  equals?: string;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
  mode?: 'default' | 'insensitive';
};

type PrismaNotificationWhereInput<NotificationIdType, UserIdType> = {
  AND?: PrismaNotificationWhereInput<NotificationIdType, UserIdType>[];
  OR?: PrismaNotificationWhereInput<NotificationIdType, UserIdType>[];
  NOT?:
    | PrismaNotificationWhereInput<NotificationIdType, UserIdType>
    | PrismaNotificationWhereInput<NotificationIdType, UserIdType>[];
  id?: NotificationIdType;
  status?: NotificationStatus | { not: NotificationStatus } | { in: NotificationStatus[] };
  notificationType?: NotificationType | { in: NotificationType[] };
  sendAfter?: { gt: Date } | null | PrismaPendingSendAfterFilter | PrismaDateRangeFilter;
  userId?: UserIdType | null;
  readAt?: null;
  emailOrPhone?: string | { not: null };
  adapterUsed?: string | { in: string[] };
  bodyTemplate?: string | PrismaStringFilter;
  subjectTemplate?: string | PrismaStringFilter;
  contextName?: string | PrismaStringFilter;
  createdAt?: PrismaDateRangeFilter;
  sentAt?: PrismaDateRangeFilter;
};

export interface NotificationPrismaClientInterface<NotificationIdType, UserIdType> {
  $transaction<R>(
    fn: (prisma: NotificationPrismaClientInterface<NotificationIdType, UserIdType>) => Promise<R>,
  ): Promise<R>;
  notification: {
    findMany(args?: {
      where?: PrismaNotificationWhereInput<NotificationIdType, UserIdType>;
      skip?: number;
      take?: number;
      include?: {
        user?: boolean;
        attachments?: boolean | { include: { attachmentFile: boolean } };
      };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>[]>;
    create(args: {
      data: PrismaNotificationCreateData<UserIdType>;
      include?: {
        user?: boolean;
        attachments?: boolean | { include: { attachmentFile: boolean } };
      };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>>;
    createManyAndReturn(args: {
      data: PrismaNotificationCreateData<UserIdType>[];
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>[]>;
    update(args: {
      where: { id: NotificationIdType };
      data: BaseNotificationUpdateInput<UserIdType>;
      include?: {
        user?: boolean;
        attachments?: boolean | { include: { attachmentFile: boolean } };
      };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>>;
    findUnique(args: {
      where: { id: NotificationIdType };
      include?: {
        user?: boolean;
        attachments?: boolean | { include: { attachmentFile: boolean } };
      };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType> | null>;
  };
  attachmentFile: {
    findUnique(args: {
      where: { id: string } | { checksum: string };
    }): Promise<PrismaAttachmentFileModel | null>;
    create(args: {
      data: {
        id?: string;
        filename: string;
        contentType: string;
        size: number;
        checksum: string;
        storageIdentifiers: InputJsonValue;
      };
    }): Promise<PrismaAttachmentFileModel>;
    delete(args: {
      where: { id: string };
    }): Promise<PrismaAttachmentFileModel>;
    findMany(args?: {
      where?: {
        notificationAttachments?: { none: object };
        createdAt?: { lt: Date };
      };
    }): Promise<PrismaAttachmentFileModel[]>;
  };
  notificationAttachment: {
    findMany(args: {
      where: {
        notificationId: NotificationIdType;
      };
      include?: { attachmentFile: boolean };
    }): Promise<PrismaNotificationAttachmentModel[]>;
    delete(args: {
      where: { id: string };
    }): Promise<PrismaNotificationAttachmentModel>;
    deleteMany(args: {
      where: {
        id: string;
        notificationId: NotificationIdType;
      };
    }): Promise<{ count: number }>;
    create(args: {
      data: {
        id?: string;
        notificationId: NotificationIdType;
        fileId: string;
        description?: string | null;
      };
    }): Promise<PrismaNotificationAttachmentModel>;
  };
}

// cause typescript not to expand types and preserve names
type NoExpand<T> = T extends unknown ? T : never;

// Centralized attachment include shape for DRY
const notificationWithAttachmentsInclude = {
  attachments: {
    include: {
      attachmentFile: true as const,
    },
  },
} as const;

// this type assumes the passed object is entirely optional
type AtLeast<O extends object, K extends string> = NoExpand<
  O extends unknown
    ?
        | (K extends keyof O ? { [P in K]: O[P] } & O : O)
        | ({ [P in keyof O as P extends K ? K : never]-?: O[P] } & O)
    : never
>;

export interface BaseNotificationCreateInput<UserIdType> {
  // Common fields
  notificationType: NotificationType;
  title?: string | null;
  bodyTemplate: string;
  contextName: string;
  contextParameters: InputJsonValue;
  sendAfter?: Date | null;
  subjectTemplate?: string | null;
  status?: NotificationStatus;
  contextUsed?: InputJsonValue;
  extraParams?: InputJsonValue;
  adapterUsed?: string | null;
  sentAt?: Date | null;
  readAt?: Date | null;
  gitCommitSha?: string | null;
  emailOrPhone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

// Prisma-compatible type for creating notifications
export type PrismaNotificationCreateData<UserIdType> =
  BaseNotificationCreateInput<UserIdType> & {
    userId?: UserIdType | null;
    user?: { connect: { id: UserIdType } };
  };

export interface BaseNotificationUpdateInput<UserIdType> {
  user?: {
    connect?: AtLeast<
      {
        id?: UserIdType;
        email?: string;
      },
      'id' | 'email'
    >;
  };
  emailOrPhone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  notificationType?: NotificationType;
  title?: string | null;
  bodyTemplate?: string;
  contextName?: string;
  contextParameters?: InputJsonValue;
  sendAfter?: Date | null;
  subjectTemplate?: string | null;
  status?: NotificationStatus;
  contextUsed?: InputJsonValue;
  extraParams?: InputJsonValue;
  adapterUsed?: string | null;
  sentAt?: Date | null;
  readAt?: Date | null;
  gitCommitSha?: string | null;
}

function convertJsonValueToRecord(jsonValue: JsonValue): Record<string, string | number | boolean> {
  if (typeof jsonValue === 'object' && !Array.isArray(jsonValue)) {
    return jsonValue as Record<string, string | number | boolean>;
  }

  throw new Error('Invalid JSON value. It should be an object.');
}

export class PrismaNotificationBackend<
  Client extends NotificationPrismaClientInterface<
    Config['NotificationIdType'],
    Config['UserIdType']
  >,
  Config extends BaseNotificationTypeConfig,
> implements BaseNotificationBackend<Config>
{
  private logger?: BaseLogger;

  constructor(
    private prismaClient: Client,
    private attachmentManager?: BaseAttachmentManager,
  ) {}

  /**
   * Inject attachment manager (called by VintaSend when both service and backend exist)
   */
  injectAttachmentManager(manager: BaseAttachmentManager): void {
    this.attachmentManager = manager;
  }

  /**
   * Inject logger for debugging and monitoring
   */
  injectLogger(logger: BaseLogger): void {
    this.logger = logger;
  }

  /**
   * Build a where clause for status-based updates
   */
  private buildStatusWhere(
    id: NonNullable<Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>>['id'],
    opts: { checkStatus?: NotificationStatus } = {},
  ) {
    const where: {
      id: Config['NotificationIdType'];
      status?: NotificationStatus;
    } = {
      id: id as Config['NotificationIdType'],
    };

    if (opts.checkStatus) {
      where.status = opts.checkStatus;
    }

    return where;
  }

  private stringFilterLookupToPrismaWhere(filter: StringFieldFilter): string | PrismaStringFilter {
    if (!isStringFilterLookup(filter)) {
      return filter;
    }

    const mode = filter.caseSensitive === false ? 'insensitive' : 'default';

    switch (filter.lookup) {
      case 'exact':
        return { equals: filter.value, mode };
      case 'startsWith':
        return { startsWith: filter.value, mode };
      case 'endsWith':
        return { endsWith: filter.value, mode };
      case 'includes':
        return { contains: filter.value, mode };
      default:
        return filter.value;
    }
  }

  private convertNotificationFilterToPrismaWhere(
    filter: NotificationFilter<Config>,
  ): PrismaNotificationWhereInput<Config['NotificationIdType'], Config['UserIdType']> {
    if ('and' in filter) {
      return {
        AND: filter.and.map((subFilter) => this.convertNotificationFilterToPrismaWhere(subFilter)),
      };
    }

    if ('or' in filter) {
      return {
        OR: filter.or.map((subFilter) => this.convertNotificationFilterToPrismaWhere(subFilter)),
      };
    }

    if ('not' in filter) {
      return {
        NOT: this.convertNotificationFilterToPrismaWhere(filter.not),
      };
    }

    const where: PrismaNotificationWhereInput<
      Config['NotificationIdType'],
      Config['UserIdType']
    > = {};

    if (filter.status !== undefined) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }

    if (filter.notificationType !== undefined) {
      where.notificationType = Array.isArray(filter.notificationType)
        ? { in: filter.notificationType }
        : filter.notificationType;
    }

    if (filter.adapterUsed !== undefined) {
      where.adapterUsed = Array.isArray(filter.adapterUsed)
        ? { in: filter.adapterUsed }
        : filter.adapterUsed;
    }

    if (filter.userId !== undefined) {
      where.userId = filter.userId;
    }

    if (filter.bodyTemplate !== undefined) {
      where.bodyTemplate = this.stringFilterLookupToPrismaWhere(filter.bodyTemplate);
    }

    if (filter.subjectTemplate !== undefined) {
      where.subjectTemplate = this.stringFilterLookupToPrismaWhere(filter.subjectTemplate);
    }

    if (filter.contextName !== undefined) {
      where.contextName = this.stringFilterLookupToPrismaWhere(filter.contextName);
    }

    if (filter.sendAfterRange) {
      const sendAfterFilter: PrismaDateRangeFilter = {};
      if (filter.sendAfterRange.from) {
        sendAfterFilter.gte = filter.sendAfterRange.from;
      }
      if (filter.sendAfterRange.to) {
        sendAfterFilter.lte = filter.sendAfterRange.to;
      }
      if (Object.keys(sendAfterFilter).length > 0) {
        where.sendAfter = sendAfterFilter;
      }
    }

    if (filter.createdAtRange) {
      const createdAtFilter: PrismaDateRangeFilter = {};
      if (filter.createdAtRange.from) {
        createdAtFilter.gte = filter.createdAtRange.from;
      }
      if (filter.createdAtRange.to) {
        createdAtFilter.lte = filter.createdAtRange.to;
      }
      if (Object.keys(createdAtFilter).length > 0) {
        where.createdAt = createdAtFilter;
      }
    }

    if (filter.sentAtRange) {
      const sentAtFilter: PrismaDateRangeFilter = {};
      if (filter.sentAtRange.from) {
        sentAtFilter.gte = filter.sentAtRange.from;
      }
      if (filter.sentAtRange.to) {
        sentAtFilter.lte = filter.sentAtRange.to;
      }
      if (Object.keys(sentAtFilter).length > 0) {
        where.sentAt = sentAtFilter;
      }
    }

    return where;
  }

  /**
   * Serialize a Prisma notification model to either DatabaseNotification or DatabaseOneOffNotification
   * based on whether it has a userId or not (internal implementation)
   */
  private serializeAnyNotification(
    notification: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >,
  ): AnyDatabaseNotification<Config> {
    const baseData = {
      id: notification.id,
      notificationType: notification.notificationType,
      title: notification.title,
      bodyTemplate: notification.bodyTemplate,
      contextName: notification.contextName as string & keyof Config['ContextMap'],
      contextParameters: notification.contextParameters
        ? (notification.contextParameters as Parameters<
            Config['ContextMap'][keyof Config['ContextMap']]['generate']
          >[0])
        : {},
      sendAfter: notification.sendAfter,
      subjectTemplate: notification.subjectTemplate,
      status: notification.status,
      contextUsed: notification.contextUsed as ReturnType<
        Config['ContextMap'][keyof Config['ContextMap']]['generate']
      > extends Promise<infer T>
        ? T
        : ReturnType<Config['ContextMap'][keyof Config['ContextMap']]['generate']>,
      extraParams: notification.extraParams
        ? convertJsonValueToRecord(notification.extraParams)
        : null,
      adapterUsed: notification.adapterUsed,
      sentAt: notification.sentAt,
      readAt: notification.readAt,
      gitCommitSha: notification.gitCommitSha,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      // Serialize attachments if present and attachmentManager is available
      attachments:
        notification.attachments && this.attachmentManager
          ? notification.attachments.map((att) => this.serializeStoredAttachment(att))
          : undefined,
    };

    // Check if this is a one-off notification (has emailOrPhone but no userId)
    // Use explicit null checks to avoid misclassification with empty strings or other falsy values
    if (notification.userId == null && notification.emailOrPhone != null) {
      return {
        ...baseData,
        emailOrPhone: notification.emailOrPhone,
        firstName: notification.firstName || '',
        lastName: notification.lastName || '',
      } as DatabaseOneOffNotification<Config>;
    }

    // Regular notification with userId
    if (notification.userId == null) {
      throw new Error('Invalid notification: missing both userId and emailOrPhone');
    }
    return {
      ...baseData,
      userId: notification.userId as Config['UserIdType'],
    } as DatabaseNotification<Config>;
  }

  /**
   * Serialize a Prisma notification model to DatabaseNotification
   */
  private serializeRegularNotification(
    notification: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >,
  ): DatabaseNotification<Config> {
    return this.serializeAnyNotification(notification) as DatabaseNotification<Config>;
  }

  /**
   * Serialize a Prisma notification model to DatabaseOneOffNotification
   */
  private serializeOneOffNotification(
    notification: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >,
  ): DatabaseOneOffNotification<Config> {
    return this.serializeAnyNotification(notification) as DatabaseOneOffNotification<Config>;
  }

  /**
   * Public accessor for serialization - primarily for testing
   * @internal
   */
  serializeNotification(
    notification: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >,
  ): AnyDatabaseNotification<Config> {
    return this.serializeAnyNotification(notification);
  }

  /**
   * Core internal builder for creating notification data
   * Validates that notification has either userId or emailOrPhone (but not neither)
   */
  private buildCreateData(
    notification: Omit<AnyNotification<Config>, 'id'>,
  ): PrismaNotificationCreateData<Config['UserIdType']> {
    const notificationWithOneOffFields = notification as Partial<
      Pick<OneOffNotificationInput<Config>, 'emailOrPhone' | 'firstName' | 'lastName'>
    >;

    const hasUserId = 'userId' in notification && notification.userId != null;
    const hasEmailOrPhone = 'emailOrPhone' in notification && notification.emailOrPhone != null;

    // Validate: must have either userId or emailOrPhone
    if (!hasUserId && !hasEmailOrPhone) {
      throw new Error('Invalid notification: missing both userId and emailOrPhone');
    }

    // Determine if this is a one-off notification
    // When both are provided, userId takes precedence (regular notification)
    const isOneOff = !hasUserId && hasEmailOrPhone;

    const base: BaseNotificationCreateInput<Config['UserIdType']> = {
      notificationType: notification.notificationType,
      title: notification.title,
      bodyTemplate: notification.bodyTemplate,
      contextName: notification.contextName as string,
      contextParameters: notification.contextParameters as InputJsonValue,
      sendAfter: notification.sendAfter,
      subjectTemplate: notification.subjectTemplate,
      extraParams: notification.extraParams as InputJsonValue,
      gitCommitSha:
        'gitCommitSha' in notification && notification.gitCommitSha !== undefined
          ? (notification.gitCommitSha as string | null)
          : null,
      // Only include one-off fields if this is actually a one-off notification
      ...(isOneOff && {
        emailOrPhone: notificationWithOneOffFields.emailOrPhone ?? null,
        firstName: notificationWithOneOffFields.firstName ?? null,
        lastName: notificationWithOneOffFields.lastName ?? null,
      }),
    };

    if (isOneOff) {
      return {
        ...base,
        userId: null,
        status: NotificationStatusEnum.PENDING_SEND,
        user: undefined,
      };
    }

    // At this point we know hasUserId is true, so userId exists and is not null
    const userId = ('userId' in notification ? notification.userId : null) as Config['UserIdType'];
    return {
      ...base,
      userId,
      user: {
        connect: { id: userId },
      },
    };
  }

  /**
   * Deserialize a regular notification input for creation
   */
  private deserializeRegularNotification(
    notification: NotificationInput<Config>,
  ): PrismaNotificationCreateData<Config['UserIdType']> {
    return this.buildCreateData(notification);
  }

  /**
   * Build one-off notification data for creation
   */
  private buildOneOffNotificationData(
    notification: OneOffNotificationInput<Config>,
  ): PrismaNotificationCreateData<Config['UserIdType']> {
    return this.buildCreateData(notification);
  }

  /**
   * Core internal builder for update data (supports both regular and one-off)
   */
  private buildUpdateData(
    notification: Partial<
      Omit<DatabaseNotification<Config>, 'id'> | Omit<DatabaseOneOffNotification<Config>, 'id'>
    >,
  ): Partial<BaseNotificationUpdateInput<Config['UserIdType']>> {
    const data: Partial<BaseNotificationUpdateInput<Config['UserIdType']>> = {};

    // Determine if this is transitioning between regular and one-off notification types
    const hasUserId = 'userId' in notification && notification.userId !== undefined;
    const hasOneOffFields =
      'emailOrPhone' in notification && notification.emailOrPhone !== undefined;

    // Handle user / one-off fields with mutual exclusion
    if (hasUserId) {
      // Converting to regular notification: set user and clear one-off fields
      data.user = { connect: { id: notification.userId } };
      // Clear one-off specific fields when transitioning to regular notification
      data.emailOrPhone = null;
      data.firstName = null;
      data.lastName = null;
    } else if (hasOneOffFields) {
      // Converting to one-off notification: set one-off fields
      // Note: We cannot explicitly clear the user relationship via update,
      // but setting emailOrPhone indicates this is now a one-off notification
      data.emailOrPhone = notification.emailOrPhone;
      if ('firstName' in notification && notification.firstName !== undefined) {
        data.firstName = notification.firstName;
      }
      if ('lastName' in notification && notification.lastName !== undefined) {
        data.lastName = notification.lastName;
      }
    } else {
      // No type transition, just update individual fields if provided
      if ('emailOrPhone' in notification && notification.emailOrPhone !== undefined) {
        data.emailOrPhone = notification.emailOrPhone;
      }
      if ('firstName' in notification && notification.firstName !== undefined) {
        data.firstName = notification.firstName;
      }
      if ('lastName' in notification && notification.lastName !== undefined) {
        data.lastName = notification.lastName;
      }
    }

    // Handle common fields
    if (notification.notificationType !== undefined) {
      data.notificationType = notification.notificationType;
    }
    if (notification.title !== undefined) {
      data.title = notification.title;
    }
    if (notification.bodyTemplate !== undefined) {
      data.bodyTemplate = notification.bodyTemplate;
    }
    if (notification.contextName !== undefined) {
      data.contextName = notification.contextName as string;
    }
    if (notification.contextParameters !== undefined) {
      data.contextParameters = notification.contextParameters as InputJsonValue;
    }
    if (notification.sendAfter !== undefined) {
      data.sendAfter = notification.sendAfter;
    }
    if (notification.subjectTemplate !== undefined) {
      data.subjectTemplate = notification.subjectTemplate;
    }
    if (notification.status !== undefined) {
      data.status = notification.status;
    }
    if (notification.contextUsed !== undefined) {
      data.contextUsed = notification.contextUsed as InputJsonValue;
    }
    if (notification.extraParams !== undefined) {
      data.extraParams = notification.extraParams as InputJsonValue;
    }
    if (notification.adapterUsed !== undefined) {
      data.adapterUsed = notification.adapterUsed;
    }
    if (notification.sentAt !== undefined) {
      data.sentAt = notification.sentAt;
    }
    if (notification.readAt !== undefined) {
      data.readAt = notification.readAt;
    }
    if (notification.gitCommitSha !== undefined) {
      data.gitCommitSha = notification.gitCommitSha;
    }

    return data;
  }

  /**
   * Build update data from one-off input shape (no database-only fields)
   */
  private buildOneOffInputUpdateData(
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
  ): Partial<BaseNotificationUpdateInput<Config['UserIdType']>> {
    const data: Partial<BaseNotificationUpdateInput<Config['UserIdType']>> = {};

    if (notification.emailOrPhone !== undefined) {
      data.emailOrPhone = notification.emailOrPhone;
    }
    if (notification.firstName !== undefined) {
      data.firstName = notification.firstName;
    }
    if (notification.lastName !== undefined) {
      data.lastName = notification.lastName;
    }
    if (notification.notificationType !== undefined) {
      data.notificationType = notification.notificationType;
    }
    if (notification.title !== undefined) {
      data.title = notification.title;
    }
    if (notification.bodyTemplate !== undefined) {
      data.bodyTemplate = notification.bodyTemplate;
    }
    if (notification.contextName !== undefined) {
      data.contextName = notification.contextName as string;
    }
    if (notification.contextParameters !== undefined) {
      data.contextParameters = notification.contextParameters as InputJsonValue;
    }
    if (notification.sendAfter !== undefined) {
      data.sendAfter = notification.sendAfter;
    }
    if (notification.subjectTemplate !== undefined) {
      data.subjectTemplate = notification.subjectTemplate;
    }
    if (notification.extraParams !== undefined) {
      data.extraParams = notification.extraParams as InputJsonValue;
    }

    return data;
  }

  /**
   * Get or create file record for attachment upload with deduplication (transaction-aware)
   * @private
   */
  private async getOrCreateFileRecordForUploadInTransaction(
    tx: NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
    att: Extract<NotificationAttachment, { file: unknown }>,
  ): Promise<AttachmentFileRecord> {
    const manager = this.getAttachmentManager();

    const buffer = await manager.fileToBuffer(att.file);
    const checksum = manager.calculateChecksum(buffer);

    let fileRecord = await this.findAttachmentFileByChecksumInTransaction(tx, checksum);
    if (!fileRecord) {
      fileRecord = await manager.uploadFile(att.file, att.filename, att.contentType);
      await tx.attachmentFile.create({
        data: {
          id: fileRecord.id,
          filename: fileRecord.filename,
          contentType: fileRecord.contentType,
          size: fileRecord.size,
          checksum: fileRecord.checksum,
          storageIdentifiers: fileRecord.storageIdentifiers as InputJsonValue,
        },
      });
    }

    return fileRecord;
  }

  /**
   * Create notification attachment link (transaction-aware)
   * @private`
   */
  private async createNotificationAttachmentLinkInTransaction(
    tx: NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
    notificationId: Config['NotificationIdType'],
    fileId: string,
    description?: string | null,
  ): Promise<void> {
    await tx.notificationAttachment.create({
      data: {
        notificationId,
        fileId,
        description: description ?? null,
      },
    });
  }

  /**
   * Get attachment file by ID (transaction-aware)
   * @private
   */
  private async getAttachmentFileInTransaction(
    tx: NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
    fileId: string,
  ): Promise<AttachmentFileRecord | null> {
    const file = await tx.attachmentFile.findUnique({
      where: { id: fileId },
    });

    if (!file) return null;

    return this.serializeAttachmentFileRecord(file);
  }

  /**
   * Find attachment file by checksum (transaction-aware)
   * @private
   */
  private async findAttachmentFileByChecksumInTransaction(
    tx: NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
    checksum: string,
  ): Promise<AttachmentFileRecord | null> {
    const file = await tx.attachmentFile.findUnique({
      where: { checksum },
    });

    if (!file) return null;

    return this.serializeAttachmentFileRecord(file);
  }

  /**
   * Core helper for creating notifications with attachments (both regular and one-off)
   * Uses transactions to ensure atomicity - if attachment processing fails, the notification won't be created
   * @private
   */
  private async createNotificationWithAttachments<TInput, TSerialized>(
    input: TInput & { attachments?: NotificationAttachment[] },
    buildData: (notification: Omit<TInput, 'attachments'>) => PrismaNotificationCreateData<
      Config['UserIdType']
    >,
    serialize: (
      db: PrismaNotificationModel<Config['NotificationIdType'], Config['UserIdType']>,
    ) => TSerialized,
  ): Promise<TSerialized> {
    const { attachments, ...notificationData } = input;

    // If no attachments, skip transaction overhead
    if (!attachments || attachments.length === 0) {
      this.logger?.info('Creating notification without attachments');
      const created = await this.prismaClient.notification.create({
        data: buildData(notificationData as TInput),
        include: notificationWithAttachmentsInclude,
      });
      this.logger?.info(`Notification created successfully with ID: ${created.id}`);
      return serialize(created);
    }

    // Validate attachment manager exists
    this.getAttachmentManager();

    // Use transaction to ensure atomicity of notification + attachments
    this.logger?.info(`Creating notification with ${attachments.length} attachment(s)`);
    return await this.prismaClient.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: buildData(notificationData as TInput),
        include: notificationWithAttachmentsInclude,
      });

      this.logger?.info(`Processing attachments for notification ID: ${created.id}`);
      await this.processAndStoreAttachmentsInTransaction(tx, created.id, attachments);

      const withAttachments = await tx.notification.findUnique({
        where: { id: created.id },
        include: notificationWithAttachmentsInclude,
      });

      if (!withAttachments) {
        throw new Error('Failed to retrieve notification after creating attachments');
      }

      this.logger?.info(`Notification created successfully with ID: ${created.id} and ${attachments.length} attachment(s)`);
      return serialize(withAttachments);
    });
  }

  /**
   * Get attachment manager with null check
   * @private
   */
  private getAttachmentManager(): BaseAttachmentManager {
    if (!this.attachmentManager) {
      throw new Error('AttachmentManager is required but not provided');
    }
    return this.attachmentManager;
  }

  deserializeNotification(
    notification: Omit<AnyNotification<Config>, 'id'>,
  ): PrismaNotificationCreateData<Config['UserIdType']> {
    return this.buildCreateData(notification);
  }

  deserializeNotificationForUpdate(
    notification: Partial<Notification<Config>>,
  ): Partial<Parameters<typeof this.prismaClient.notification.update>[0]['data']> {
    const notificationWithOptionalGitCommitSha = notification as Partial<
      Notification<Config>
    > & { gitCommitSha?: string | null };

    return {
      ...(notification.userId ? { user: { connect: { id: notification.userId } } } : {}),
      ...(notification.notificationType
        ? {
            notificationType: NotificationTypeEnum[
              notification.notificationType as keyof typeof NotificationTypeEnum
            ] as NotificationType,
          }
        : {}),
      ...(notification.title ? { title: notification.title } : {}),
      ...(notification.bodyTemplate ? { bodyTemplate: notification.bodyTemplate } : {}),
      ...(notification.contextName ? { contextName: notification.contextName } : {}),
      ...(notification.contextParameters
        ? {
            contextParameters: notification.contextParameters ? notification.contextParameters : {},
          }
        : {}),
      ...(notification.sendAfter ? { sendAfter: notification.sendAfter } : {}),
      ...(notification.subjectTemplate ? { subjectTemplate: notification.subjectTemplate } : {}),
      ...(notificationWithOptionalGitCommitSha.gitCommitSha !== undefined
        ? { gitCommitSha: notificationWithOptionalGitCommitSha.gitCommitSha }
        : {}),
    } as Partial<Parameters<typeof this.prismaClient.notification.update>[0]['data']>;
  }

  async getAllPendingNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: NotificationStatusEnum.PENDING_SEND,
        sendAfter: {
          or: [{ lte: new Date() }, { equals: null }],
        },
      },
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getPendingNotifications(
    page = 0,
    pageSize = 100,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    this.logger?.info(`Fetching pending notifications: page ${page}, pageSize ${pageSize}`);
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: NotificationStatusEnum.PENDING_SEND,
        sendAfter: { or: [{ lte: new Date() }, { equals: null }], },
      },
      skip: page * pageSize,
      take: pageSize,
    });

    this.logger?.info(`Found ${notifications.length} pending notification(s)`);
    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getAllFutureNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: { not: NotificationStatusEnum.PENDING_SEND },
        sendAfter: { gt: new Date() },
      },
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getFutureNotifications(
    page = 0,
    pageSize = 100,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: { not: NotificationStatusEnum.PENDING_SEND },
        sendAfter: { gt: new Date() },
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getAllFutureNotificationsFromUser(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
  ): Promise<DatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId,
        status: {
          not: NotificationStatusEnum.PENDING_SEND,
        },
        sendAfter: { gt: new Date() },
      },
    });

    return notifications.map((n) => this.serializeRegularNotification(n));
  }

  async getFutureNotificationsFromUser(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId,
        status: {
          not: NotificationStatusEnum.PENDING_SEND,
        },
        sendAfter: {
          gt: new Date(),
        },
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeRegularNotification(n));
  }

  async getAllNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({});

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async persistNotification(
    notification: NotificationInput<Config>,
  ): Promise<DatabaseNotification<Config>> {
    return this.createNotificationWithAttachments(
      notification,
      (n) => this.deserializeRegularNotification(n as NotificationInput<Config>),
      (db) => this.serializeRegularNotification(db),
    );
  }

  async persistNotificationUpdate(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    notification: Partial<Omit<DatabaseNotification<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>> {
    const updated = await this.prismaClient.notification.update({
      where: {
        id: notificationId,
      },
      data: this.buildUpdateData(notification),
    });

    return this.serializeRegularNotification(updated);
  }

  /* One-off notification persistence and query methods */
  async persistOneOffNotification(
    notification: OneOffNotificationInput<Config>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    return this.createNotificationWithAttachments(
      notification,
      (n) => this.buildOneOffNotificationData(n as OneOffNotificationInput<Config>),
      (db) => this.serializeOneOffNotification(db),
    );
  }

  async persistOneOffNotificationUpdate(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    const updated = await this.prismaClient.notification.update({
      where: { id: notificationId as Config['NotificationIdType'] },
      data: this.buildOneOffInputUpdateData(notification),
    });

    return this.serializeOneOffNotification(updated);
  }

  async getOneOffNotification(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    _forUpdate: boolean,
  ): Promise<DatabaseOneOffNotification<Config> | null> {
    const notification = await this.prismaClient.notification.findUnique({
      where: {
        id: notificationId as Config['NotificationIdType'],
      },
    });

    if (!notification || notification.emailOrPhone == null || notification.userId !== null) {
      return null;
    }

    return this.serializeOneOffNotification(notification);
  }

  async getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId: null,
        emailOrPhone: { not: null },
      },
    });

    return notifications.map((n) => this.serializeOneOffNotification(n));
  }

  async getOneOffNotifications(
    page: number,
    pageSize: number,
  ): Promise<DatabaseOneOffNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId: null,
        emailOrPhone: { not: null },
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeOneOffNotification(n));
  }

  async markAsSent(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsPending = true,
  ): Promise<AnyDatabaseNotification<Config>> {
    this.logger?.info(`Marking notification ${notificationId} as sent`);
    const updated = await this.prismaClient.notification.update({
      where: this.buildStatusWhere(notificationId, {
        checkStatus: checkIsPending ? NotificationStatusEnum.PENDING_SEND : undefined,
      }),
      data: {
        status: NotificationStatusEnum.SENT,
        sentAt: new Date(),
      },
    });

    this.logger?.info(`Notification ${notificationId} marked as sent`);
    return this.serializeAnyNotification(updated);
  }

  async markAsFailed(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsPending = true,
  ): Promise<AnyDatabaseNotification<Config>> {
    this.logger?.info(`Marking notification ${notificationId} as failed`);
    const updated = await this.prismaClient.notification.update({
      where: this.buildStatusWhere(notificationId, {
        checkStatus: checkIsPending ? NotificationStatusEnum.PENDING_SEND : undefined,
      }),
      data: {
        status: NotificationStatusEnum.FAILED,
        sentAt: new Date(),
      },
    });

    this.logger?.info(`Notification ${notificationId} marked as failed`);
    return this.serializeAnyNotification(updated);
  }

  async markAsRead(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsSent = true,
  ): Promise<DatabaseNotification<Config>> {
    this.logger?.info(`Marking notification ${notificationId} as read`);
    // First fetch to validate it's a regular notification
    const notification = await this.prismaClient.notification.findUnique({
      where: { id: notificationId as Config['NotificationIdType'] },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId == null) {
      throw new Error('Cannot mark one-off notification as read');
    }

    const updated = await this.prismaClient.notification.update({
      where: this.buildStatusWhere(notificationId, {
        checkStatus: checkIsSent ? NotificationStatusEnum.SENT : undefined,
      }),
      data: {
        status: NotificationStatusEnum.READ,
        readAt: new Date(),
      },
    });

    this.logger?.info(`Notification ${notificationId} marked as read`);
    return this.serializeRegularNotification(updated);
  }

  async cancelNotification(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
  ): Promise<void> {
    await this.prismaClient.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        status: NotificationStatusEnum.CANCELLED,
      },
    });
  }

  async getNotification(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    _forUpdate: boolean,
  ): Promise<AnyDatabaseNotification<Config> | null> {
    const notification = await this.prismaClient.notification.findUnique({
      where: { id: notificationId as Config['NotificationIdType'] },
      include: notificationWithAttachmentsInclude,
    });

    if (!notification) return null;

    return this.serializeAnyNotification(notification);
  }

  async filterAllInAppUnreadNotifications(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
  ): Promise<DatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId,
        status: 'SENT',
        readAt: null,
      },
    });

    return notifications.map((n) => this.serializeRegularNotification(n));
  }

  async filterInAppUnreadNotifications(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId,
        status: 'SENT',
        readAt: null,
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeRegularNotification(n));
  }

  async getUserEmailFromNotification(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
  ): Promise<string | undefined> {
    const notification = await this.prismaClient.notification.findUnique({
      where: {
        id: notificationId,
      },
      include: {
        user: true,
      },
    });

    return notification?.user?.email;
  }

  async storeAdapterAndContextUsed(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    adapterKey: string,
    context: InputJsonValue,
  ): Promise<void> {
    await this.prismaClient.notification.update({
      where: { id: notificationId as Config['NotificationIdType'] },
      data: { contextUsed: context, adapterUsed: adapterKey },
    });
  }

  async bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    const created = await this.prismaClient.notification.createManyAndReturn({
      data: notifications.map((notification) => this.deserializeNotification(notification)),
    });
    return created.map((n) => n.id);
  }

  /* Attachment management methods */

  async getAttachmentFile(fileId: string): Promise<AttachmentFileRecord | null> {
    const file = await this.prismaClient.attachmentFile.findUnique({
      where: { id: fileId },
    });

    if (!file) return null;

    return this.serializeAttachmentFileRecord(file);
  }

  /**
   * Find an attachment file by checksum for deduplication.
   * This allows the backend to check if a file already exists before uploading.
   */
  async findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    const file = await this.prismaClient.attachmentFile.findUnique({
      where: { checksum },
    });

    if (!file) return null;

    return this.serializeAttachmentFileRecord(file);
  }

  async deleteAttachmentFile(fileId: string): Promise<void> {
    this.logger?.info(`Deleting attachment file: ${fileId}`);
    const file = await this.prismaClient.attachmentFile.findUnique({
      where: { id: fileId },
    });

    // If there's no DB record, there's nothing to delete
    if (!file) {
      this.logger?.info(`Attachment file ${fileId} not found, nothing to delete`);
      return;
    }

    // First delete the underlying stored file so DB and storage stay in sync
    const manager = this.getAttachmentManager();
    const storageIdentifiers = file.storageIdentifiers as StorageIdentifiers;
    await manager.deleteFileByIdentifiers(storageIdentifiers);

    // Only after successful storage deletion, remove the DB record
    await this.prismaClient.attachmentFile.delete({
      where: { id: fileId },
    });
    this.logger?.info(`Attachment file ${fileId} deleted successfully`);
  }

  async getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
    const orphanedFiles = await this.prismaClient.attachmentFile.findMany({
      where: {
        notificationAttachments: { none: {} },
      },
    });

    return orphanedFiles.map((file) => this.serializeAttachmentFileRecord(file));
  }

  async getAttachments(
    notificationId: Config['NotificationIdType'],
  ): Promise<StoredAttachment[]> {
    const attachments = await this.prismaClient.notificationAttachment.findMany({
      where: { notificationId },
      include: { attachmentFile: true },
    });

    this.getAttachmentManager(); // Validate attachment manager exists

    return attachments.map((att) => this.serializeStoredAttachment(att));
  }

  async deleteNotificationAttachment(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void> {
    const result = await this.prismaClient.notificationAttachment.deleteMany({
      where: {
        id: attachmentId,
        notificationId,
      },
    });

    if (result.count === 0) {
      throw new Error(
        `Attachment ${attachmentId} not found for notification ${notificationId}`,
      );
    }
  }

  async filterNotifications(
    filter: NotificationFilter<Config>,
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    const where = this.convertNotificationFilterToPrismaWhere(filter);
    const notifications = await this.prismaClient.notification.findMany({
      where,
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  /**
   * Process and store attachments for a notification within a transaction.
   * Handles both new file uploads and references to existing files.
   * Uses attachmentManager for checksum calculation and storage operations.
   * @private
   */
  private async processAndStoreAttachmentsInTransaction(
    tx: NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
    notificationId: Config['NotificationIdType'],
    attachments: NotificationAttachment[],
  ): Promise<void> {
    this.getAttachmentManager(); // Validate attachment manager exists

    // Process each attachment
    for (const att of attachments) {
      if (isAttachmentReference(att)) {
        // Reference existing file - just create the notification link
        this.logger?.info(`Linking existing attachment file ${att.fileId} to notification ${notificationId}`);
        const fileRecord = await this.getAttachmentFileInTransaction(tx, att.fileId);
        if (!fileRecord) {
          throw new Error(`Referenced file ${att.fileId} not found`);
        }
        await this.createNotificationAttachmentLinkInTransaction(
          tx,
          notificationId,
          att.fileId,
          att.description,
        );
      } else {
        // Upload new file with deduplication
        this.logger?.info(`Uploading new attachment file for notification ${notificationId}`);
        const fileRecord = await this.getOrCreateFileRecordForUploadInTransaction(tx, att);
        await this.createNotificationAttachmentLinkInTransaction(
          tx,
          notificationId,
          fileRecord.id,
          att.description,
        );
      }
    }
  }

  /**
   * Serialize a Prisma attachment file model to AttachmentFileRecord
   * @private
   */
  private serializeAttachmentFileRecord(file: PrismaAttachmentFileModel): AttachmentFileRecord {
    return {
      id: file.id,
      filename: file.filename,
      contentType: file.contentType,
      size: file.size,
      checksum: file.checksum,
      storageIdentifiers: file.storageIdentifiers as StorageIdentifiers,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * Serialize a Prisma notification attachment model to StoredAttachment
   * @private
   */
  private serializeStoredAttachment(
    attachment: PrismaNotificationAttachmentModel,
  ): StoredAttachment {
    const manager = this.getAttachmentManager();

    if (!attachment.attachmentFile) {
      throw new Error('AttachmentFile is required to reconstruct stored attachment');
    }

    const fileRecord = this.serializeAttachmentFileRecord(attachment.attachmentFile);
    const attachmentFile = manager.reconstructAttachmentFile(fileRecord.storageIdentifiers);

    return {
      id: attachment.id,
      fileId: attachment.fileId,
      filename: fileRecord.filename,
      contentType: fileRecord.contentType,
      size: fileRecord.size,
      checksum: fileRecord.checksum,
      createdAt: attachment.createdAt,
      file: attachmentFile,
      description: attachment.description ?? undefined,
      storageMetadata: fileRecord.storageIdentifiers,
    };
  }
}

export class PrismaNotificationBackendFactory<Config extends BaseNotificationTypeConfig> {
  create<
    Client extends NotificationPrismaClientInterface<
      Config['NotificationIdType'],
      Config['UserIdType']
    >,
  >(prismaClient: Client, attachmentManager?: BaseAttachmentManager) {
    return new PrismaNotificationBackend<Client, Config>(prismaClient, attachmentManager);
  }
}

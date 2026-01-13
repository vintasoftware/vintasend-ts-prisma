import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { InputJsonValue, JsonValue } from 'vintasend/dist/types/json-values';
import type {
  AnyNotificationInput,
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
} from 'vintasend/dist/types/attachment';
import type { BaseAttachmentManager } from 'vintasend/dist/services/attachment-manager/base-attachment-manager';

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
  storageMetadata: JsonValue;
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
  attachmentFile: PrismaAttachmentFileModel;
}

export interface NotificationPrismaClientInterface<NotificationIdType, UserIdType> {
  notification: {
    findMany(args: {
      where?: {
        status?: NotificationStatus | { not: NotificationStatus };
        sendAfter?: { lte: Date } | null;
        userId?: UserIdType | null;
        readAt?: null;
        emailOrPhone?: string | { not: null };
      };
      skip?: number;
      take?: number;
      include?: {
        user?: boolean;
        attachments?: boolean | { include: { attachmentFile: boolean } };
      };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>[]>;
    create(args: {
      data: BaseNotificationCreateInput<UserIdType>;
      include?: {
        user?: boolean;
        attachments?: boolean | { include: { attachmentFile: boolean } };
      };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>>;
    createMany(args: {
      data: BaseNotificationCreateInput<UserIdType>[];
    }): Promise<NotificationIdType[]>;
    update(args: {
      where: { id: NotificationIdType };
      data: Partial<BaseNotificationUpdateInput<UserIdType>>;
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
        storageMetadata: InputJsonValue;
      };
    }): Promise<PrismaAttachmentFileModel>;
    delete(args: {
      where: { id: string };
    }): Promise<PrismaAttachmentFileModel>;
    findMany(args?: {
      where?: {
        notificationAttachments?: { none: object };
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

// this type assumes the passed object is entirely optional
type AtLeast<O extends object, K extends string> = NoExpand<
  O extends unknown
    ?
        | (K extends keyof O ? { [P in K]: O[P] } & O : O)
        | ({ [P in keyof O as P extends K ? K : never]-?: O[P] } & O)
    : never
>;

export interface BaseNotificationCreateInput<UserIdType> {
  // Regular notification (with user) - make user optional for one-off notifications
  user?: {
    connect?: AtLeast<
      {
        id?: UserIdType;
        email?: string;
      },
      'id' | 'email'
    >;
  };
  userId?: UserIdType | null; // Allow explicitly setting userId to null for one-off notifications
  // One-off notification fields (when user is not provided)
  emailOrPhone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
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
}

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
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      // Serialize attachments if present
      attachments: notification.attachments
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
    notification: AnyNotificationInput<Config> | Omit<AnyNotificationInput<Config>, 'id'>,
  ): BaseNotificationCreateInput<Config['UserIdType']> {
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
    };

    if (isOneOff) {
      return {
        ...base,
        userId: null,
        emailOrPhone: 'emailOrPhone' in notification ? notification.emailOrPhone : '',
        firstName: ('firstName' in notification ? notification.firstName : null) ?? null,
        lastName: ('lastName' in notification ? notification.lastName : null) ?? null,
        status: NotificationStatusEnum.PENDING_SEND,
      };
    }

    // At this point we know hasUserId is true, so userId exists and is not null
    const userId = ('userId' in notification ? notification.userId : null) as Config['UserIdType'];
    return {
      ...base,
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
  ): BaseNotificationCreateInput<Config['UserIdType']> {
    return this.buildCreateData(notification);
  }

  /**
   * Build one-off notification data for creation
   */
  private buildOneOffNotificationData(
    notification: OneOffNotificationInput<Config>,
  ): BaseNotificationCreateInput<Config['UserIdType']> {
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

    return data;
  }

  deserializeNotification(
    notification: AnyNotificationInput<Config> | Omit<AnyNotificationInput<Config>, 'id'>,
  ): BaseNotificationCreateInput<Config['UserIdType']> {
    return this.buildCreateData(notification);
  }

  deserializeNotificationForUpdate(
    notification: Partial<Notification<Config>>,
  ): Partial<Parameters<typeof this.prismaClient.notification.update>[0]['data']> {
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
    } as Partial<Parameters<typeof this.prismaClient.notification.update>[0]['data']>;
  }

  async getAllPendingNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: { status: NotificationStatusEnum.PENDING_SEND },
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getPendingNotifications(
    page = 0,
    pageSize = 100,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: NotificationStatusEnum.PENDING_SEND,
        sendAfter: null,
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getAllFutureNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: { not: NotificationStatusEnum.PENDING_SEND },
        sendAfter: { lte: new Date() },
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
        sendAfter: { lte: new Date() },
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
        sendAfter: {
          lte: new Date(),
        },
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
          lte: new Date(),
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
    const { attachments, ...notificationData } = notification;

    const created = await this.prismaClient.notification.create({
      data: this.deserializeRegularNotification(notificationData as NotificationInput<Config>),
      include: {
        attachments: {
          include: {
            attachmentFile: true,
          },
        },
      },
    });

    // Process attachments if provided
    if (attachments && attachments.length > 0) {
      await this.processAndStoreAttachments(created.id, attachments);
      // Re-fetch notification with attachments
      const withAttachments = await this.prismaClient.notification.findUnique({
        where: { id: created.id },
        include: {
          attachments: {
            include: {
              attachmentFile: true,
            },
          },
        },
      });
      if (withAttachments) {
        return this.serializeRegularNotification(withAttachments);
      }
    }

    return this.serializeRegularNotification(created);
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
    const { attachments, ...notificationData } = notification;

    const created = await this.prismaClient.notification.create({
      data: this.buildOneOffNotificationData(notificationData as OneOffNotificationInput<Config>),
      include: {
        attachments: {
          include: {
            attachmentFile: true,
          },
        },
      },
    });

    // Process attachments if provided
    if (attachments && attachments.length > 0) {
      await this.processAndStoreAttachments(created.id, attachments);
      // Re-fetch notification with attachments
      const withAttachments = await this.prismaClient.notification.findUnique({
        where: { id: created.id },
        include: {
          attachments: {
            include: {
              attachmentFile: true,
            },
          },
        },
      });
      if (withAttachments) {
        return this.serializeOneOffNotification(withAttachments);
      }
    }

    return this.serializeOneOffNotification(created);
  }

  async persistOneOffNotificationUpdate(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    notification: Partial<Omit<DatabaseOneOffNotification<Config>, 'id'>>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    const updated = await this.prismaClient.notification.update({
      where: { id: notificationId as Config['NotificationIdType'] },
      data: this.buildUpdateData(notification),
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
    const updated = await this.prismaClient.notification.update({
      where: this.buildStatusWhere(notificationId, {
        checkStatus: checkIsPending ? NotificationStatusEnum.PENDING_SEND : undefined,
      }),
      data: {
        status: NotificationStatusEnum.SENT,
        sentAt: new Date(),
      },
    });

    return this.serializeAnyNotification(updated);
  }

  async markAsFailed(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsPending = true,
  ): Promise<AnyDatabaseNotification<Config>> {
    const updated = await this.prismaClient.notification.update({
      where: this.buildStatusWhere(notificationId, {
        checkStatus: checkIsPending ? NotificationStatusEnum.PENDING_SEND : undefined,
      }),
      data: {
        status: NotificationStatusEnum.FAILED,
        sentAt: new Date(),
      },
    });

    return this.serializeAnyNotification(updated);
  }

  async markAsRead(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsSent = true,
  ): Promise<DatabaseNotification<Config>> {
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
      include: {
        attachments: {
          include: {
            attachmentFile: true,
          },
        },
      },
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

  async storeContextUsed(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    context: InputJsonValue,
  ): Promise<void> {
    await this.prismaClient.notification.update({
      where: { id: notificationId as Config['NotificationIdType'] },
      data: { contextUsed: context },
    });
  }

  async bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    return this.prismaClient.notification.createMany({
      data: notifications.map((notification) => this.deserializeNotification(notification)),
    });
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
    await this.prismaClient.attachmentFile.delete({
      where: { id: fileId },
    });
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

    if (!this.attachmentManager) {
      throw new Error('AttachmentManager is required to reconstruct attachment files');
    }

    return attachments.map((att) => this.serializeStoredAttachment(att));
  }

  async deleteNotificationAttachment(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void> {
    await this.prismaClient.notificationAttachment.delete({
      where: { id: attachmentId },
    });
  }

  /**
   * Process and store attachments for a notification.
   * Handles both new file uploads and references to existing files.
   * Uses attachmentManager for checksum calculation and storage operations.
   * @private
   */
  private async processAndStoreAttachments(
    notificationId: Config['NotificationIdType'],
    attachments: NotificationAttachment[],
  ): Promise<void> {
    if (!this.attachmentManager) {
      throw new Error('AttachmentManager is required but not provided');
    }

    const { isAttachmentReference } = await import('vintasend/dist/types/attachment');

    // Process each attachment
    for (const att of attachments) {
      if (isAttachmentReference(att)) {
        // Reference existing file - just create the notification link
        const fileRecord = await this.getAttachmentFile(att.fileId);
        if (!fileRecord) {
          throw new Error(`Referenced file ${att.fileId} not found`);
        }

        // Create notification attachment link
        await this.prismaClient.notificationAttachment.create({
          data: {
            notificationId,
            fileId: att.fileId,
            description: att.description ?? null,
          },
        });
      } else {
        // Upload new file with deduplication
        const buffer = await this.attachmentManager.fileToBuffer(att.file);
        const checksum = this.attachmentManager.calculateChecksum(buffer);

        // Check if file already exists in database by checksum
        let fileRecord = await this.findAttachmentFileByChecksum(checksum);

        if (!fileRecord) {
          // Upload new file to storage
          fileRecord = await this.attachmentManager.uploadFile(
            att.file,
            att.filename,
            att.contentType,
          );

          // Store file record in database
          await this.prismaClient.attachmentFile.create({
            data: {
              id: fileRecord.id,
              filename: fileRecord.filename,
              contentType: fileRecord.contentType,
              size: fileRecord.size,
              checksum: fileRecord.checksum,
              storageMetadata: fileRecord.storageMetadata as InputJsonValue,
            },
          });
        }

        // Create notification attachment link
        await this.prismaClient.notificationAttachment.create({
          data: {
            notificationId,
            fileId: fileRecord.id,
            description: att.description ?? null,
          },
        });
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
      storageMetadata: file.storageMetadata as Record<string, unknown>,
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
    if (!this.attachmentManager) {
      throw new Error('AttachmentManager is required to reconstruct attachment files');
    }

    const fileRecord = this.serializeAttachmentFileRecord(attachment.attachmentFile);
    const attachmentFile = this.attachmentManager.reconstructAttachmentFile(
      fileRecord.storageMetadata,
    );

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
      storageMetadata: fileRecord.storageMetadata,
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

import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { InputJsonValue, JsonValue } from 'vintasend/dist/types/json-values';
import type { AnyNotificationInput, DatabaseNotification, Notification, NotificationInput } from 'vintasend/dist/types/notification';
import type { DatabaseOneOffNotification, OneOffNotificationInput, AnyNotification, AnyDatabaseNotification } from 'vintasend/dist/types/notification';
import type { NotificationStatus } from 'vintasend/dist/types/notification-status';
import type { NotificationType } from 'vintasend/dist/types/notification-type';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';

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
      include?: { user?: boolean };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>[]>;
    create(args: {
      data: BaseNotificationCreateInput<UserIdType>;
      include?: { user?: boolean };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>>;
    createMany(args: {
      data: BaseNotificationCreateInput<UserIdType>[];
    }): Promise<NotificationIdType[]>;
    update(args: {
      where: { id: NotificationIdType };
      data: Partial<BaseNotificationUpdateInput<UserIdType>>;
      include?: { user?: boolean };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>>;
    findUnique(args: {
      where: { id: NotificationIdType };
      include?: { user?: boolean };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType> | null>;
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
  Client extends NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
  Config extends BaseNotificationTypeConfig
> implements BaseNotificationBackend<Config> {
  constructor(private prismaClient: Client) { }

  /**
   * Build a where clause for status-based updates
   */
  private buildStatusWhere(
    id: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
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
        > extends Promise<infer T> ? T : ReturnType<
          Config['ContextMap'][keyof Config['ContextMap']]['generate']
        >,
      extraParams: notification.extraParams
        ? convertJsonValueToRecord(notification.extraParams)
        : null,
      adapterUsed: notification.adapterUsed,
      sentAt: notification.sentAt,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
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

    // Handle user / one-off fields
    if ('userId' in notification && notification.userId !== undefined) {
      data.user = { connect: { id: notification.userId } };
    }
    if ('emailOrPhone' in notification && notification.emailOrPhone !== undefined) {
      data.emailOrPhone = notification.emailOrPhone;
    }
    if ('firstName' in notification && notification.firstName !== undefined) {
      data.firstName = notification.firstName;
    }
    if ('lastName' in notification && notification.lastName !== undefined) {
      data.lastName = notification.lastName;
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

  async getAllPendingNotifications(): Promise<
    AnyDatabaseNotification<Config>[]
  > {
    const notifications = await this.prismaClient.notification.findMany({
      where: { status: NotificationStatusEnum.PENDING_SEND },
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getPendingNotifications(page = 0, pageSize = 100): Promise<
    AnyDatabaseNotification<Config>[]
  > {
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

  async getAllFutureNotifications(): Promise<
    AnyDatabaseNotification<Config>[]
  > {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: { not: NotificationStatusEnum.PENDING_SEND },
        sendAfter: { lte: new Date() },
      },
    });

    return notifications.map((n) => this.serializeAnyNotification(n));
  }

  async getFutureNotifications(page = 0, pageSize = 100): Promise<
    AnyDatabaseNotification<Config>[]
  > {
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
    const created = await this.prismaClient.notification.create({
      data: this.deserializeRegularNotification(notification),
    });

    return this.serializeRegularNotification(created);
  }

  async persistNotificationUpdate(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    notification: Partial<
      Omit<DatabaseNotification<Config>, 'id'>
    >,
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
    const created = await this.prismaClient.notification.create({
      data: this.buildOneOffNotificationData(notification),
    });

    return this.serializeOneOffNotification(created);
  }

  async persistOneOffNotificationUpdate(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    notification: Partial<
      Omit<DatabaseOneOffNotification<Config>, 'id'>
    >,
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

  async getOneOffNotifications(page: number, pageSize: number): Promise<DatabaseOneOffNotification<Config>[]> {
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
        status: 'READ',
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
      data: { contextUsed: context }
    });
  }

  async bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    return this.prismaClient.notification.createMany({
      data: notifications.map((notification) =>
        this.deserializeNotification(notification),
      ),
    });
  }
}

export class PrismaNotificationBackendFactory<
  Config extends BaseNotificationTypeConfig
> {
  create<Client extends NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>>(
    prismaClient: Client,
  ) {
    return new PrismaNotificationBackend<Client, Config>(prismaClient);
  }
}

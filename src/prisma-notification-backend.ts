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
   * Serialize a Prisma notification model to either DatabaseNotification or DatabaseOneOffNotification
   * based on whether it has a userId or not
   */
  serializeNotification(
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

  deserializeNotification(
    notification: AnyNotificationInput<Config> | Omit<AnyNotificationInput<Config>, 'id'>,
  ): BaseNotificationCreateInput<Config['UserIdType']> {
    return {
      ...( 'userId' in notification
        ? {
          user: {
            connect: {
              id: notification.userId,
            },
          }
        }
        : {}
      ),
      ...(
        'emailOrPhone' in notification
        ? {
          emailOrPhone: notification.emailOrPhone,
          firstName: notification.firstName,
          lastName: notification.lastName,
        }
        : {}
      ),
      notificationType: notification.notificationType,
      title: notification.title,
      bodyTemplate: notification.bodyTemplate,
      contextName: notification.contextName as string,
      contextParameters: notification.contextParameters as InputJsonValue,
      sendAfter: notification.sendAfter,
      subjectTemplate: notification.subjectTemplate,
      extraParams: notification.extraParams as InputJsonValue,
    };
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

    return notifications.map((n) => this.serializeNotification(n));
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

    return notifications.map((n) => this.serializeNotification(n));
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

    return notifications.map((n) => this.serializeNotification(n));
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

    return notifications.map((n) => this.serializeNotification(n));
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

    // These are guaranteed to be regular notifications (not one-off) since we're filtering by userId
    return notifications.map((n) => this.serializeNotification(n) as DatabaseNotification<Config>);
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

    // These are guaranteed to be regular notifications (not one-off) since we're filtering by userId
    return notifications.map((n) => this.serializeNotification(n) as DatabaseNotification<Config>);
  }

  async getAllNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({});

    return notifications.map((n) => this.serializeNotification(n));
  }

  async getNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map((n) => this.serializeNotification(n));
  }

  async persistNotification(
    notification: NotificationInput<Config>,
  ): Promise<DatabaseNotification<Config>> {
    const created = await this.prismaClient.notification.create({
      data: this.deserializeNotification(notification),
    });

    // persistNotification takes NotificationInput which always has userId, so this is always a regular notification
    return this.serializeNotification(created) as DatabaseNotification<Config>;
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
      data: this.deserializeNotificationForUpdate(notification),
    });

    // persistNotificationUpdate takes Partial<DatabaseNotification> which has userId, so this is always a regular notification
    return this.serializeNotification(updated) as DatabaseNotification<Config>;
  }

  /* One-off notification persistence and query methods */
  async persistOneOffNotification(
    notification: OneOffNotificationInput<Config>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    const created = await this.prismaClient.notification.create({
      data: {
        userId: null, // One-off notifications don't have a userId
        emailOrPhone: notification.emailOrPhone,
        firstName: notification.firstName,
        lastName: notification.lastName,
        notificationType: notification.notificationType,
        title: notification.title,
        bodyTemplate: notification.bodyTemplate,
        contextName: notification.contextName as string,
        contextParameters: notification.contextParameters as InputJsonValue,
        sendAfter: notification.sendAfter,
        subjectTemplate: notification.subjectTemplate,
        extraParams: notification.extraParams as InputJsonValue,
        status: NotificationStatusEnum.PENDING_SEND,
      },
    });

    return this.serializeNotification(created) as DatabaseOneOffNotification<Config>;
  }

  async persistOneOffNotificationUpdate(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    notification: Partial<
      Omit<DatabaseOneOffNotification<Config>, 'id'>
    >,
  ): Promise<DatabaseOneOffNotification<Config>> {
    const data: Partial<BaseNotificationUpdateInput<Config['UserIdType']>> = {
      ...(notification.emailOrPhone !== undefined ? { emailOrPhone: notification.emailOrPhone } : {}),
      ...(notification.firstName !== undefined ? { firstName: notification.firstName } : {}),
      ...(notification.lastName !== undefined ? { lastName: notification.lastName } : {}),
      ...(notification.notificationType !== undefined ? { notificationType: notification.notificationType } : {}),
      ...(notification.title !== undefined ? { title: notification.title } : {}),
      ...(notification.bodyTemplate !== undefined ? { bodyTemplate: notification.bodyTemplate } : {}),
      ...(notification.contextName !== undefined ? { contextName: notification.contextName as string } : {}),
      ...(notification.contextParameters !== undefined ? { contextParameters: notification.contextParameters as InputJsonValue } : {}),
      ...(notification.sendAfter !== undefined ? { sendAfter: notification.sendAfter } : {}),
      ...(notification.subjectTemplate !== undefined ? { subjectTemplate: notification.subjectTemplate } : {}),
    };

    const updated = await this.prismaClient.notification.update({
      where: { id: notificationId as Config['NotificationIdType'] },
      data,
    });

    return this.serializeNotification(updated) as DatabaseOneOffNotification<Config>;
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

    if (!notification || !notification.emailOrPhone || notification.userId !== null) {
      return null;
    }

    return this.serializeNotification(notification) as DatabaseOneOffNotification<Config>;
  }

  async getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<Config>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId: null,
        emailOrPhone: { not: null },
      },
    });

    return notifications.map((n) => this.serializeNotification(n) as DatabaseOneOffNotification<Config>);
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

    return notifications.map((n) => this.serializeNotification(n) as DatabaseOneOffNotification<Config>);
  }

  async markAsSent(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsPending = true,
  ): Promise<AnyDatabaseNotification<Config>> {
    const whereClause: {
      id: Config['NotificationIdType'];
      status?: NotificationStatus;
    } = {
      id: notificationId as Config['NotificationIdType'],
    };

    if (checkIsPending) {
      whereClause.status = NotificationStatusEnum.PENDING_SEND;
    }

    const updated = await this.prismaClient.notification.update({
      where: whereClause,
      data: {
        status: NotificationStatusEnum.SENT,
        sentAt: new Date(),
      },
    });

    return this.serializeNotification(updated);
  }

  async markAsFailed(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsPending = true,
  ): Promise<AnyDatabaseNotification<Config>> {
    const whereClause: {
      id: Config['NotificationIdType'];
      status?: NotificationStatus;
    } = {
      id: notificationId as Config['NotificationIdType'],
    };

    if (checkIsPending) {
      whereClause.status = NotificationStatusEnum.PENDING_SEND;
    }

    const updated = await this.prismaClient.notification.update({
      where: whereClause,
      data: {
        status: NotificationStatusEnum.FAILED,
        sentAt: new Date(),
      },
    });

    return this.serializeNotification(updated);
  }

  async markAsRead(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    checkIsSent = true,
  ): Promise<DatabaseNotification<Config>> {
    const whereClause: {
      id: Config['NotificationIdType'];
      status?: NotificationStatus;
      userId?: { not: null };
    } = {
      id: notificationId as Config['NotificationIdType'],
      userId: { not: null }, // Ensure only regular notifications can be marked as read
    };

    if (checkIsSent) {
      whereClause.status = NotificationStatusEnum.SENT;
    }

    const updated = await this.prismaClient.notification.update({
      where: whereClause,
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    // markAsRead is only for in-app notifications (which are always regular notifications with userId)
    return this.serializeNotification(updated) as DatabaseNotification<Config>;
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

    return this.serializeNotification(notification);
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

    // These are guaranteed to be regular notifications (not one-off) since we're filtering by userId
    return notifications.map((n) => this.serializeNotification(n) as DatabaseNotification<Config>);
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

    // These are guaranteed to be regular notifications (not one-off) since we're filtering by userId
    return notifications.map((n) => this.serializeNotification(n) as DatabaseNotification<Config>);
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

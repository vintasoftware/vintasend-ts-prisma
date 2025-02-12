import type { BaseNotificationBackend } from 'vintasend/src/services/notification-backends/base-notification-backend';
import type { ContextGenerator } from 'vintasend/src/services/notification-context-registry';
import type { InputJsonValue, JsonValue } from 'vintasend/src/types/json-values';
import type { Notification, NotificationInput } from 'vintasend/src/types/notification';
import type { NotificationStatus } from 'vintasend/src/types/notification-status';
import type { NotificationType } from 'vintasend/src/types/notification-type';
import type { Identifier } from 'vintasend/src/types/identifier';

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
  userId: UserId;
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
        userId?: UserIdType;
        readAt?: null;
      };
      skip?: number;
      take?: number;
      include?: { user?: boolean };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>[]>;
    create(args: {
      data: BaseNotificationCreateInput<UserIdType>;
      include?: { user?: boolean };
    }): Promise<PrismaNotificationModel<NotificationIdType, UserIdType>>;
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
  user: {
    connect?: AtLeast<
      {
        id?: UserIdType;
        email?: string;
      },
      'id' | 'email'
    >;
  };
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
  user: {
    connect?: AtLeast<
      {
        id?: UserIdType;
        email?: string;
      },
      'id' | 'email'
    >;
  };
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
  if (typeof jsonValue === 'object' && !Array.isArray(jsonValue) && jsonValue !== null) {
    return jsonValue as Record<string, string | number | boolean>;
  }

  throw new Error('Invalid JSON value. It should be an object.');
}

export class PrismaNotificationBackend<
  Client extends NotificationPrismaClientInterface<NotificationIdType, UserIdType>,
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> implements BaseNotificationBackend<AvailableContexts>
{
  constructor(private prismaClient: Client) {}

  serializeNotification(
    notification: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >,
  ): Notification<AvailableContexts, NotificationIdType, UserIdType> {
    return {
      id: notification.id,
      userId: notification.userId,
      notificationType: notification.notificationType,
      title: notification.title,
      bodyTemplate: notification.bodyTemplate,
      contextName: notification.contextName as keyof AvailableContexts,
      contextParameters: notification.contextParameters
        ? (notification.contextParameters as Parameters<
            AvailableContexts[keyof AvailableContexts]['generate']
          >[0])
        : {},
      sendAfter: notification.sendAfter,
      subjectTemplate: notification.subjectTemplate,
      status: notification.status,
      contextUsed: notification.contextUsed as ReturnType<
        AvailableContexts[keyof AvailableContexts]['generate']
      > | null,
      extraParams: notification.extraParams
        ? convertJsonValueToRecord(notification.extraParams)
        : null,
      adapterUsed: notification.adapterUsed,
      sentAt: notification.sentAt,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  deserializeNotification(
    notification: NotificationInput<AvailableContexts, UserIdType>,
  ): BaseNotificationCreateInput<UserIdType> {
    return {
      user: {
        connect: {
          id: notification.userId,
        },
      },
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
    notification: Partial<Notification<AvailableContexts, NotificationIdType, UserIdType>>,
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
    Notification<AvailableContexts, NotificationIdType, UserIdType>[]
  > {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: NotificationStatusEnum.PENDING_SEND,
      },
    });

    return notifications.map(this.serializeNotification);
  }

  async getPendingNotifications(): Promise<
    Notification<AvailableContexts, NotificationIdType, UserIdType>[]
  > {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: NotificationStatusEnum.PENDING_SEND,
        sendAfter: null,
      },
    });

    return notifications.map(this.serializeNotification);
  }

  async getAllFutureNotifications(): Promise<
    Notification<AvailableContexts, NotificationIdType, UserIdType>[]
  > {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: {
          not: NotificationStatusEnum.PENDING_SEND,
        },
        sendAfter: {
          lte: new Date(),
        },
      },
    });

    return notifications.map(this.serializeNotification);
  }

  async getFutureNotifications(): Promise<
    Notification<AvailableContexts, NotificationIdType, UserIdType>[]
  > {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        status: {
          not: NotificationStatusEnum.PENDING_SEND,
        },
        sendAfter: {
          lte: new Date(),
        },
      },
    });

    return notifications.map(this.serializeNotification);
  }

  async getAllFutureNotificationsFromUser(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>[]> {
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

    return notifications.map(this.serializeNotification);
  }

  async getFutureNotificationsFromUser(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>[]> {
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

    return notifications.map(this.serializeNotification);
  }

  async persistNotification(
    notification: NotificationInput<AvailableContexts, UserIdType>,
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>> {
    return this.serializeNotification(
      await this.prismaClient.notification.create({
        data: this.deserializeNotification(notification),
      }),
    );
  }

  async persistNotificationUpdate(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
    notification: Partial<
      Omit<Notification<AvailableContexts, NotificationIdType, UserIdType>, 'id'>
    >,
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>> {
    return this.serializeNotification(
      await this.prismaClient.notification.update({
        where: {
          id: notificationId,
        },
        data: this.deserializeNotificationForUpdate(notification),
      }),
    );
  }

  async markPendingAsSent(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>> {
    return this.serializeNotification(
      await this.prismaClient.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          status: NotificationStatusEnum.SENT,
          sentAt: new Date(),
        },
      }),
    );
  }

  async markPendingAsFailed(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>> {
    return this.serializeNotification(
      await this.prismaClient.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          status: NotificationStatusEnum.FAILED,
          sentAt: new Date(),
        },
      }),
    );
  }

  async markSentAsRead(
    notificationId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['id'],
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>> {
    return this.serializeNotification(
      await this.prismaClient.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      }),
    );
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
    // biome-ignore lint/correctness/noUnusedVariables: <explanation>
    forUpdate: boolean,
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType> | null> {
    const notification = await this.prismaClient.notification.findUnique({
      where: {
        id: notificationId,
      },
    });
    if (!notification) {
      return null;
    }

    return this.serializeNotification(notification);
  }

  async filterAllInAppUnreadNotifications(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId,
        status: 'SENT',
        readAt: null,
      },
    });

    return notifications.map(this.serializeNotification);
  }

  async filterInAppUnreadNotifications(
    userId: NonNullable<
      Awaited<ReturnType<typeof this.prismaClient.notification.findUnique>>
    >['userId'],
    page: number,
    pageSize: number,
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>[]> {
    const notifications = await this.prismaClient.notification.findMany({
      where: {
        userId,
        status: 'SENT',
        readAt: null,
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return notifications.map(this.serializeNotification);
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
      where: {
        id: notificationId,
      },
      data: {
        contextUsed: context,
      },
    });
  }
}

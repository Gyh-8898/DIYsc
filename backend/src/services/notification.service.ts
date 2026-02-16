import { prisma } from '../lib/prisma';

function toNotificationDto(item: any) {
  return {
    id: item.id,
    userId: item.userId,
    title: item.title,
    content: item.content,
    type: item.type,
    bizId: item.bizId || '',
    orderId: item.orderId || '',
    complaintId: item.complaintId || '',
    readAt: item.readAt ? new Date(item.readAt).getTime() : undefined,
    createdAt: new Date(item.createdAt).getTime()
  };
}

export async function listMyNotifications(userId: string, params?: { limit?: number; offset?: number }) {
  const limit = Math.min(100, Math.max(1, Number(params?.limit || 30)));
  const offset = Math.max(0, Number(params?.offset || 0));

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.notification.count({
      where: {
        userId,
        readAt: null
      }
    })
  ]);

  return {
    list: rows.map(toNotificationDto),
    unreadCount
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  return { success: true };
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  return { success: true };
}

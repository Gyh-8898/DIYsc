import { prisma } from '../lib/prisma';

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDayStart(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildDayRange(days: number) {
  const totalDays = Math.max(1, Math.min(30, Number(days || 7)));
  const today = getDayStart(new Date());
  const list: Date[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    list.push(day);
  }
  return list;
}

function sumMoney(values: number[]) {
  return Number(values.reduce((sum, item) => sum + Number(item || 0), 0).toFixed(2));
}

function hasAddOnItem(itemsRaw: string | null | undefined) {
  try {
    const list = JSON.parse(String(itemsRaw || '[]')) as Array<Record<string, unknown>>;
    return Array.isArray(list) && list.some((item) => typeof item?.addOnId === 'string' && String(item.addOnId).trim().length > 0);
  } catch (_error) {
    return false;
  }
}

export async function trackEvent(payload: {
  userId?: string;
  eventType: string;
  page?: string;
  data?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  if (!payload.eventType) {
    return { success: false };
  }

  await prisma.analyticsEvent.create({
    data: {
      userId: payload.userId,
      eventType: payload.eventType,
      page: payload.page || '',
      payload: JSON.stringify(payload.data || {}),
      ip: payload.ip || '',
      userAgent: payload.userAgent || ''
    }
  });

  return { success: true };
}

export async function getAnalyticsOverview(options?: { days?: number }) {
  const days = Math.max(1, Math.min(30, Number(options?.days || 7)));
  const now = new Date();
  const dayRange = buildDayRange(days);
  const rangeStart = dayRange[0];
  const todayStart = getDayStart(now);

  const [
    usersInRange,
    totalUsers,
    ordersInRange,
    totalOrders,
    withdrawalsInRange,
    pendingWithdrawals,
    totalWithdrawals,
    complaintsToday,
    complaintsInRange,
    events24h,
    orderStats,
    issuedCouponsInRange,
    usedCouponsInRange
  ] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { id: true, createdAt: true }
    }),
    prisma.user.count(),
    prisma.order.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        payAmount: true,
        paidAt: true,
        shippedAt: true,
        items: true,
        expiresAt: true,
        cancelledAt: true
      }
    }),
    prisma.order.count(),
    prisma.withdrawalRequest.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true }
    }),
    prisma.withdrawalRequest.count({ where: { status: 'pending' } }),
    prisma.withdrawalRequest.count(),
    prisma.complaint.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.complaint.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true }
    }),
    prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 3600 * 1000) }
      },
      _count: { eventType: true }
    }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { status: true }
    }),
    prisma.userCoupon.count({
      where: {
        obtainedAt: { gte: rangeStart }
      }
    }),
    prisma.userCoupon.count({
      where: {
        usedAt: { gte: rangeStart }
      }
    })
  ]);

  const newUsersToday = usersInRange.filter((item) => item.createdAt >= todayStart).length;
  const ordersTodayRows = ordersInRange.filter((item) => item.createdAt >= todayStart);
  const ordersToday = ordersTodayRows.length;

  const paidOrdersInRange = ordersInRange.filter((item) => Boolean(item.paidAt));
  const paidTodayRows = paidOrdersInRange.filter((item) => item.paidAt && item.paidAt >= todayStart);

  const salesToday = sumMoney(paidTodayRows.map((item) => Number(item.payAmount || 0)));
  const salesTotal = Number(
    (
      (
        await prisma.order.aggregate({
          _sum: { payAmount: true },
          where: { paidAt: { not: null } }
        })
      )._sum.payAmount || 0
    ).toFixed(2)
  );

  const shippedToday = ordersInRange.filter((item) => item.shippedAt && item.shippedAt >= todayStart).length;
  const shippedTotal = await prisma.order.count({ where: { shippedAt: { not: null } } });

  const refundRequestedCount = await prisma.order.count({ where: { status: 'refund_requested' } });
  const refundRate = totalOrders > 0 ? Number((refundRequestedCount / totalOrders).toFixed(4)) : 0;

  const pendingPaymentOrderCount = ordersInRange.filter((item) => item.status === 'pending_payment').length;
  const timeoutCancelledCount = ordersInRange.filter((item) => {
    if (item.status !== 'cancelled') return false;
    if (!item.expiresAt || !item.cancelledAt) return false;
    return item.cancelledAt.getTime() >= item.expiresAt.getTime();
  }).length;
  const pendingPaymentTimeoutRate =
    pendingPaymentOrderCount > 0 ? Number((timeoutCancelledCount / pendingPaymentOrderCount).toFixed(4)) : 0;

  const addOnOrderCount = ordersInRange.filter((item) => hasAddOnItem(item.items)).length;
  const addOnPenetrationRate =
    ordersInRange.length > 0 ? Number((addOnOrderCount / ordersInRange.length).toFixed(4)) : 0;

  const couponRedemptionRate =
    issuedCouponsInRange > 0 ? Number((usedCouponsInRange / issuedCouponsInRange).toFixed(4)) : 0;

  const dayLabels = dayRange.map((day) => toDayKey(day));
  const userMap = new Map<string, number>();
  const orderMap = new Map<string, number>();
  const salesMap = new Map<string, number>();
  const shippedMap = new Map<string, number>();
  const withdrawalMap = new Map<string, number>();
  const complaintMap = new Map<string, number>();

  for (const item of usersInRange) {
    const key = toDayKey(item.createdAt);
    userMap.set(key, Number(userMap.get(key) || 0) + 1);
  }

  for (const item of ordersInRange) {
    const createdKey = toDayKey(item.createdAt);
    orderMap.set(createdKey, Number(orderMap.get(createdKey) || 0) + 1);

    if (item.paidAt) {
      const paidKey = toDayKey(item.paidAt);
      salesMap.set(paidKey, Number((salesMap.get(paidKey) || 0) + Number(item.payAmount || 0)));
    }

    if (item.shippedAt) {
      const shippedKey = toDayKey(item.shippedAt);
      shippedMap.set(shippedKey, Number(shippedMap.get(shippedKey) || 0) + 1);
    }
  }

  for (const item of withdrawalsInRange) {
    const key = toDayKey(item.createdAt);
    withdrawalMap.set(key, Number(withdrawalMap.get(key) || 0) + 1);
  }

  for (const item of complaintsInRange) {
    const key = toDayKey(item.createdAt);
    complaintMap.set(key, Number(complaintMap.get(key) || 0) + 1);
  }

  return {
    rangeDays: days,
    kpis: {
      newUsersToday,
      totalUsers,
      ordersToday,
      totalOrders,
      salesToday,
      salesTotal,
      shippedToday,
      shippedTotal,
      pendingWithdrawals,
      totalWithdrawals,
      complaintsToday,
      refundRate,
      pendingPaymentTimeoutRate,
      addOnPenetrationRate,
      couponRedemptionRate
    },
    trends: {
      labels: dayLabels,
      newUsers: dayLabels.map((key) => Number(userMap.get(key) || 0)),
      orders: dayLabels.map((key) => Number(orderMap.get(key) || 0)),
      sales: dayLabels.map((key) => Number(Number(salesMap.get(key) || 0).toFixed(2))),
      shipped: dayLabels.map((key) => Number(shippedMap.get(key) || 0)),
      withdrawals: dayLabels.map((key) => Number(withdrawalMap.get(key) || 0)),
      complaints: dayLabels.map((key) => Number(complaintMap.get(key) || 0))
    },
    events24h,
    orderStats,
    complaints24h: complaintsToday,
    refundRate
  };
}

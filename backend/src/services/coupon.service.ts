import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

const USER_COUPON_STATUS = {
  available: 'available',
  used: 'used',
  expired: 'expired'
} as const;

function toCouponDto(item: any) {
  return {
    id: item.id,
    templateId: item.templateId,
    status: item.status,
    obtainedAt: new Date(item.obtainedAt).getTime(),
    usedAt: item.usedAt ? new Date(item.usedAt).getTime() : undefined,
    orderId: item.orderId || '',
    template: {
      id: item.template.id,
      name: item.template.name,
      description: item.template.description || '',
      discountType: item.template.discountType,
      discountValue: Number(item.template.discountValue),
      minAmount: Number(item.template.minAmount),
      startAt: new Date(item.template.startAt).getTime(),
      endAt: new Date(item.template.endAt).getTime()
    }
  };
}

function toTemplateDto(item: any) {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    discountType: item.discountType,
    discountValue: Number(item.discountValue),
    minAmount: Number(item.minAmount),
    totalCount: item.totalCount,
    issuedCount: item.issuedCount,
    perUserLimit: item.perUserLimit,
    status: item.status,
    startAt: new Date(item.startAt).getTime(),
    endAt: new Date(item.endAt).getTime(),
    createdAt: new Date(item.createdAt).getTime()
  };
}

export async function listUserCoupons(userId: string) {
  const list = await prisma.userCoupon.findMany({
    where: {
      userId
    },
    include: {
      template: true
    },
    orderBy: {
      obtainedAt: 'desc'
    }
  });

  const now = Date.now();
  for (const coupon of list) {
    if (coupon.status === USER_COUPON_STATUS.available && coupon.template.endAt.getTime() < now) {
      await prisma.userCoupon.update({
        where: { id: coupon.id },
        data: { status: USER_COUPON_STATUS.expired }
      });
      coupon.status = USER_COUPON_STATUS.expired;
    }
  }

  return list.map(toCouponDto);
}

export async function listCouponTemplates(activeOnly = true) {
  const now = new Date();
  const templates = await prisma.couponTemplate.findMany({
    where: activeOnly
      ? {
          status: 1,
          startAt: { lte: now },
          endAt: { gte: now }
        }
      : undefined,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return templates.map(toTemplateDto);
}

export async function claimCoupon(userId: string, templateId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const template = await tx.couponTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      throw new AppError(80001, '优惠券模板不存在', 404);
    }

    const now = new Date();
    if (template.status !== 1 || template.startAt > now || template.endAt < now) {
      throw new AppError(80002, '优惠券模板不可用', 400);
    }

    if (template.totalCount > 0 && template.issuedCount >= template.totalCount) {
      throw new AppError(80003, '优惠券库存不足', 400);
    }

    const claimedCount = await tx.userCoupon.count({
      where: {
        userId,
        templateId
      }
    });

    if (claimedCount >= template.perUserLimit) {
      throw new AppError(80004, '已达到领取上限', 400);
    }

    const coupon = await tx.userCoupon.create({
      data: {
        userId,
        templateId,
        status: USER_COUPON_STATUS.available
      },
      include: {
        template: true
      }
    });

    await tx.couponTemplate.update({
      where: { id: templateId },
      data: {
        issuedCount: { increment: 1 }
      }
    });

    return coupon;
  });

  return toCouponDto(result);
}

export async function createCouponTemplate(payload: {
  name: string;
  description?: string;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  minAmount?: number;
  totalCount?: number;
  perUserLimit?: number;
  status?: number;
  startAt: number;
  endAt: number;
}) {
  const created = await prisma.couponTemplate.create({
    data: {
      name: payload.name,
      description: payload.description || '',
      discountType: payload.discountType,
      discountValue: Number(payload.discountValue),
      minAmount: Number(payload.minAmount) || 0,
      totalCount: Number(payload.totalCount) || 0,
      perUserLimit: Number(payload.perUserLimit) || 1,
      status: payload.status ?? 1,
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt)
    }
  });

  return toTemplateDto(created);
}

export async function updateCouponTemplate(
  templateId: string,
  payload: Partial<{
    name: string;
    description: string;
    discountType: 'fixed' | 'percent';
    discountValue: number;
    minAmount: number;
    totalCount: number;
    perUserLimit: number;
    status: number;
    startAt: number;
    endAt: number;
  }>
) {
  const existing = await prisma.couponTemplate.findUnique({ where: { id: templateId } });
  if (!existing) {
    throw new AppError(80005, '优惠券模板不存在', 404);
  }

  const updated = await prisma.couponTemplate.update({
    where: { id: templateId },
    data: {
      name: payload.name ?? existing.name,
      description: payload.description ?? existing.description,
      discountType: payload.discountType ?? existing.discountType,
      discountValue: payload.discountValue ?? existing.discountValue,
      minAmount: payload.minAmount ?? existing.minAmount,
      totalCount: payload.totalCount ?? existing.totalCount,
      perUserLimit: payload.perUserLimit ?? existing.perUserLimit,
      status: payload.status ?? existing.status,
      startAt: payload.startAt ? new Date(payload.startAt) : existing.startAt,
      endAt: payload.endAt ? new Date(payload.endAt) : existing.endAt
    }
  });

  return toTemplateDto(updated);
}

export async function issueCouponsToUsers(payload: {
  templateId: string;
  mode: 'specific' | 'all' | 'level';
  userIds?: string[];
  levelId?: number;
}) {
  const template = await prisma.couponTemplate.findUnique({ where: { id: payload.templateId } });
  if (!template) {
    throw new AppError(80006, '优惠券模板不存在', 404);
  }

  let targetUsers: Array<{ id: string }> = [];
  if (payload.mode === 'specific') {
    const ids = Array.isArray(payload.userIds) ? payload.userIds.map((item) => String(item || '').trim()).filter(Boolean) : [];
    if (ids.length === 0) {
      throw new AppError(80007, '请选择目标用户', 400);
    }
    targetUsers = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true }
    });
  } else if (payload.mode === 'level') {
    const levelId = Number(payload.levelId || 0);
    targetUsers = await prisma.user.findMany({
      where: { levelId: levelId > 0 ? levelId : undefined },
      select: { id: true }
    });
  } else {
    targetUsers = await prisma.user.findMany({
      select: { id: true }
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    let issued = 0;
    let skipped = 0;
    const now = new Date();

    let latestTemplate = await tx.couponTemplate.findUnique({ where: { id: payload.templateId } });
    if (!latestTemplate) throw new AppError(80006, '优惠券模板不存在', 404);

    for (const user of targetUsers) {
      latestTemplate = await tx.couponTemplate.findUnique({ where: { id: payload.templateId } });
      if (!latestTemplate) throw new AppError(80006, '优惠券模板不存在', 404);

      if (latestTemplate.status !== 1 || latestTemplate.startAt > now || latestTemplate.endAt < now) {
        skipped += 1;
        continue;
      }

      if (latestTemplate.totalCount > 0 && latestTemplate.issuedCount >= latestTemplate.totalCount) {
        skipped += 1;
        continue;
      }

      const userIssuedCount = await tx.userCoupon.count({
        where: {
          userId: user.id,
          templateId: payload.templateId
        }
      });
      if (userIssuedCount >= latestTemplate.perUserLimit) {
        skipped += 1;
        continue;
      }

      await tx.userCoupon.create({
        data: {
          userId: user.id,
          templateId: payload.templateId,
          status: USER_COUPON_STATUS.available
        }
      });

      await tx.couponTemplate.update({
        where: { id: payload.templateId },
        data: { issuedCount: { increment: 1 } }
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'coupon',
          title: '收到新优惠券',
          content: `您收到一张优惠券：${latestTemplate.name}`
        }
      });

      issued += 1;
    }

    return {
      requested: targetUsers.length,
      issued,
      skipped
    };
  });

  return result;
}

export async function getCouponIssueStats() {
  const [templates, grouped] = await Promise.all([
    prisma.couponTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    }),
    prisma.userCoupon.groupBy({
      by: ['templateId', 'status'],
      _count: { status: true }
    })
  ]);

  const statsMap = new Map<string, { used: number; available: number; expired: number }>();
  for (const row of grouped) {
    const existing = statsMap.get(row.templateId) || { used: 0, available: 0, expired: 0 };
    if (row.status === 'used') existing.used += row._count.status;
    else if (row.status === 'expired') existing.expired += row._count.status;
    else existing.available += row._count.status;
    statsMap.set(row.templateId, existing);
  }

  const templateStats = templates.map((tpl) => {
    const stat = statsMap.get(tpl.id) || { used: 0, available: 0, expired: 0 };
    const totalIssued = Number(tpl.issuedCount || 0);
    const used = Number(stat.used || 0);
    return {
      templateId: tpl.id,
      templateName: tpl.name,
      issuedCount: totalIssued,
      usedCount: used,
      availableCount: Number(stat.available || 0),
      expiredCount: Number(stat.expired || 0),
      usageRate: totalIssued > 0 ? Number((used / totalIssued).toFixed(4)) : 0
    };
  });

  const totalIssued = templateStats.reduce((sum, item) => sum + item.issuedCount, 0);
  const totalUsed = templateStats.reduce((sum, item) => sum + item.usedCount, 0);
  const totalAvailable = templateStats.reduce((sum, item) => sum + item.availableCount, 0);
  const totalExpired = templateStats.reduce((sum, item) => sum + item.expiredCount, 0);

  return {
    summary: {
      totalTemplates: templates.length,
      totalIssued,
      totalUsed,
      totalAvailable,
      totalExpired,
      usageRate: totalIssued > 0 ? Number((totalUsed / totalIssued).toFixed(4)) : 0
    },
    templateStats
  };
}



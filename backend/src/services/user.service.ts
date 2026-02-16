import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

function toUserDtoFromModel(
  user: User,
  options?: {
    referrerName?: string;
    orderCount?: number;
  }
) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar || '',
    points: user.points,
    frozenPoints: user.frozenPoints,
    totalSpend: Number(user.totalSpend || 0),
    levelId: user.levelId,
    levelName: user.levelName,
    referralCode: user.referralCode,
    referrerId: user.referrerId || '',
    referrerName: options?.referrerName || '',
    phone: user.phone || '',
    createdAt: new Date(user.createdAt).getTime(),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : new Date(user.createdAt).getTime(),
    orderCount: options?.orderCount ?? 0,
    isDistributor: Boolean(user.referrerId)
  };
}

export async function getUserDtoById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      referrer: {
        select: {
          name: true
        }
      },
      _count: {
        select: {
          orders: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError(30001, '用户不存在', 404);
  }

  return toUserDtoFromModel(user, {
    referrerName: user.referrer?.name || '',
    orderCount: user._count.orders
  });
}

export async function listUsersForAdmin() {
  const users = await prisma.user.findMany({
    include: {
      referrer: {
        select: {
          name: true
        }
      },
      _count: {
        select: {
          orders: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return users.map((user) =>
    toUserDtoFromModel(user, {
      referrerName: user.referrer?.name || '',
      orderCount: user._count.orders
    })
  );
}

export async function getUserAddresses(userId: string) {
  const list = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
  });

  return list.map((item) => ({
    id: item.id,
    userId: item.userId,
    name: item.name,
    phone: item.phone,
    region: item.region,
    detail: item.detail,
    tag: item.tag,
    isDefault: item.isDefault,
    createdAt: new Date(item.createdAt).getTime()
  }));
}

export async function addUserAddress(
  userId: string,
  payload: {
    name: string;
    phone: string;
    region: string;
    detail: string;
    tag?: string;
    isDefault?: boolean;
  }
) {
  return prisma.$transaction(async (tx) => {
    if (payload.isDefault) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const created = await tx.address.create({
      data: {
        userId,
        name: payload.name,
        phone: payload.phone,
        region: payload.region,
        detail: payload.detail,
        tag: payload.tag || 'home',
        isDefault: Boolean(payload.isDefault)
      }
    });

    return {
      id: created.id,
      userId: created.userId,
      name: created.name,
      phone: created.phone,
      region: created.region,
      detail: created.detail,
      tag: created.tag,
      isDefault: created.isDefault,
      createdAt: new Date(created.createdAt).getTime()
    };
  });
}

export async function updateUserAddress(
  userId: string,
  addressId: string,
  payload: {
    name?: string;
    phone?: string;
    region?: string;
    detail?: string;
    tag?: string;
    isDefault?: boolean;
  }
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: {
        id: addressId,
        userId
      }
    });

    if (!existing) {
      throw new AppError(30002, '收货地址不存在', 404);
    }

    if (payload.isDefault) {
      await tx.address.updateMany({
        where: {
          userId
        },
        data: {
          isDefault: false
        }
      });
    }

    const updated = await tx.address.update({
      where: { id: addressId },
      data: {
        name: payload.name ?? existing.name,
        phone: payload.phone ?? existing.phone,
        region: payload.region ?? existing.region,
        detail: payload.detail ?? existing.detail,
        tag: payload.tag ?? existing.tag,
        isDefault: payload.isDefault ?? existing.isDefault
      }
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      phone: updated.phone,
      region: updated.region,
      detail: updated.detail,
      tag: updated.tag,
      isDefault: updated.isDefault,
      createdAt: new Date(updated.createdAt).getTime()
    };
  });
}

export async function deleteUserAddress(userId: string, addressId: string) {
  const existing = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId
    }
  });

  if (!existing) {
    throw new AppError(30003, '收货地址不存在', 404);
  }

  await prisma.address.delete({
    where: {
      id: addressId
    }
  });

  if (existing.isDefault) {
    const fallback = await prisma.address.findFirst({
      where: {
        userId
      },
      orderBy: { createdAt: 'desc' }
    });

    if (fallback) {
      await prisma.address.update({
        where: { id: fallback.id },
        data: { isDefault: true }
      });
    }
  }

  return { success: true };
}

export async function setDefaultAddress(userId: string, addressId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: {
        id: addressId,
        userId
      }
    });

    if (!existing) {
      throw new AppError(30004, '收货地址不存在', 404);
    }

    await tx.address.updateMany({
      where: {
        userId
      },
      data: {
        isDefault: false
      }
    });

    const updated = await tx.address.update({
      where: {
        id: addressId
      },
      data: {
        isDefault: true
      }
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      phone: updated.phone,
      region: updated.region,
      detail: updated.detail,
      tag: updated.tag,
      isDefault: updated.isDefault,
      createdAt: new Date(updated.createdAt).getTime()
    };
  });
}

export async function getPointHistory(userId: string) {
  const logs = await prisma.pointLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    type: log.type,
    amount: log.amount,
    description: log.reason,
    createdAt: new Date(log.createdAt).getTime()
  }));
}

export function generateReferralCode(seed: string) {
  const source = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (source.length >= 8) return source.slice(0, 8);
  const random = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8 - source.length);
  return `${source}${random}`;
}

export function mapRole(role: string): 'admin' | 'user' {
  return role === 'admin' ? 'admin' : 'user';
}



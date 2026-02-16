import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { getAppConfig } from './config.service';

const WITHDRAWAL_STATUS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected'
} as const;

function toWithdrawalDto(item: any) {
  return {
    id: item.id,
    userId: item.userId,
    userName: item.user?.name || '',
    pointsAmount: item.pointsAmount,
    moneyAmount: Number(item.moneyAmount),
    account: item.account,
    status: item.status,
    createdAt: new Date(item.createdAt).getTime(),
    processedAt: item.processedAt ? new Date(item.processedAt).getTime() : undefined,
    rejectReason: item.rejectReason || ''
  };
}

export async function createWithdrawal(userId: string, moneyAmount: number, account: string) {
  const config = await getAppConfig();
  const pointsRate = Number(config.affiliate.pointsToMoneyRate) || 0.01;
  const minPoints = Number(config.affiliate.minWithdrawPoints) || 1000;

  if (!account || !account.trim()) {
    throw new AppError(70001, '提现账号不能为空', 400);
  }
  if (!Number.isFinite(moneyAmount) || moneyAmount <= 0) {
    throw new AppError(70002, '提现金额不合法', 400);
  }

  const pointsAmount = Math.ceil(moneyAmount / pointsRate);
  if (pointsAmount < minPoints) {
    throw new AppError(70003, `最低提现积分为 ${minPoints} 分`, 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(70004, '用户不存在', 404);
    }

    if (user.points < pointsAmount) {
      throw new AppError(70005, '积分不足', 400);
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        points: { decrement: pointsAmount },
        frozenPoints: { increment: pointsAmount }
      }
    });

    const request = await tx.withdrawalRequest.create({
      data: {
        userId,
        pointsAmount,
        moneyAmount,
        account,
        status: WITHDRAWAL_STATUS.pending
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    await tx.pointLog.create({
      data: {
        userId,
        amount: -pointsAmount,
        type: 'freeze',
        reason: `提现申请冻结积分 ${request.id}`,
        bizId: request.id
      }
    });

    return request;
  });

  return toWithdrawalDto(result);
}

export async function listMyWithdrawals(userId: string) {
  const list = await prisma.withdrawalRequest.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return list.map(toWithdrawalDto);
}

export async function listAdminWithdrawals() {
  const list = await prisma.withdrawalRequest.findMany({
    include: {
      user: {
        select: {
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return list.map(toWithdrawalDto);
}

export async function approveWithdrawal(withdrawalId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
    if (!request) {
      throw new AppError(70006, '提现申请不存在', 404);
    }
    if (request.status !== WITHDRAWAL_STATUS.pending) {
      throw new AppError(70007, '提现申请已处理', 400);
    }

    const updated = await tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WITHDRAWAL_STATUS.approved,
        processedAt: new Date()
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    await tx.user.update({
      where: { id: request.userId },
      data: {
        frozenPoints: { decrement: request.pointsAmount }
      }
    });

    await tx.pointLog.create({
      data: {
        userId: request.userId,
        amount: 0,
        type: 'withdraw',
        reason: `提现审核通过 ${request.id}`,
        bizId: request.id
      }
    });

    await tx.notification.create({
      data: {
        userId: request.userId,
        type: 'withdrawal',
        title: '提现审核通过',
        content: `提现申请 ${request.id} 已审核通过`
      }
    });

    return updated;
  });

  return toWithdrawalDto(result);
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
    if (!request) {
      throw new AppError(70008, '提现申请不存在', 404);
    }
    if (request.status !== WITHDRAWAL_STATUS.pending) {
      throw new AppError(70009, '提现申请已处理', 400);
    }

    const updated = await tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WITHDRAWAL_STATUS.rejected,
        processedAt: new Date(),
        rejectReason: reason || '后台驳回'
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    await tx.user.update({
      where: { id: request.userId },
      data: {
        points: { increment: request.pointsAmount },
        frozenPoints: { decrement: request.pointsAmount }
      }
    });

    await tx.pointLog.create({
      data: {
        userId: request.userId,
        amount: request.pointsAmount,
        type: 'unfreeze',
        reason: `提现审核驳回 ${request.id}`,
        bizId: request.id
      }
    });

    await tx.notification.create({
      data: {
        userId: request.userId,
        type: 'withdrawal',
        title: '提现审核驳回',
        content: `提现申请 ${request.id} 已被驳回${reason ? `，原因: ${reason}` : ''}`.trim()
      }
    });

    return updated;
  });

  return toWithdrawalDto(result);
}


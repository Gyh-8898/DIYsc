import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { getAppConfig } from './config.service';

interface ClientBead {
  id?: string;
  name?: string;
  sizeMm?: number;
  price?: number;
  color?: string;
}

interface ClientDesign {
  id?: string;
  name?: string;
  wristSize?: number;
  beads?: ClientBead[];
  totalPrice?: number;
  imageUrl?: string;
}

interface ClientAddOn {
  id?: string;
  quantity?: number;
}

export interface CreateOrderInput {
  userId: string;
  designs: ClientDesign[];
  addOns?: ClientAddOn[];
  addressId?: string;
  shippingAddress?: string;
  remarks?: string;
  couponId?: string;
  pointsToUse?: number;
  clientAmount?: number;
  userIp?: string;
}

export interface PaymentNotifyInput {
  orderId?: string;
  orderNo?: string;
  transactionId?: string;
  paidAt?: string | number;
}

const ORDER_NO_PREFIX = 'ORD';
const ORDER_STATUS = {
  pending_payment: 'pending_payment',
  pending_production: 'pending_production',
  shipped: 'shipped',
  completed: 'completed',
  cancelled: 'cancelled'
} as const;

const RESERVATION_STATUS = {
  reserved: 'reserved',
  consumed: 'consumed',
  released: 'released',
  expired: 'expired'
} as const;

const USER_COUPON_STATUS = {
  available: 'available',
  used: 'used'
} as const;

const COUPON_DISCOUNT_TYPE = {
  fixed: 'fixed',
  percent: 'percent'
} as const;

const COMMISSION_STATUS = {
  settled: 'settled'
} as const;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildOrderNo(): string {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${ORDER_NO_PREFIX}${YYYY}${MM}${DD}${HH}${mm}${ss}${random}`;
}

function parseBeadIdCandidates(rawId: string | undefined): string[] {
  if (!rawId) return [];
  const candidates: string[] = [];
  let current = rawId;
  while (current) {
    candidates.push(current);
    const next = current.replace(/-[^-]+$/, '');
    if (next === current || !next) break;
    current = next;
  }
  return candidates;
}

function getClientDesigns(rawDesigns: unknown): ClientDesign[] {
  if (!Array.isArray(rawDesigns)) return [];
  return rawDesigns.filter((item) => typeof item === 'object' && item !== null) as ClientDesign[];
}

function getClientBeads(rawBeads: unknown): ClientBead[] {
  if (!Array.isArray(rawBeads)) return [];
  return rawBeads.filter((item) => typeof item === 'object' && item !== null) as ClientBead[];
}

function getClientAddOns(rawAddOns: unknown): ClientAddOn[] {
  if (!Array.isArray(rawAddOns)) return [];
  return rawAddOns.filter((item) => typeof item === 'object' && item !== null) as ClientAddOn[];
}

function toOrderDto(order: any) {
  let items: unknown[] = [];
  try {
    items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
  } catch (_error) {
    items = [];
  }
  return {
    id: order.id,
    orderNo: order.orderNo,
    userId: order.userId,
    userName: order.user?.name || '',
    userAvatar: order.user?.avatar || '',
    items,
    totalAmount: Number(order.totalAmount),
    payAmount: Number(order.payAmount),
    status: order.status,
    createdAt: new Date(order.createdAt).getTime(),
    shippingAddress: order.shippingAddress,
    trackingNumber: order.trackingNumber || '',
    carrier: order.carrier || '',
    shippedAt: order.shippedAt ? new Date(order.shippedAt).getTime() : undefined,
    remarks: order.remarks || '',
    couponAmount: Number(order.couponAmount || 0),
    pointsUsed: order.pointsUsed || 0,
    pointsDeductAmount: Number(order.pointsDeductAmount || 0),
    shippingFee: Number(order.shippingFee || 0),
    handworkFee: Number(order.handworkFee || 0)
  };
}

function collectAddOnCountFromOrderItems(orderItemsRaw: unknown): Map<string, number> {
  let parsed: Array<Record<string, unknown>> = [];
  try {
    if (Array.isArray(orderItemsRaw)) {
      parsed = orderItemsRaw as Array<Record<string, unknown>>;
    } else {
      parsed = JSON.parse(String(orderItemsRaw || '[]')) as Array<Record<string, unknown>>;
    }
  } catch (_error) {
    parsed = [];
  }

  const result = new Map<string, number>();
  for (const item of parsed) {
    const addOnId = typeof item?.addOnId === 'string' ? item.addOnId.trim() : '';
    if (!addOnId) continue;
    const count = Math.max(1, Math.floor(Number(item?.count || 0)));
    result.set(addOnId, (result.get(addOnId) || 0) + count);
  }
  return result;
}

async function releaseAddOnStocks(tx: Prisma.TransactionClient, orderItemsRaw: unknown) {
  const addOnCount = collectAddOnCountFromOrderItems(orderItemsRaw);
  if (addOnCount.size === 0) return;

  for (const [addOnId, quantity] of addOnCount.entries()) {
    await tx.addOnProduct.updateMany({
      where: { id: addOnId },
      data: {
        stock: { increment: quantity }
      }
    });
  }
}

async function findCouponForOrder(tx: Prisma.TransactionClient, userId: string, couponId?: string) {
  if (!couponId) return null;
  const coupon = await tx.userCoupon.findFirst({
    where: {
      id: couponId,
      userId,
      status: USER_COUPON_STATUS.available,
      OR: [{ orderId: null }, { orderId: '' }]
    },
    include: {
      template: true
    }
  });
  if (!coupon) {
    throw new AppError(41001, '优惠券不可用', 400);
  }

  const now = new Date();
  if (coupon.template.status !== 1 || coupon.template.startAt > now || coupon.template.endAt < now) {
    throw new AppError(41002, '优惠券已过期', 400);
  }

  return coupon;
}

async function reserveCoupon(tx: Prisma.TransactionClient, couponId: string, userId: string, orderId: string) {
  const result = await tx.userCoupon.updateMany({
    where: {
      id: couponId,
      userId,
      status: USER_COUPON_STATUS.available,
      OR: [{ orderId: null }, { orderId: '' }]
    },
    data: {
      orderId
    }
  });

  if (result.count === 0) {
    throw new AppError(41003, '优惠券已被其他订单锁定', 400);
  }
}

async function unlockCoupon(tx: Prisma.TransactionClient, orderId: string) {
  await tx.userCoupon.updateMany({
    where: {
      orderId,
      status: USER_COUPON_STATUS.available
    },
    data: {
      orderId: null
    }
  });
}

async function markCouponUsed(tx: Prisma.TransactionClient, orderId: string) {
  await tx.userCoupon.updateMany({
    where: {
      orderId,
      status: USER_COUPON_STATUS.available
    },
    data: {
      status: USER_COUPON_STATUS.used,
      usedAt: new Date()
    }
  });
}

async function releaseReservations(tx: Prisma.TransactionClient, orderId: string, status: string) {
  const reservations = await tx.inventoryReservation.findMany({
    where: {
      orderId,
      status: RESERVATION_STATUS.reserved
    }
  });

  for (const reservation of reservations) {
    await tx.bead.update({
      where: { id: reservation.beadId },
      data: {
        stock: { increment: reservation.quantity },
        reservedStock: { decrement: reservation.quantity }
      }
    });
  }

  await tx.inventoryReservation.updateMany({
    where: {
      orderId,
      status: RESERVATION_STATUS.reserved
    },
    data: {
      status,
      releasedAt: new Date()
    }
  });
}

async function consumeReservations(tx: Prisma.TransactionClient, orderId: string) {
  const reservations = await tx.inventoryReservation.findMany({
    where: {
      orderId,
      status: RESERVATION_STATUS.reserved
    }
  });

  for (const reservation of reservations) {
    await tx.bead.update({
      where: { id: reservation.beadId },
      data: {
        reservedStock: { decrement: reservation.quantity }
      }
    });
  }

  await tx.inventoryReservation.updateMany({
    where: {
      orderId,
      status: RESERVATION_STATUS.reserved
    },
    data: {
      status: RESERVATION_STATUS.consumed,
      consumedAt: new Date()
    }
  });
}

async function reserveInventory(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  inventoryCount: Map<string, number>,
  expiresAt: Date
) {
  for (const [beadId, quantity] of inventoryCount.entries()) {
    const updateResult = await tx.bead.updateMany({
      where: {
        id: beadId,
        status: 1,
        stock: { gte: quantity }
      },
      data: {
        stock: { decrement: quantity },
        reservedStock: { increment: quantity }
      }
    });

    if (updateResult.count === 0) {
      throw new AppError(42001, `Insufficient stock for bead ${beadId}`, 400);
    }

    await tx.inventoryReservation.create({
      data: {
        orderId,
        userId,
        beadId,
        quantity,
        status: RESERVATION_STATUS.reserved,
        expiresAt
      }
    });
  }
}

async function findShippingAddress(tx: Prisma.TransactionClient, userId: string, input: CreateOrderInput): Promise<string> {
  const addressId = String(input.addressId || '').trim();
  if (!addressId) {
    throw new AppError(40005, '收货地址不能为空', 400);
  }

  const address = await tx.address.findFirst({
    where: {
      id: addressId,
      userId
    }
  });
  if (!address) {
    throw new AppError(40004, '收货地址不存在', 404);
  }
  return `${address.region} ${address.detail} ${address.name} ${address.phone}`;
}

async function enforceOrderRateLimit(tx: Prisma.TransactionClient, userId: string, userIp?: string) {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const count = await tx.order.count({
    where: {
      userId,
      createdAt: { gte: oneMinuteAgo }
    }
  });

  if (count >= 5) {
    await tx.riskEvent.create({
      data: {
        userId,
        type: 'high_frequency_order',
        level: 'high',
        detail: JSON.stringify({
          count,
          windowSeconds: 60,
          ip: userIp || ''
        })
      }
    });
    throw new AppError(43001, '操作过于频繁，请稍后再试', 429);
  }
}

async function addAnalytics(userId: string, eventType: string, payload: Record<string, unknown>) {
  await prisma.analyticsEvent.create({
    data: {
      userId,
      eventType,
      page: payload.page ? String(payload.page) : undefined,
      payload: JSON.stringify(payload)
    }
  });
}

function resolveClientBead(
  bead: ClientBead,
  byId: Map<string, { id: string; name: string; diameter: number; price: number }> ,
  byNameDiameter: Map<string, { id: string; name: string; diameter: number; price: number }>
) {
  const candidates = parseBeadIdCandidates(bead.id);
  for (const candidate of candidates) {
    const hit = byId.get(candidate);
    if (hit) return hit;
  }

  const beadName = (bead.name || '').trim();
  const diameter = Number(bead.sizeMm);
  if (beadName) {
    if (!Number.isNaN(diameter)) {
      const key = `${beadName.toLowerCase()}::${diameter}`;
      const exact = byNameDiameter.get(key);
      if (exact) return exact;
    }

    const fallback = [...byNameDiameter.values()].find((item) => item.name.toLowerCase() === beadName.toLowerCase());
    if (fallback) return fallback;
  }

  return null;
}

export async function expirePendingOrders() {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: ORDER_STATUS.pending_payment,
      expiresAt: { lt: new Date() }
    },
    select: { id: true }
  });

  for (const order of expiredOrders) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.status !== ORDER_STATUS.pending_payment) return;

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: ORDER_STATUS.cancelled,
          cancelledAt: new Date()
        }
      });

      await releaseReservations(tx, order.id, RESERVATION_STATUS.expired);
      await releaseAddOnStocks(tx, current.items);

      if (current.pointsUsed > 0) {
        await tx.user.update({
          where: { id: current.userId },
          data: {
            points: { increment: current.pointsUsed },
            frozenPoints: { decrement: current.pointsUsed }
          }
        });

        await tx.pointLog.create({
          data: {
            userId: current.userId,
            orderId: current.id,
            amount: current.pointsUsed,
            type: 'unfreeze',
            reason: `订单超时关闭 ${current.orderNo}`
          }
        });
      }

      await unlockCoupon(tx, current.id);
    });
  }
}

export async function createOrder(input: CreateOrderInput) {
  await expirePendingOrders();

  const config = await getAppConfig();
  const designs = getClientDesigns(input.designs);
  const addOns = getClientAddOns(input.addOns);

  if (designs.length === 0) {
    throw new AppError(40001, '订单中没有商品', 400);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  const txResult = await prisma.$transaction(async (tx) => {
    await enforceOrderRateLimit(tx, input.userId, input.userIp);

    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      throw new AppError(40002, '用户不存在', 404);
    }

    const shippingAddress = await findShippingAddress(tx, input.userId, input);

    const beads = await tx.bead.findMany({
      where: { status: 1 },
      select: {
        id: true,
        name: true,
        diameter: true,
        price: true
      }
    });

    const beadById = new Map(beads.map((item) => [item.id, item]));
    const beadByNameDiameter = new Map(
      beads.map((item) => [`${item.name.toLowerCase()}::${item.diameter}`, item])
    );

    const inventoryCount = new Map<string, number>();
    const addOnStockPlans: Array<{ addOnId: string; quantity: number; name: string }> = [];
    const orderItems: Array<{
      name: string;
      description: string;
      price: number;
      count: number;
      imagePreview?: string;
      addOnId?: string;
    }> = [];

    let designsAmountTotal = 0;
    let addOnAmount = 0;

    for (const design of designs) {
      const beadsInDesign = getClientBeads(design.beads);
      if (beadsInDesign.length === 0) {
        throw new AppError(40003, '作品珠子不能为空', 400);
      }

      let singleDesignAmount = 0;
      for (const bead of beadsInDesign) {
        const resolved = resolveClientBead(bead, beadById, beadByNameDiameter);
        if (!resolved) {
          throw new AppError(40006, `作品中存在未知珠子: ${bead.name || bead.id || '未知'}`, 400);
        }

        const current = inventoryCount.get(resolved.id) || 0;
        inventoryCount.set(resolved.id, current + 1);
        singleDesignAmount += Number(resolved.price);
      }

      const roundedDesignAmount = roundMoney(singleDesignAmount);
      designsAmountTotal += roundedDesignAmount;

      orderItems.push({
        name: design.name || 'Custom Design',
        description: `Wrist: ${Number(design.wristSize) || 15}cm | ${beadsInDesign.length} beads`,
        price: roundedDesignAmount,
        count: 1,
        imagePreview: design.imageUrl || ''
      });
    }

    const addOnCount = new Map<string, number>();
    for (const addOn of addOns) {
      const addOnId = typeof addOn.id === 'string' ? addOn.id.trim() : '';
      const quantity = Math.floor(Number(addOn.quantity) || 0);
      if (!addOnId || quantity <= 0) {
        continue;
      }
      addOnCount.set(addOnId, (addOnCount.get(addOnId) || 0) + quantity);
    }

    if (addOnCount.size > 0) {
      const addOnRows = await tx.addOnProduct.findMany({
        where: {
          id: { in: [...addOnCount.keys()] },
          status: 1
        },
        select: {
          id: true,
          name: true,
          price: true,
          image: true,
          stock: true
        }
      });

      if (addOnRows.length !== addOnCount.size) {
        throw new AppError(40007, '加购商品不存在', 400);
      }

      const addOnById = new Map(addOnRows.map((row) => [row.id, row]));

      for (const [addOnId, quantity] of addOnCount.entries()) {
        const addOn = addOnById.get(addOnId);
        if (!addOn) {
          throw new AppError(40007, '加购商品不存在', 400);
        }

        if (Number(addOn.stock) < quantity) {
          throw new AppError(42002, `加购商品库存不足: ${addOn.name}`, 400);
        }

        const linePrice = roundMoney(Number(addOn.price) || 0);
        addOnAmount += roundMoney(linePrice * quantity);
        addOnStockPlans.push({
          addOnId,
          quantity,
          name: addOn.name
        });

        orderItems.push({
          addOnId: addOn.id,
          name: addOn.name,
          description: 'Add-on product',
          price: linePrice,
          count: quantity,
          imagePreview: addOn.image || ''
        });
      }
    }

    const productAmount = roundMoney(designsAmountTotal + addOnAmount);

    const handworkFee = roundMoney((Number(config.business.handworkFee) || 0) * designs.length);
    const amountBeforeShipping = roundMoney(productAmount + handworkFee);
    const shippingFee = amountBeforeShipping >= Number(config.business.freeShippingThreshold)
      ? 0
      : roundMoney(Number(config.business.baseShippingFee) || 0);

    const amountBeforeDiscount = roundMoney(amountBeforeShipping + shippingFee);

    const coupon = await findCouponForOrder(tx, input.userId, input.couponId);
    let couponAmount = 0;

    if (coupon) {
      if (amountBeforeDiscount < coupon.template.minAmount) {
        throw new AppError(41004, `优惠券使用门槛金额为 ${coupon.template.minAmount}`, 400);
      }

      if (coupon.template.discountType === COUPON_DISCOUNT_TYPE.fixed) {
        couponAmount = roundMoney(coupon.template.discountValue);
      } else {
        couponAmount = roundMoney((amountBeforeDiscount * coupon.template.discountValue) / 100);
      }

      couponAmount = Math.min(couponAmount, amountBeforeDiscount);
    }

    const pointsRate = Number(config.affiliate.pointsToMoneyRate) || 0.01;
    let pointsToUse = Math.max(0, Math.floor(Number(input.pointsToUse) || 0));
    pointsToUse = Math.min(pointsToUse, user.points);

    const maxPointsForCurrentAmount = Math.floor((amountBeforeDiscount - couponAmount) / pointsRate);
    pointsToUse = Math.min(pointsToUse, maxPointsForCurrentAmount);

    const pointsDeductAmount = roundMoney(pointsToUse * pointsRate);

    const payAmount = roundMoney(amountBeforeDiscount - couponAmount - pointsDeductAmount);
    const orderNo = buildOrderNo();
    const clientAmount = Number(input.clientAmount);
    if (!Number.isNaN(clientAmount) && Math.abs(clientAmount - payAmount) > 0.01) {
      throw new AppError(43002, '订单金额校验失败', 400);
    }
    const orderItemsJson = JSON.stringify(orderItems);
    const normalizedRemarks = input.remarks || '';

    const duplicateOrder = await tx.order.findFirst({
      where: {
        userId: input.userId,
        status: ORDER_STATUS.pending_payment,
        createdAt: {
          gte: new Date(Date.now() - 30 * 1000)
        },
        expiresAt: {
          gt: now
        },
        items: orderItemsJson,
        payAmount,
        shippingAddress,
        remarks: normalizedRemarks
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (duplicateOrder) {
      await tx.riskEvent.create({
        data: {
          userId: input.userId,
          orderId: duplicateOrder.id,
          type: 'duplicate_order_submit',
          level: 'medium',
          detail: JSON.stringify({
            reusedOrderNo: duplicateOrder.orderNo
          })
        }
      });
      return {
        order: duplicateOrder,
        reused: true
      };
    }

    const createdOrder = await tx.order.create({
      data: {
        orderNo,
        userId: input.userId,
        status: ORDER_STATUS.pending_payment,
        items: orderItemsJson,
        pricingSnapshot: JSON.stringify({
          designAmount: designsAmountTotal,
          addOnAmount,
          productAmount,
          handworkFee,
          shippingFee,
          couponAmount,
          pointsUsed: pointsToUse,
          pointsDeductAmount,
          amountBeforeDiscount,
          amountBeforeShipping,
          algorithmVersion: '2026-02-09'
        }),
        totalAmount: amountBeforeDiscount,
        payAmount,
        couponAmount,
        pointsUsed: pointsToUse,
        pointsDeductAmount,
        shippingFee,
        handworkFee,
        shippingAddress,
        remarks: normalizedRemarks,
        expiresAt
      }
    });

    for (const plan of addOnStockPlans) {
      const stockResult = await tx.addOnProduct.updateMany({
        where: {
          id: plan.addOnId,
          status: 1,
          stock: { gte: plan.quantity }
        },
        data: {
          stock: { decrement: plan.quantity }
        }
      });
      if (stockResult.count === 0) {
        throw new AppError(42002, `加购商品库存不足: ${plan.name}`, 400);
      }
    }

    await reserveInventory(tx, createdOrder.id, input.userId, inventoryCount, expiresAt);

    if (coupon) {
      await reserveCoupon(tx, coupon.id, input.userId, createdOrder.id);
    }

    if (pointsToUse > 0) {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          points: { decrement: pointsToUse },
          frozenPoints: { increment: pointsToUse }
        }
      });

      await tx.pointLog.create({
        data: {
          userId: input.userId,
          orderId: createdOrder.id,
          amount: -pointsToUse,
          type: 'freeze',
          reason: `订单冻结积分 ${orderNo}`
        }
      });
    }

    await tx.notification.create({
      data: {
        userId: input.userId,
        orderId: createdOrder.id,
        type: 'order',
        title: '订单已创建',
        content: `订单 ${orderNo} 已创建，等待付款。`
      }
    });

    return {
      order: createdOrder,
      reused: false
    };
  });

  if (!txResult.reused) {
    await addAnalytics(input.userId, 'order.create', {
      page: 'checkout',
      orderId: txResult.order.id,
      payAmount: Number(txResult.order.payAmount)
    });
  }

  return toOrderDto(
    await prisma.order.findUniqueOrThrow({
      where: { id: txResult.order.id },
      include: { user: { select: { name: true, avatar: true } } }
    })
  );
}

export async function createPaymentParams(userId: string, orderId: string) {
  await expirePendingOrders();
  const config = await getAppConfig();

  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    throw new AppError(50001, '订单不存在', 404);
  }
  if (order.userId !== userId) {
    throw new AppError(50002, '无权限操作', 403);
  }
  if (order.status !== ORDER_STATUS.pending_payment) {
    throw new AppError(50003, '订单当前状态不可支付', 400);
  }
  if (order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
    throw new AppError(50004, '订单支付已超时', 400);
  }

  const paymentConfig = config.integrations?.payment || {
    provider: 'mock',
    enabled: false
  };

  if (!paymentConfig.enabled) {
    throw new AppError(50019, '支付通道已关闭', 400);
  }

  const nonceStr = Math.random().toString(36).slice(2, 18);
  const provider = paymentConfig.provider || 'mock';
  let paymentParams: Record<string, unknown> = {
    provider
  };

  if (provider === 'wechat') {
    const appId = paymentConfig.appId || process.env.WECHAT_APPID || '';
    const mchId = paymentConfig.mchId || process.env.WECHAT_MCH_ID || '';
    const mchKey = paymentConfig.mchKey || process.env.WECHAT_MCH_KEY || '';
    const notifyUrl = paymentConfig.notifyUrl || process.env.WECHAT_NOTIFY_URL || '';

    if (!appId || !mchId || !mchKey || !notifyUrl) {
      throw new AppError(50020, '后台微信支付配置不完整', 400);
    }

    const prepayId = `wx_prepay_${order.orderNo}_${Date.now()}`;
    const signRaw = `${appId}|${mchId}|${order.orderNo}|${nonceStr}|${mchKey}`;
    const paySign = createHash('sha256').update(signRaw).digest('hex');

    paymentParams = {
      provider: 'wechat',
      appId,
      mchId,
      notifyUrl,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr,
      package: `prepay_id=${prepayId}`,
      signType: 'SHA256',
      paySign
    };
  } else if (provider === 'mock') {
    paymentParams = {
      provider: 'mock',
      nonceStr,
      orderNo: order.orderNo
    };
  } else {
    paymentParams = {
      provider,
      nonceStr,
      orderNo: order.orderNo,
      amount: Number(order.payAmount),
      notifyUrl: paymentConfig.notifyUrl || ''
    };
  }

  await prisma.analyticsEvent.create({
    data: {
      userId,
      eventType: 'payment.create',
      page: 'checkout',
      payload: JSON.stringify({
        orderId,
        orderNo: order.orderNo,
        payAmount: order.payAmount,
        provider
      })
    }
  });

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    amount: Number(order.payAmount),
    paymentParams
  };
}

export async function markOrderPaid(input: PaymentNotifyInput) {
  await expirePendingOrders();

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        input.orderId ? { id: input.orderId } : undefined,
        input.orderNo ? { orderNo: input.orderNo } : undefined
      ].filter(Boolean) as Prisma.OrderWhereInput[]
    },
    include: {
      user: true
    }
  });

  if (!order) {
    throw new AppError(50005, '订单不存在', 404);
  }

  if (order.status !== ORDER_STATUS.pending_payment) {
    return toOrderDto(order);
  }

  const config = await getAppConfig();

  const paidOrder = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: order.id },
      include: { user: true }
    });

    if (!current) {
      throw new AppError(50006, '订单不存在', 404);
    }

    if (current.status !== ORDER_STATUS.pending_payment) {
      return current;
    }

    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

    const updated = await tx.order.update({
      where: { id: current.id },
      data: {
        status: ORDER_STATUS.pending_production,
        paidAt
      },
      include: { user: true }
    });

    await consumeReservations(tx, current.id);

    if (updated.pointsUsed > 0) {
      await tx.user.update({
        where: { id: updated.userId },
        data: {
          frozenPoints: { decrement: updated.pointsUsed }
        }
      });

      await tx.pointLog.create({
        data: {
          userId: updated.userId,
          orderId: updated.id,
          amount: 0,
          type: 'redeem',
          reason: `Points consumed for order ${updated.orderNo}`
        }
      });
    }

    const pointsEarned = Math.floor(Number(updated.payAmount) * Number(config.affiliate.pointsPerYuan || 0));
    if (pointsEarned > 0) {
      await tx.user.update({
        where: { id: updated.userId },
        data: {
          points: { increment: pointsEarned },
          totalSpend: { increment: Number(updated.payAmount) }
        }
      });

      await tx.pointLog.create({
        data: {
          userId: updated.userId,
          orderId: updated.id,
          amount: pointsEarned,
          type: 'earn_purchase',
          reason: `Purchase reward for ${updated.orderNo}`
        }
      });
    } else {
      await tx.user.update({
        where: { id: updated.userId },
        data: {
          totalSpend: { increment: Number(updated.payAmount) }
        }
      });
    }

    await markCouponUsed(tx, updated.id);

    if (config.features.enableAffiliate && updated.user.referrerId) {
      const commissionPoints = Math.floor(
        Number(updated.payAmount) *
          Number(config.affiliate.pointsPerYuan || 0) *
          (Number(config.affiliate.commissionRatePercent || 0) / 100)
      );

      if (commissionPoints > 0) {
        await tx.commissionLog.create({
          data: {
            fromUserId: updated.userId,
            toUserId: updated.user.referrerId,
            orderId: updated.id,
            pointsAmount: commissionPoints,
            status: COMMISSION_STATUS.settled,
            settledAt: new Date()
          }
        });

        await tx.user.update({
          where: { id: updated.user.referrerId },
          data: {
            points: { increment: commissionPoints }
          }
        });

        await tx.pointLog.create({
          data: {
            userId: updated.user.referrerId,
            orderId: updated.id,
            amount: commissionPoints,
            type: 'commission',
            reason: `推荐订单佣金 ${updated.orderNo}`
          }
        });
      }
    }

    await tx.notification.create({
      data: {
        userId: updated.userId,
        orderId: updated.id,
        type: 'payment',
        title: '支付成功',
        content: `订单 ${updated.orderNo} 已支付，已进入制作中。`
      }
    });

    return updated;
  });

  await addAnalytics(order.userId, 'payment.success', {
    page: 'checkout',
    orderId: paidOrder.id,
    transactionId: input.transactionId || ''
  });

  return toOrderDto(paidOrder);
}

export async function getOrdersForUser(userId: string) {
  await expirePendingOrders();

  const rows = await prisma.order.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          name: true,
          avatar: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return rows.map(toOrderDto);
}

export async function getOrderById(userId: string, role: string, orderId: string) {
  await expirePendingOrders();

  const row = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          name: true,
          avatar: true
        }
      }
    }
  });

  if (!row) {
    throw new AppError(50007, '订单不存在', 404);
  }

  if (role !== 'admin' && row.userId !== userId) {
    throw new AppError(50008, '无权限操作', 403);
  }

  return toOrderDto(row);
}

export async function cancelOrderByUser(userId: string, orderId: string) {
  const cancelled = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new AppError(50009, '订单不存在', 404);
    }
    if (order.userId !== userId) {
      throw new AppError(50010, '无权限操作', 403);
    }
    if (order.status !== ORDER_STATUS.pending_payment) {
      throw new AppError(50011, '仅待付款订单可取消', 400);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.cancelled,
        cancelledAt: new Date()
      },
      include: { user: true }
    });

    await releaseReservations(tx, orderId, RESERVATION_STATUS.released);
    await releaseAddOnStocks(tx, order.items);

    if (order.pointsUsed > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: order.pointsUsed },
          frozenPoints: { decrement: order.pointsUsed }
        }
      });

      await tx.pointLog.create({
        data: {
          userId,
          orderId,
          amount: order.pointsUsed,
          type: 'unfreeze',
          reason: `Points returned for cancelled order ${order.orderNo}`
        }
      });
    }

    await unlockCoupon(tx, orderId);

    await tx.notification.create({
      data: {
        userId,
        orderId,
        type: 'order',
        title: '订单已取消',
        content: `订单 ${order.orderNo} 已取消。`
      }
    });

    return updated;
  });

  return toOrderDto(cancelled);
}

export async function confirmOrderByUser(userId: string, orderId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new AppError(50012, '订单不存在', 404);
    }
    if (order.userId !== userId) {
      throw new AppError(50013, '无权限操作', 403);
    }
    if (order.status !== ORDER_STATUS.shipped) {
      throw new AppError(50014, '订单当前状态不可确认收货', 400);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.completed,
        completedAt: new Date()
      },
      include: { user: true }
    });

    await tx.logisticsEvent.create({
      data: {
        orderId,
        title: '已签收',
        detail: '买家确认收货',
        location: updated.shippingAddress,
        eventTime: new Date(),
        source: 'user_confirm'
      }
    });

    await tx.notification.create({
      data: {
        userId,
        orderId,
        type: 'order',
        title: '订单已完成',
        content: `订单 ${updated.orderNo} 已完成。`
      }
    });

    return updated;
  });

  return toOrderDto(result);
}

export async function shipOrderByAdmin(orderId: string, carrier: string, trackingNumber: string) {
  const shipped = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new AppError(50015, '订单不存在', 404);
    }

    if (order.status !== ORDER_STATUS.pending_production && order.status !== ORDER_STATUS.shipped) {
      throw new AppError(50016, '订单当前状态不可发货', 400);
    }

    const now = new Date();

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.shipped,
        carrier,
        trackingNumber,
        shippedAt: order.shippedAt || now
      },
      include: {
        user: {
          select: {
            name: true,
            avatar: true
          }
        }
      }
    });

    await tx.logisticsEvent.create({
      data: {
        orderId,
        title: '已发货',
        detail: `${carrier} 已揽收`,
        location: '仓库',
        eventTime: now,
        source: 'admin'
      }
    });

    await tx.notification.create({
      data: {
        userId: updated.userId,
        orderId,
        type: 'shipping',
        title: '订单已发货',
        content: `订单 ${updated.orderNo} 已发货：${carrier}（${trackingNumber}）。`
      }
    });

    return updated;
  });

  return toOrderDto(shipped);
}

interface RemoteLogisticsEvent {
  time: number;
  title: string;
  detail: string;
  location?: string;
}

const KDNIAO_SHIPPER_CODE_MAP: Record<string, string> = {
  顺丰速运: 'SF',
  中通快递: 'ZTO',
  圆通速递: 'YTO',
  韵达快递: 'YD',
  EMS: 'EMS',
  京东物流: 'JD',
  极兔速递: 'JTSD'
};

async function tryFetchKuaidi100Events(carrier: string, trackingNumber: string): Promise<RemoteLogisticsEvent[]> {
  const endpoint = `https://www.kuaidi100.com/query?type=${encodeURIComponent(carrier)}&postid=${encodeURIComponent(
    trackingNumber
  )}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    status?: string;
    data?: Array<{ ftime?: string; context?: string }>;
  };

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows
    .map((row) => {
      const ts = row?.ftime ? Date.parse(row.ftime) : Date.now();
      return {
        time: Number.isFinite(ts) ? ts : Date.now(),
        title: '物流更新',
        detail: String(row?.context || ''),
        location: ''
      };
    })
    .filter((row) => row.detail);
}

async function tryFetchKdniaoEvents(
  logisticsConfig: {
    companyId?: string;
    apiKey?: string;
    apiSecret?: string;
  },
  carrier: string,
  trackingNumber: string
): Promise<RemoteLogisticsEvent[]> {
  const eBusinessID = String(logisticsConfig.companyId || '').trim();
  const appKey = String(logisticsConfig.apiKey || '').trim();
  if (!eBusinessID || !appKey) {
    return [];
  }

  const shipperCode = KDNIAO_SHIPPER_CODE_MAP[carrier] || carrier;
  const requestData = JSON.stringify({
    ShipperCode: shipperCode,
    LogisticCode: trackingNumber
  });
  const dataSignRaw = createHash('md5').update(`${requestData}${appKey}`, 'utf8').digest('hex');
  const dataSign = encodeURIComponent(Buffer.from(dataSignRaw).toString('base64'));
  const body = new URLSearchParams({
    RequestData: requestData,
    EBusinessID: eBusinessID,
    RequestType: '1002',
    DataSign: dataSign,
    DataType: '2'
  });

  const response = await fetch('https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString()
  });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    Success?: boolean;
    Traces?: Array<{
      AcceptTime?: string;
      AcceptStation?: string;
      Location?: string;
    }>;
  };
  if (!payload?.Success) {
    return [];
  }

  const traces = Array.isArray(payload.Traces) ? payload.Traces : [];
  return traces
    .map((trace) => {
      const ts = trace?.AcceptTime ? Date.parse(trace.AcceptTime) : Date.now();
      return {
        time: Number.isFinite(ts) ? ts : Date.now(),
        title: '物流更新',
        detail: String(trace?.AcceptStation || ''),
        location: String(trace?.Location || '')
      };
    })
    .filter((row) => row.detail);
}

async function loadExternalLogisticsEvents(order: { id: string; carrier?: string | null; trackingNumber?: string | null }) {
  if (!order.trackingNumber || !order.carrier) {
    return [];
  }

  const config = await getAppConfig();
  const logisticsConfig = config.integrations?.logistics;
  if (!logisticsConfig?.enabled) {
    return [];
  }

  try {
    if (logisticsConfig.provider === 'mock') {
      return [
        {
          time: Date.now(),
          title: '运输中',
          detail: `物流商 ${order.carrier} 已更新运单 ${order.trackingNumber}`,
          location: 'Transit Hub'
        }
      ];
    }

    if (logisticsConfig.provider === 'kuaidi100') {
      return tryFetchKuaidi100Events(order.carrier, order.trackingNumber);
    }

    if (logisticsConfig.provider === 'kdniao') {
      const events = await tryFetchKdniaoEvents(logisticsConfig, order.carrier, order.trackingNumber);
      if (events.length > 0) {
        return events;
      }
      return tryFetchKuaidi100Events(order.carrier, order.trackingNumber);
    }

    return [];
  } catch (_error) {
    return [];
  }
}

async function persistProviderEvents(orderId: string, events: RemoteLogisticsEvent[]) {
  if (!events.length) return;

  for (const event of events) {
    const eventTime = new Date(event.time);
    const exists = await prisma.logisticsEvent.findFirst({
      where: {
        orderId,
        title: event.title,
        detail: event.detail,
        eventTime
      },
      select: { id: true }
    });

    if (!exists) {
      await prisma.logisticsEvent.create({
        data: {
          orderId,
          title: event.title,
          detail: event.detail,
          location: event.location || '',
          eventTime,
          source: 'provider'
        }
      });
    }
  }
}

export async function getLogistics(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new AppError(50017, '订单不存在', 404);
  }
  if (role !== 'admin' && order.userId !== userId) {
    throw new AppError(50018, '无权限操作', 403);
  }

  const providerEvents = await loadExternalLogisticsEvents(order);
  if (providerEvents.length > 0) {
    await persistProviderEvents(orderId, providerEvents);
  }

  const events = await prisma.logisticsEvent.findMany({
    where: { orderId },
    orderBy: { eventTime: 'desc' }
  });

  return events.map((event) => ({
    time: new Date(event.eventTime).getTime(),
    title: event.title,
    detail: event.detail,
    location: event.location || ''
  }));
}

export async function getOrdersForAdmin() {
  await expirePendingOrders();

  const rows = await prisma.order.findMany({
    include: {
      user: {
        select: {
          name: true,
          avatar: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return rows.map(toOrderDto);
}





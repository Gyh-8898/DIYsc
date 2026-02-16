import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

interface CartDesignSnapshot {
  id?: string;
  name: string;
  wristSize: number;
  totalPrice: number;
  imageUrl?: string;
  beads: Array<{
    id?: string;
    name?: string;
    sizeMm?: number;
    price?: number;
    color?: string;
  }>;
}

export interface CartItemInput {
  id?: string;
  design: CartDesignSnapshot;
  quantity?: number;
  selected?: boolean;
}

function parseDesignSnapshot(raw: string): CartDesignSnapshot {
  try {
    const parsed = JSON.parse(raw);
    return {
      id: typeof parsed?.id === 'string' ? parsed.id : '',
      name: String(parsed?.name || 'Custom Design'),
      wristSize: Number(parsed?.wristSize || 15),
      totalPrice: Number(parsed?.totalPrice || 0),
      imageUrl: typeof parsed?.imageUrl === 'string' ? parsed.imageUrl : '',
      beads: Array.isArray(parsed?.beads)
        ? parsed.beads.map((item: any) => ({
            id: typeof item?.id === 'string' ? item.id : '',
            name: typeof item?.name === 'string' ? item.name : '',
            sizeMm: Number(item?.sizeMm || 0),
            price: Number(item?.price || 0),
            color: typeof item?.color === 'string' ? item.color : ''
          }))
        : []
    };
  } catch (_error) {
    return {
      id: '',
      name: 'Custom Design',
      wristSize: 15,
      totalPrice: 0,
      imageUrl: '',
      beads: []
    };
  }
}

function toCartDto(item: {
  id: string;
  quantity: number;
  selected: boolean;
  designSnapshot: string;
  updatedAt: Date;
  createdAt: Date;
}) {
  const design = parseDesignSnapshot(item.designSnapshot);
  return {
    id: item.id,
    quantity: item.quantity,
    selected: item.selected,
    design,
    createdAt: new Date(item.createdAt).getTime(),
    updatedAt: new Date(item.updatedAt).getTime()
  };
}

function normalizeCartItem(input: any): CartItemInput {
  const designRaw = input?.design || {};
  const beads = Array.isArray(designRaw?.beads) ? designRaw.beads : [];
  return {
    id: typeof input?.id === 'string' ? input.id : undefined,
    quantity: Math.max(1, Math.floor(Number(input?.quantity || 1))),
    selected: Boolean(input?.selected ?? true),
    design: {
      id: typeof designRaw?.id === 'string' ? designRaw.id : '',
      name: String(designRaw?.name || 'Custom Design'),
      wristSize: Number(designRaw?.wristSize || 15),
      totalPrice: Number(designRaw?.totalPrice || 0),
      imageUrl: typeof designRaw?.imageUrl === 'string' ? designRaw.imageUrl : '',
      beads: beads.map((item: any) => ({
        id: typeof item?.id === 'string' ? item.id : '',
        name: typeof item?.name === 'string' ? item.name : '',
        sizeMm: Number(item?.sizeMm || 0),
        price: Number(item?.price || 0),
        color: typeof item?.color === 'string' ? item.color : ''
      }))
    }
  };
}

export async function getUserCart(userId: string) {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
  });
  return rows.map(toCartDto);
}

export async function replaceUserCart(userId: string, payload: unknown) {
  const list = Array.isArray(payload) ? payload.map(normalizeCartItem) : [];

  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { userId } });

    for (const item of list) {
      await tx.cartItem.create({
        data: {
          id: item.id || undefined,
          userId,
          quantity: item.quantity || 1,
          selected: item.selected ?? true,
          designSnapshot: JSON.stringify(item.design)
        }
      });
    }
  });

  return getUserCart(userId);
}

export async function addCartItem(userId: string, payload: unknown) {
  const item = normalizeCartItem(payload);
  if (!item.design || !item.design.name) {
    throw new AppError(70001, '购物车商品不合法', 400);
  }

  const created = await prisma.cartItem.create({
    data: {
      id: item.id || undefined,
      userId,
      quantity: item.quantity || 1,
      selected: item.selected ?? true,
      designSnapshot: JSON.stringify(item.design)
    }
  });

  return toCartDto(created);
}

export async function updateCartItem(
  userId: string,
  cartItemId: string,
  payload: {
    quantity?: number;
    selected?: boolean;
    design?: CartDesignSnapshot;
  }
) {
  const existing = await prisma.cartItem.findFirst({
    where: {
      id: cartItemId,
      userId
    }
  });
  if (!existing) {
    throw new AppError(70002, '购物车商品不存在', 404);
  }

  const updated = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: {
      quantity:
        typeof payload.quantity === 'number' && Number.isFinite(payload.quantity)
          ? Math.max(1, Math.floor(payload.quantity))
          : existing.quantity,
      selected: typeof payload.selected === 'boolean' ? payload.selected : existing.selected,
      designSnapshot: payload.design ? JSON.stringify(normalizeCartItem({ design: payload.design }).design) : existing.designSnapshot
    }
  });

  return toCartDto(updated);
}

export async function deleteCartItem(userId: string, cartItemId: string) {
  const existing = await prisma.cartItem.findFirst({
    where: {
      id: cartItemId,
      userId
    }
  });
  if (!existing) {
    throw new AppError(70003, '购物车商品不存在', 404);
  }

  await prisma.cartItem.delete({
    where: { id: cartItemId }
  });

  return { success: true };
}



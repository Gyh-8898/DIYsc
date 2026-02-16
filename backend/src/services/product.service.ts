import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { getAppConfig, InventoryTreeConfig, saveAppConfig } from './config.service';
import { normalizePublicImageUrl } from '../utils/image-url';

interface PlazaQuery {
  query?: string;
  categoryId?: string;
  sort?: 'new' | 'hot' | 'price_asc' | 'price_desc';
}

function normalizeSort(sort?: string): 'new' | 'hot' | 'price_asc' | 'price_desc' {
  if (sort === 'hot' || sort === 'price_asc' || sort === 'price_desc') {
    return sort;
  }
  return 'new';
}

function toDesignDto(design: any) {
  let beads: unknown[] = [];
  try {
    beads = Array.isArray(design.beads) ? design.beads : JSON.parse(design.beads || '[]');
  } catch (_error) {
    beads = [];
  }

  return {
    id: design.id,
    name: design.name,
    wristSize: Number(design.wristSize || 0),
    beads,
    totalPrice: Number(design.totalPrice || 0),
    imageUrl: normalizePublicImageUrl(design.imageUrl) || '',
    likes: Number(design.likeCount || 0),
    author: design.user?.name || '',
    authorAvatar: design.user?.avatar || '',
    plazaCategoryId: design.plazaCategoryId || '',
    isPinned: Boolean(design.isPinned),
    createdAt: new Date(design.createdAt).getTime()
  };
}

async function buildInventoryTreeFromDB(): Promise<InventoryTreeConfig> {
  const categories = await prisma.beadCategory.findMany({
    include: {
      beads: {
        where: {
          status: 1
        },
        orderBy: {
          name: 'asc'
        }
      }
    },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
  });

  const grouped = new Map<string, { id: string; name: string; subCategories: any[] }>();

  for (const category of categories) {
    const [mainNameRaw, subNameRaw] = category.name.includes('-')
      ? category.name.split('-')
      : ['Others', category.name];

    const mainName = mainNameRaw || 'Others';
    const mainId = `main_${mainName.toLowerCase().replace(/\s+/g, '_')}`;

    if (!grouped.has(mainId)) {
      grouped.set(mainId, {
        id: mainId,
        name: mainName,
        subCategories: []
      });
    }

    const subCategory = {
      id: category.id,
      name: subNameRaw || category.name,
      items: category.beads.map((bead) => ({
        id: bead.id,
        name: bead.name,
        price: Number(bead.price),
        sizeMm: Number(bead.diameter),
        color: bead.image,
        image: bead.image,
        inStock: bead.stock > 0
      }))
    };

    grouped.get(mainId)!.subCategories.push(subCategory);
  }

  return {
    mainCategories: [...grouped.values()]
  };
}

export async function getInventoryTreeForClient() {
  const config = await getAppConfig();
  const fallbackTree = await buildInventoryTreeFromDB();
  const tree = config.inventoryTree && config.inventoryTree.mainCategories.length > 0 ? config.inventoryTree : fallbackTree;

  const beadRows = await prisma.bead.findMany({
    where: {
      status: 1
    },
    select: {
      id: true,
      name: true,
      diameter: true,
      price: true,
      image: true,
      stock: true
    }
  });

  const beadMap = new Map(
    beadRows.map((bead) => [
      bead.id,
      {
        name: bead.name,
        sizeMm: Number(bead.diameter),
        price: Number(bead.price),
        color: bead.image,
        image: bead.image,
        inStock: bead.stock > 0
      }
    ])
  );

  const mergedTree = {
    mainCategories: tree.mainCategories.map((main) => ({
      ...main,
      subCategories: main.subCategories.map((sub) => ({
        ...sub,
        items: sub.items.map((item) => {
          const fromDb = beadMap.get(item.id);
          if (!fromDb) {
            return {
              ...item,
              inStock: false
            };
          }
          return {
            ...item,
            ...fromDb
          };
        })
      }))
    }))
  };

  return mergedTree;
}

export async function getAddOnsForClient() {
  const rows = await prisma.addOnProduct.findMany({
    where: {
      status: 1
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    image: normalizePublicImageUrl(row.image),
    category: row.category,
    inStock: row.stock > 0,
    visible: row.visible,
    note: row.note || ''
  }));
}

export async function listPlazaDesigns(query: PlazaQuery = {}) {
  const appConfig = await getAppConfig();
  const pinnedIds = Array.isArray(appConfig.plazaPinnedIds) ? appConfig.plazaPinnedIds : [];
  const pinnedOrder = new Map(pinnedIds.map((id, index) => [id, index]));

  const where: Prisma.DesignWhereInput = {
    isPublic: true,
    deletedAt: null
  };

  if (query.query) {
    const keyword = query.query.trim();
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { user: { name: { contains: keyword } } }
      ];
    }
  }

  if (query.categoryId) {
    where.plazaCategoryId = query.categoryId;
  }

  const sort = normalizeSort(query.sort);
  const orderBy: Prisma.DesignOrderByWithRelationInput[] =
    sort === 'hot'
      ? [{ likeCount: 'desc' }, { createdAt: 'desc' }]
      : sort === 'price_asc'
        ? [{ totalPrice: 'asc' }, { createdAt: 'desc' }]
        : sort === 'price_desc'
          ? [{ totalPrice: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];

  const designs = await prisma.design.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          avatar: true
        }
      }
    },
    orderBy,
    take: 300
  });

  const rows = designs.map((item) =>
    toDesignDto({
      ...item,
      isPinned: pinnedOrder.has(item.id)
    })
  );

  if (pinnedOrder.size === 0) {
    return rows;
  }

  const pinnedRows = rows
    .filter((item) => pinnedOrder.has(item.id))
    .sort((a, b) => Number(pinnedOrder.get(a.id)) - Number(pinnedOrder.get(b.id)));
  const normalRows = rows.filter((item) => !pinnedOrder.has(item.id));
  return [...pinnedRows, ...normalRows];
}

export async function publishDesignToPlaza(
  userId: string,
  payload: {
    name?: string;
    wristSize?: number;
    beads?: unknown;
    totalPrice?: number;
    imageUrl?: string;
    plazaCategoryId?: string;
  }
) {
  const beads = Array.isArray(payload.beads) ? payload.beads : [];

  const created = await prisma.design.create({
    data: {
      userId,
      name: payload.name || 'Untitled',
      wristSize: Number(payload.wristSize) || 15,
      beads: JSON.stringify(beads),
      totalPrice: Number(payload.totalPrice) || 0,
      imageUrl: normalizePublicImageUrl(payload.imageUrl) || '',
      isPublic: true,
      plazaCategoryId: payload.plazaCategoryId || 'cat_bracelets'
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

  return toDesignDto(created);
}

export async function deletePlazaDesignByAdmin(designId: string) {
  const exists = await prisma.design.findUnique({ where: { id: designId } });
  if (!exists) {
    throw new AppError(61001, '作品不存在', 404);
  }

  await prisma.design.update({
    where: { id: designId },
    data: {
      deletedAt: new Date(),
      isPublic: false
    }
  });

  return { success: true };
}

export async function pinPlazaDesignByAdmin(designId: string, pinned: boolean) {
  const exists = await prisma.design.findUnique({ where: { id: designId } });
  if (!exists || exists.deletedAt || !exists.isPublic) {
    throw new AppError(61004, '作品不存在', 404);
  }

  const config = await getAppConfig();
  const current = Array.isArray(config.plazaPinnedIds) ? config.plazaPinnedIds : [];
  const next = pinned
    ? [designId, ...current.filter((id) => id !== designId)]
    : current.filter((id) => id !== designId);

  await saveAppConfig({ plazaPinnedIds: next });
  return { designId, pinned, plazaPinnedIds: next };
}

export async function togglePlazaLike(userId: string, designId: string, action?: 'like' | 'unlike') {
  const design = await prisma.design.findUnique({ where: { id: designId } });
  if (!design || design.deletedAt || !design.isPublic) {
    throw new AppError(61002, '作品不存在', 404);
  }

  const existing = await prisma.plazaLike.findUnique({
    where: {
      userId_designId: {
        userId,
        designId
      }
    }
  });

  const shouldLike = action ? action === 'like' : !existing;

  await prisma.$transaction(async (tx) => {
    if (shouldLike && !existing) {
      await tx.plazaLike.create({
        data: {
          userId,
          designId
        }
      });
      await tx.design.update({
        where: { id: designId },
        data: {
          likeCount: { increment: 1 }
        }
      });
    }

    if (!shouldLike && existing) {
      await tx.plazaLike.delete({
        where: {
          userId_designId: {
            userId,
            designId
          }
        }
      });
      await tx.design.update({
        where: { id: designId },
        data: {
          likeCount: { decrement: 1 }
        }
      });
    }
  });

  const latest = await prisma.design.findUnique({ where: { id: designId }, select: { likeCount: true } });
  return {
    liked: shouldLike,
    likes: latest?.likeCount || 0
  };
}

export async function getUserDesigns(userId: string) {
  const designs = await prisma.design.findMany({
    where: {
      userId,
      deletedAt: null
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return designs.map((design) => {
    let beads: unknown[] = [];
    try {
      beads = JSON.parse(design.beads || '[]');
    } catch (_error) {
      beads = [];
    }

    return {
      id: design.id,
      name: design.name,
      wristSize: Number(design.wristSize),
      beads,
      totalPrice: Number(design.totalPrice),
      imageUrl: normalizePublicImageUrl(design.imageUrl) || '',
      likes: Number(design.likeCount),
      author: '',
      authorAvatar: '',
      createdAt: new Date(design.createdAt).getTime(),
      plazaCategoryId: design.plazaCategoryId || ''
    };
  });
}

export async function saveUserDesign(
  userId: string,
  payload: {
    id?: string;
    name?: string;
    wristSize?: number;
    beads?: unknown;
    totalPrice?: number;
    imageUrl?: string;
  }
) {
  const beads = Array.isArray(payload.beads) ? payload.beads : [];

  if (payload.id) {
    const existing = await prisma.design.findFirst({
      where: {
        id: payload.id,
        userId,
        deletedAt: null
      }
    });

    if (existing) {
      const updated = await prisma.design.update({
        where: { id: existing.id },
        data: {
          name: payload.name || existing.name,
          wristSize: Number(payload.wristSize) || existing.wristSize,
          beads: JSON.stringify(beads),
          totalPrice: Number(payload.totalPrice) || existing.totalPrice,
          imageUrl: normalizePublicImageUrl(payload.imageUrl || existing.imageUrl) || ''
        }
      });

      return {
        id: updated.id,
        name: updated.name,
        wristSize: Number(updated.wristSize),
        beads,
        totalPrice: Number(updated.totalPrice),
        imageUrl: updated.imageUrl || '',
        createdAt: new Date(updated.createdAt).getTime(),
        likes: updated.likeCount,
        author: '',
        authorAvatar: ''
      };
    }
  }

  const created = await prisma.design.create({
    data: {
      userId,
      name: payload.name || 'Untitled',
      wristSize: Number(payload.wristSize) || 15,
      beads: JSON.stringify(beads),
      totalPrice: Number(payload.totalPrice) || 0,
      imageUrl: normalizePublicImageUrl(payload.imageUrl) || '',
      isPublic: false
    }
  });

  return {
    id: created.id,
    name: created.name,
    wristSize: Number(created.wristSize),
    beads,
    totalPrice: Number(created.totalPrice),
    imageUrl: created.imageUrl || '',
    createdAt: new Date(created.createdAt).getTime(),
    likes: created.likeCount,
    author: '',
    authorAvatar: ''
  };
}

export async function deleteUserDesign(userId: string, designId: string) {
  const existing = await prisma.design.findFirst({
    where: {
      id: designId,
      userId,
      deletedAt: null
    }
  });
  if (!existing) {
    throw new AppError(61003, '作品不存在', 404);
  }

  await prisma.design.update({
    where: { id: designId },
    data: {
      deletedAt: new Date(),
      isPublic: false
    }
  });

  return { success: true };
}


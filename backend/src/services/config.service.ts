import { DEFAULT_SYSTEM_CONFIG } from '../config/defaults';
import { prisma } from '../lib/prisma';
import { normalizePublicImageUrl } from '../utils/image-url';

export interface InventoryItemConfig {
  id: string;
  name: string;
  price: number;
  sizeMm: number;
  color: string;
  image?: string;
  inStock?: boolean;
  material?: string;
  element?: string;
  meaning?: string;
  description?: string;
  images?: string[];
}

export interface SubCategoryConfig {
  id: string;
  name: string;
  items: InventoryItemConfig[];
}

export interface MainCategoryConfig {
  id: string;
  name: string;
  subCategories: SubCategoryConfig[];
}

export interface InventoryTreeConfig {
  mainCategories: MainCategoryConfig[];
}

export interface ExternalPlatformConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  enabled: boolean;
  notes?: string;
}

export interface MediaLibraryItemConfig {
  id: string;
  url: string;
  storage: 'local' | 'qiniu';
  name?: string;
  createdAt: number;
}

export interface AppConfig {
  appUI: {
    appTitle: string;
    logoUrl?: string;
    homeBanner: {
      imageUrl: string;
      title: string;
      subtitle: string;
    };
  };
  wristValidation: {
    toleranceMm: number;
    overflowMessage: string;
    underflowMessage: string;
  };
  announcement: string;
  features: {
    enableTrade: boolean;
    enableAffiliate: boolean;
    enableCommunity: boolean;
    showPrice: boolean;
    enableAddOns: boolean;
  };
  business: {
    freeShippingThreshold: number;
    baseShippingFee: number;
    handworkFee: number;
    customerServiceLink?: string;
  };
  affiliate: {
    pointsPerYuan: number;
    commissionRatePercent: number;
    pointsToMoneyRate: number;
    minWithdrawPoints: number;
    pointsRuleText: string;
    announcementText: string;
  };
  support: {
    wechat: string;
    phone: string;
    serviceHours: string;
    faq: Array<{
      question: string;
      answer: string;
    }>;
  };
  agreements?: {
    user: string;
    privacy: string;
    distribution: string;
  };
  messageTemplates?: {
    orderPaid: string;
    orderShipped: string;
    promotion: string;
  };
  plazaCategories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    visible: boolean;
  }>;
  plazaPinnedIds?: string[];
  integrations?: {
    payment?: {
      provider: 'wechat' | 'alipay' | 'stripe' | 'mock' | 'custom';
      enabled: boolean;
      appId?: string;
      mchId?: string;
      mchKey?: string;
      notifyUrl?: string;
    };
    logistics?: {
      provider: 'manual' | 'kuaidi100' | 'kdniao' | 'mock' | 'custom';
      enabled: boolean;
      companyId?: string;
      apiKey?: string;
      apiSecret?: string;
      callbackUrl?: string;
    };
    qiniu?: {
      enabled: boolean;
      accessKey?: string;
      secretKey?: string;
      bucket?: string;
      domain?: string;
      region?: string;
    };
    platforms?: ExternalPlatformConfig[];
    [key: string]: unknown;
  };
  inventoryTree?: InventoryTreeConfig;
  mediaLibrary?: MediaLibraryItemConfig[];
  designerUI?: {
    watermarkUrl: string;
    beadGapMm: number;
  };
}

const APP_CONFIG_KEY = 'app';

function safeParseJson<T>(input: string | null | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch (_error) {
    return fallback;
  }
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObject(base) || !isObject(patch)) {
    return (patch as T) ?? base;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    if (isObject(current) && isObject(value)) {
      result[key] = deepMerge(current, value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

function normalizeInventoryTree(tree: unknown): InventoryTreeConfig | undefined {
  if (!tree || !isObject(tree)) return undefined;

  const mainCategoriesInput = Array.isArray((tree as { mainCategories?: unknown }).mainCategories)
    ? (tree as { mainCategories: unknown[] }).mainCategories
    : [];

  const mainCategories: MainCategoryConfig[] = mainCategoriesInput
    .map((main): MainCategoryConfig | null => {
      if (!isObject(main)) return null;
      const mainId = String(main.id || '').trim();
      const mainName = String(main.name || '').trim();
      if (!mainId || !mainName) return null;

      const subCategoriesInput = Array.isArray((main as { subCategories?: unknown }).subCategories)
        ? (main as { subCategories: unknown[] }).subCategories
        : [];

      const subCategories: SubCategoryConfig[] = subCategoriesInput
        .map((sub): SubCategoryConfig | null => {
          if (!isObject(sub)) return null;
          const subId = String(sub.id || '').trim();
          const subName = String(sub.name || '').trim();
          if (!subId || !subName) return null;

          const itemsInput = Array.isArray((sub as { items?: unknown }).items)
            ? (sub as { items: unknown[] }).items
            : [];

          const items: InventoryItemConfig[] = itemsInput
            .map((item): InventoryItemConfig | null => {
              if (!isObject(item)) return null;
              const id = String(item.id || '').trim();
              const name = String(item.name || '').trim();
              const price = Number(item.price);
              const sizeMm = Number(item.sizeMm);
              const color = String(item.color || '').trim();
              if (!id || !name || Number.isNaN(price) || Number.isNaN(sizeMm)) return null;

              const material = String(item.material || '').trim();
              const element = String(item.element || '').trim();
              const meaning = String(item.meaning || '').trim();
              const description = String(item.description || '').trim();
              const imagesInput = Array.isArray((item as { images?: unknown }).images)
                ? (item as { images: unknown[] }).images
                : [];
              const images = imagesInput.map((url) => String(url || '').trim()).filter(Boolean);

              return {
                id,
                name,
                price,
                sizeMm,
                color,
                image: String(item.image || ''),
                material: material || undefined,
                element: element || undefined,
                meaning: meaning || undefined,
                description: description || undefined,
                images,
                inStock: item.inStock !== false
              };
            })
            .filter((item): item is InventoryItemConfig => Boolean(item));

          return { id: subId, name: subName, items };
        })
        .filter((sub): sub is SubCategoryConfig => Boolean(sub));

      return { id: mainId, name: mainName, subCategories };
    })
    .filter((main): main is MainCategoryConfig => Boolean(main));

  return { mainCategories };
}

function normalizePlatforms(raw: unknown): ExternalPlatformConfig[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item): ExternalPlatformConfig | null => {
      if (!isObject(item)) return null;
      const id = String(item.id || '').trim() || `platform_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
      const name = String(item.name || '').trim() || 'Platform';
      const provider = String(item.provider || 'custom').trim();
      return {
        id,
        name,
        provider,
        baseUrl: String(item.baseUrl || ''),
        apiKey: String(item.apiKey || ''),
        apiSecret: String(item.apiSecret || ''),
        enabled: Boolean(item.enabled),
        notes: String(item.notes || '')
      };
    })
    .filter((item): item is ExternalPlatformConfig => Boolean(item));
}

function normalizeSupportFaq(raw: unknown): Array<{ question: string; answer: string }> {
  const list = Array.isArray(raw) ? raw : [];

  return list
    .map((item): { question: string; answer: string } | null => {
      if (!isObject(item)) return null;

      const question = String(item.question || item.title || '').trim();
      const answer = String(item.answer || item.content || '').trim();
      if (!question || !answer) return null;

      return { question, answer };
    })
    .filter((item): item is { question: string; answer: string } => Boolean(item))
    .slice(0, 20);
}

function normalizeMediaLibrary(raw: unknown): MediaLibraryItemConfig[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item): MediaLibraryItemConfig | null => {
      if (!isObject(item)) return null;
      const id = String(item.id || '').trim();
      const url = normalizePublicImageUrl(String(item.url || ''));
      const storage = String(item.storage || 'local') === 'qiniu' ? 'qiniu' : 'local';
      if (!id || !url) return null;
      return {
        id,
        url,
        storage,
        name: String(item.name || ''),
        createdAt: Number(item.createdAt || Date.now())
      };
    })
    .filter((item): item is MediaLibraryItemConfig => Boolean(item))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 1000);
}

function applyRuntimeIntegrationEnv(config: AppConfig) {
  const qiniu = config.integrations?.qiniu;
  if (!qiniu?.enabled) {
    return;
  }

  const accessKey = String(qiniu.accessKey || '').trim();
  const secretKey = String(qiniu.secretKey || '').trim();
  const bucket = String(qiniu.bucket || '').trim();
  const domain = String(qiniu.domain || '').trim();
  const region = String(qiniu.region || '').trim();
  if (accessKey) process.env.QINIU_ACCESS_KEY = accessKey;
  if (secretKey) process.env.QINIU_SECRET_KEY = secretKey;
  if (bucket) process.env.QINIU_BUCKET = bucket;
  if (domain) process.env.QINIU_DOMAIN = domain;
  if (region) process.env.QINIU_REGION = region;
}

function normalizeAppConfig(raw: unknown): AppConfig {
  const merged = deepMerge(DEFAULT_SYSTEM_CONFIG as AppConfig, raw || {});
  const inventoryTree = normalizeInventoryTree((raw as { inventoryTree?: unknown })?.inventoryTree ?? merged.inventoryTree);
  const defaultSupport = (DEFAULT_SYSTEM_CONFIG as AppConfig).support;
  const supportFaq = normalizeSupportFaq((merged.support as { faq?: unknown } | undefined)?.faq);

  return {
    ...merged,
    appUI: {
      ...merged.appUI,
      homeBanner: {
        ...merged.appUI.homeBanner,
        imageUrl: normalizePublicImageUrl(merged.appUI?.homeBanner?.imageUrl)
      }
    },
    wristValidation: {
      ...merged.wristValidation,
      toleranceMm: Number(merged.wristValidation.toleranceMm) || DEFAULT_SYSTEM_CONFIG.wristValidation.toleranceMm
    },
    business: {
      ...merged.business,
      freeShippingThreshold:
        Number(merged.business.freeShippingThreshold) || DEFAULT_SYSTEM_CONFIG.business.freeShippingThreshold,
      baseShippingFee: Number(merged.business.baseShippingFee) || DEFAULT_SYSTEM_CONFIG.business.baseShippingFee,
      handworkFee: Number(merged.business.handworkFee) || DEFAULT_SYSTEM_CONFIG.business.handworkFee
    },
    affiliate: {
      ...merged.affiliate,
      pointsPerYuan: Number(merged.affiliate.pointsPerYuan) || DEFAULT_SYSTEM_CONFIG.affiliate.pointsPerYuan,
      commissionRatePercent:
        Number(merged.affiliate.commissionRatePercent) || DEFAULT_SYSTEM_CONFIG.affiliate.commissionRatePercent,
      pointsToMoneyRate: Number(merged.affiliate.pointsToMoneyRate) || DEFAULT_SYSTEM_CONFIG.affiliate.pointsToMoneyRate,
      minWithdrawPoints: Number(merged.affiliate.minWithdrawPoints) || DEFAULT_SYSTEM_CONFIG.affiliate.minWithdrawPoints
    },
    support: {
      wechat: String(merged.support?.wechat || defaultSupport.wechat || ''),
      phone: String(merged.support?.phone || defaultSupport.phone || ''),
      serviceHours: String(merged.support?.serviceHours || defaultSupport.serviceHours || '09:00-21:00'),
      faq: supportFaq.length > 0 ? supportFaq : normalizeSupportFaq(defaultSupport.faq)
    },
    agreements: {
      user: String((merged as any).agreements?.user || (DEFAULT_SYSTEM_CONFIG as any).agreements?.user || ''),
      privacy: String((merged as any).agreements?.privacy || (DEFAULT_SYSTEM_CONFIG as any).agreements?.privacy || ''),
      distribution: String(
        (merged as any).agreements?.distribution || (DEFAULT_SYSTEM_CONFIG as any).agreements?.distribution || ''
      )
    },
    messageTemplates: {
      orderPaid: String(
        (merged as any).messageTemplates?.orderPaid || (DEFAULT_SYSTEM_CONFIG as any).messageTemplates?.orderPaid || ''
      ),
      orderShipped: String(
        (merged as any).messageTemplates?.orderShipped ||
        (DEFAULT_SYSTEM_CONFIG as any).messageTemplates?.orderShipped ||
        ''
      ),
      promotion: String(
        (merged as any).messageTemplates?.promotion || (DEFAULT_SYSTEM_CONFIG as any).messageTemplates?.promotion || ''
      )
    },
    integrations: {
      payment: {
        provider: (merged.integrations?.payment?.provider || 'wechat') as
          | 'wechat'
          | 'alipay'
          | 'stripe'
          | 'mock'
          | 'custom',
        enabled: Boolean(merged.integrations?.payment?.enabled),
        appId: String(merged.integrations?.payment?.appId || ''),
        mchId: String(merged.integrations?.payment?.mchId || ''),
        mchKey: String(merged.integrations?.payment?.mchKey || ''),
        notifyUrl: String(merged.integrations?.payment?.notifyUrl || '')
      },
      logistics: {
        provider: (merged.integrations?.logistics?.provider || 'manual') as
          | 'manual'
          | 'kuaidi100'
          | 'kdniao'
          | 'mock'
          | 'custom',
        enabled: Boolean(merged.integrations?.logistics?.enabled),
        companyId: String(merged.integrations?.logistics?.companyId || ''),
        apiKey: String(merged.integrations?.logistics?.apiKey || ''),
        apiSecret: String(merged.integrations?.logistics?.apiSecret || ''),
        callbackUrl: String(merged.integrations?.logistics?.callbackUrl || '')
      },
      qiniu: {
        enabled: Boolean((merged.integrations as any)?.qiniu?.enabled),
        accessKey: String((merged.integrations as any)?.qiniu?.accessKey || ''),
        secretKey: String((merged.integrations as any)?.qiniu?.secretKey || ''),
        bucket: String((merged.integrations as any)?.qiniu?.bucket || ''),
        domain: String((merged.integrations as any)?.qiniu?.domain || ''),
        region: String((merged.integrations as any)?.qiniu?.region || 'z2')
      },
      platforms: normalizePlatforms(merged.integrations?.platforms)
    },
    plazaPinnedIds: Array.isArray((merged as any).plazaPinnedIds)
      ? (merged as any).plazaPinnedIds.map((item: unknown) => String(item || '')).filter((item: string) => Boolean(item))
      : [],
    inventoryTree,
    mediaLibrary: normalizeMediaLibrary((merged as any).mediaLibrary),
    designerUI: {
      watermarkUrl: String((merged as any).designerUI?.watermarkUrl || ''),
      beadGapMm: Math.max(0, Math.min(5, Number((merged as any).designerUI?.beadGapMm) || 1))
    }
  };
}

function looksMasked(value: string): boolean {
  return value.includes('*');
}

function resolveSecret(nextValue: string | undefined, currentValue: string | undefined): string {
  const normalized = String(nextValue || '').trim();
  if (!normalized) return String(currentValue || '');
  if (looksMasked(normalized)) return String(currentValue || '');
  return normalized;
}

function maskSecret(value: string | undefined): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (source.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, source.length - 4))}${source.slice(-4)}`;
}

export function sanitizeAppConfigForPublic(config: AppConfig): AppConfig {
  return {
    ...config,
    integrations: {
      ...config.integrations,
      payment: {
        ...(config.integrations?.payment || {
          provider: 'wechat',
          enabled: false,
          appId: '',
          mchId: '',
          notifyUrl: ''
        }),
        mchKey: ''
      },
      logistics: {
        ...(config.integrations?.logistics || {
          provider: 'manual',
          enabled: false,
          companyId: ''
        }),
        apiKey: '',
        apiSecret: ''
      },
      qiniu: {
        ...(config.integrations?.qiniu || {
          enabled: false,
          accessKey: '',
          secretKey: '',
          bucket: '',
          domain: '',
          region: 'z2'
        }),
        accessKey: '',
        secretKey: ''
      },
      platforms: (config.integrations?.platforms || []).map((item) => ({
        ...item,
        apiKey: '',
        apiSecret: ''
      })),
      paymentMasked: {
        mchKey: maskSecret(config.integrations?.payment?.mchKey)
      },
      logisticsMasked: {
        apiKey: maskSecret(config.integrations?.logistics?.apiKey)
      }
    }
  };
}

export async function getAppConfig(): Promise<AppConfig> {
  const row = await prisma.systemConfig.findUnique({ where: { configKey: APP_CONFIG_KEY } });
  if (!row) {
    const initial = normalizeAppConfig(DEFAULT_SYSTEM_CONFIG);
    await prisma.systemConfig.create({
      data: {
        configKey: APP_CONFIG_KEY,
        configValue: JSON.stringify(initial)
      }
    });
    applyRuntimeIntegrationEnv(initial);
    return initial;
  }

  const config = normalizeAppConfig(safeParseJson(row.configValue, DEFAULT_SYSTEM_CONFIG));
  applyRuntimeIntegrationEnv(config);
  return config;
}

export async function getPublicAppConfig(): Promise<AppConfig> {
  const config = await getAppConfig();
  return sanitizeAppConfigForPublic(config);
}

export async function saveAppConfig(partial: unknown): Promise<AppConfig> {
  const current = await getAppConfig();
  const merged = normalizeAppConfig(deepMerge(current, partial));

  merged.integrations = merged.integrations || {};
  merged.integrations.payment = merged.integrations.payment || {
    provider: 'wechat',
    enabled: false,
    appId: '',
    mchId: '',
    mchKey: '',
    notifyUrl: ''
  };
  merged.integrations.logistics = merged.integrations.logistics || {
    provider: 'manual',
    enabled: false,
    companyId: '',
    apiKey: '',
    apiSecret: '',
    callbackUrl: ''
  };

  merged.integrations.payment.mchKey = resolveSecret(
    merged.integrations.payment.mchKey,
    current.integrations?.payment?.mchKey
  );

  merged.integrations.logistics.apiKey = resolveSecret(
    merged.integrations.logistics.apiKey,
    current.integrations?.logistics?.apiKey
  );
  merged.integrations.logistics.apiSecret = resolveSecret(
    merged.integrations.logistics.apiSecret,
    current.integrations?.logistics?.apiSecret
  );

  const currentPlatforms = new Map((current.integrations?.platforms || []).map((item) => [item.id, item]));
  merged.integrations.platforms = (merged.integrations.platforms || []).map((item) => {
    const old = currentPlatforms.get(item.id);
    return {
      ...item,
      apiKey: resolveSecret(item.apiKey, old?.apiKey),
      apiSecret: resolveSecret(item.apiSecret, old?.apiSecret)
    };
  });

  await prisma.systemConfig.upsert({
    where: { configKey: APP_CONFIG_KEY },
    update: { configValue: JSON.stringify(merged) },
    create: { configKey: APP_CONFIG_KEY, configValue: JSON.stringify(merged) }
  });

  if (merged.inventoryTree) {
    await syncInventoryTree(merged.inventoryTree);
  }

  if (Array.isArray((partial as any).addOns)) {
    await saveAddOns((partial as any).addOns);
  }

  applyRuntimeIntegrationEnv(merged);
  return merged;
}

export async function syncInventoryTree(tree: InventoryTreeConfig): Promise<void> {
  const categoryIds = new Set<string>();
  const beadIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const main of tree.mainCategories) {
      for (const sub of main.subCategories) {
        categoryIds.add(sub.id);

        await tx.beadCategory.upsert({
          where: { id: sub.id },
          update: {
            name: `${main.name}-${sub.name}`,
            type: main.id,
            sortOrder: main.subCategories.findIndex((s) => s.id === sub.id)
          },
          create: {
            id: sub.id,
            name: `${main.name}-${sub.name}`,
            type: main.id,
            sortOrder: main.subCategories.findIndex((s) => s.id === sub.id)
          }
        });

        for (const item of sub.items) {
          beadIds.add(item.id);

          const existing = await tx.bead.findUnique({ where: { id: item.id } });
          await tx.bead.upsert({
            where: { id: item.id },
            update: {
              categoryId: sub.id,
              name: item.name,
              diameter: item.sizeMm,
              price: item.price,
              image: item.color || item.image || '',
              status: 1,
              ...(existing
                ? {}
                : {
                  stock: item.inStock === false ? 0 : 999,
                  reservedStock: 0
                })
            },
            create: {
              id: item.id,
              categoryId: sub.id,
              name: item.name,
              diameter: item.sizeMm,
              price: item.price,
              image: item.color || item.image || '',
              stock: item.inStock === false ? 0 : 999,
              reservedStock: 0,
              status: 1
            }
          });
        }
      }
    }

    const allBeads = await tx.bead.findMany({ select: { id: true } });
    const staleBeads = allBeads.filter((b) => !beadIds.has(b.id)).map((b) => b.id);
    if (staleBeads.length > 0) {
      await tx.bead.updateMany({
        where: { id: { in: staleBeads } },
        data: { status: 0 }
      });
    }

    const allCategories = await tx.beadCategory.findMany({ select: { id: true } });
    const staleCategories = allCategories.filter((c) => !categoryIds.has(c.id)).map((c) => c.id);
    if (staleCategories.length > 0) {
      await tx.bead.updateMany({
        where: { categoryId: { in: staleCategories } },
        data: { status: 0 }
      });
    }
  });
}

export async function getPublicBanners() {
  const banners = await prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
  });

  if (banners.length > 0) {
    return banners.map((item) => ({
      id: item.id,
      imageUrl: normalizePublicImageUrl(item.imageUrl),
      link: item.linkUrl || ''
    }));
  }

  return [
    {
      id: 1,
      imageUrl: normalizePublicImageUrl(DEFAULT_SYSTEM_CONFIG.appUI.homeBanner.imageUrl),
      link: ''
    }
  ];
}

export async function saveAddOns(
  addOns: Array<{ id?: string; name: string; price: number; image: string; category: string; inStock?: boolean; visible?: boolean; note?: string }>
) {
  await prisma.$transaction(async (tx) => {
    const incomingIds = new Set<string>();

    for (const item of addOns) {
      if (item.id) incomingIds.add(item.id);

      if (item.id) {
        await tx.addOnProduct.upsert({
          where: { id: item.id },
          update: {
            name: item.name,
            price: Number(item.price) || 0,
            image: item.image,
            category: item.category,
            status: item.inStock === false ? 0 : 1,
            visible: item.visible !== false,
            note: item.note || ''
          },
          create: {
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            image: item.image,
            category: item.category,
            status: item.inStock === false ? 0 : 1,
            visible: item.visible !== false,
            note: item.note || '',
            stock: 9999
          }
        });
      } else {
        const created = await tx.addOnProduct.create({
          data: {
            name: item.name,
            price: Number(item.price) || 0,
            image: item.image,
            category: item.category,
            status: item.inStock === false ? 0 : 1,
            visible: item.visible !== false,
            note: item.note || '',
            stock: 9999
          }
        });
        incomingIds.add(created.id);
      }
    }

    if (incomingIds.size > 0) {
      await tx.addOnProduct.updateMany({
        where: {
          id: { notIn: [...incomingIds] }
        },
        data: {
          status: 0
        }
      });
    }
  });
}

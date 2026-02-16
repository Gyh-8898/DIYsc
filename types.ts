export interface BeadType {
  id: string;
  name: string;
  material?: string;
  sizeMm: number;
  price: number;
  color: string;
  image?: string;
  description?: string;
  inStock?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  sizeMm: number;
  color: string;
  image?: string;
  inStock: boolean;
  /** 材质 e.g. "天然水晶" */
  material?: string;
  /** 五行属性 e.g. "火" */
  element?: string;
  /** 寓意 */
  meaning?: string;
  /** 详情描述 */
  description?: string;
  /** 实拍图 URL 列表 */
  images?: string[];
}

export interface SubCategory {
  id: string;
  name: string;
  items: InventoryItem[];
}

export interface MainCategory {
  id: string;
  name: string;
  subCategories: SubCategory[];
}

export interface InventoryTree {
  mainCategories: MainCategory[];
}

export interface PlazaCategory {
  id: string;
  name: string;
  sortOrder: number;
  visible: boolean;
}

export interface Design {
  id: string;
  name: string;
  wristSize: number;
  beads: BeadType[];
  totalPrice: number;
  createdAt: number;
  imageUrl?: string;
  likes: number;
  author: string;
  authorAvatar?: string;
  tags?: string[];
  plazaCategoryId?: string;
  isPinned?: boolean;
}

export interface AddOnProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  inStock: boolean;
  visible?: boolean;
  note?: string;
}

export interface PointHistory {
  id: string;
  userId: string;
  type:
  | 'earn_purchase'
  | 'earn_referral'
  | 'redeem'
  | 'withdraw'
  | 'refund'
  | 'bonus'
  | 'freeze'
  | 'unfreeze'
  | 'commission';
  amount: number;
  description: string;
  createdAt: number;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  pointsAmount: number;
  moneyAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  processedAt?: number;
  rejectReason?: string;
  account?: string;
}

export interface Complaint {
  id: string;
  userId: string;
  userName: string;
  type: 'complaint' | 'appeal';
  title: string;
  description: string;
  images?: string[];
  contact?: string;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  createdAt: number;
  reply?: string;
  replyMessages?: Array<{
    id: string;
    sender: 'admin' | 'system';
    content: string;
    createdAt: number;
  }>;
  resolvedAt?: number;
}

export interface CouponTemplate {
  id: string;
  name: string;
  description?: string;
  discountType: 'fixed' | 'percent' | string;
  discountValue: number;
  minAmount: number;
  totalCount: number;
  issuedCount: number;
  perUserLimit: number;
  status: number;
  startAt: number;
  endAt: number;
  createdAt?: number;
}

export interface CouponIssueStats {
  summary: {
    totalTemplates: number;
    totalIssued: number;
    totalUsed: number;
    totalAvailable: number;
    totalExpired: number;
    usageRate: number;
  };
  templateStats: Array<{
    templateId: string;
    templateName: string;
    issuedCount: number;
    usedCount: number;
    availableCount: number;
    expiredCount: number;
    usageRate: number;
  }>;
}

export interface AnalyticsOverview {
  rangeDays?: number;
  kpis?: {
    newUsersToday: number;
    totalUsers: number;
    ordersToday: number;
    totalOrders: number;
    salesToday: number;
    salesTotal: number;
    shippedToday: number;
    shippedTotal: number;
    pendingWithdrawals: number;
    totalWithdrawals: number;
    complaintsToday: number;
    refundRate: number;
    pendingPaymentTimeoutRate?: number;
    addOnPenetrationRate?: number;
    couponRedemptionRate?: number;
  };
  trends?: {
    labels: string[];
    newUsers: number[];
    orders: number[];
    sales: number[];
    shipped: number[];
    withdrawals: number[];
    complaints: number[];
  };
  events24h: Array<{
    eventType: string;
    _count: {
      eventType: number;
    };
  }>;
  orderStats: Array<{
    status: string;
    _count: {
      status: number;
    };
  }>;
  complaints24h: number;
  refundRate: number;
}

export interface PointsRule {
  id: string;
  name: string;
  eventType: string;
  rewardMode: 'fixed' | 'rate';
  rewardValue: number;
  maxPerUserDay: number;
  maxPerUserTotal: number;
  cooldownMinutes: number;
  stackMode: 'stack' | 'exclusive';
  scopeType: 'all' | 'new_user' | 'level' | 'tag' | 'user';
  scopeValue: string;
  minOrderAmount: number;
  maxOrderAmount: number;
  minUserLevel: number;
  maxUserLevel: number;
  newUserWithinDays: number;
  requireReferral: boolean;
  requireFirstOrder: boolean;
  weekdays: string;
  allowedChannels: string;
  extraConditions: string;
  validStart: number;
  validEnd: number;
  status: 0 | 1;
  remark: string;
  createdAt: number;
  updatedAt: number;
}

export interface PointsCampaign {
  id: string;
  name: string;
  campaignType: string;
  ruleIds: string[];
  budgetTotalPoints: number;
  budgetDailyPoints: number;
  userCapPoints: number;
  audienceType: 'all' | 'level' | 'tag' | 'user';
  audienceValue: string;
  status: 0 | 1;
  startAt: number;
  endAt: number;
  spentPoints: number;
  createdAt: number;
  updatedAt: number;
}

export interface PointsRiskRule {
  id: string;
  name: string;
  eventType: string;
  freqLimit: number;
  dailyLimit: number;
  deviceLimit: number;
  ipLimit: number;
  blacklistEnabled: boolean;
  hitAction: 'block' | 'downgrade' | 'review';
  status: 0 | 1;
  remark: string;
  createdAt: number;
  updatedAt: number;
}

export interface PointsGrantTask {
  id: string;
  grantType: 'add' | 'deduct' | 'freeze' | 'unfreeze';
  targetType: 'user' | 'level' | 'all';
  targetCount: number;
  points: number;
  reasonCode: string;
  remark: string;
  status: 'completed' | 'partial' | 'failed';
  successCount: number;
  failureCount: number;
  resultSummary: string;
  createdAt: number;
  operatorUserId: string;
}

export interface PointsLedgerRow {
  id: string;
  userId: string;
  userName: string;
  type: string;
  amount: number;
  reason: string;
  bizId: string;
  createdAt: number;
}

export interface PointsDashboard {
  kpis: {
    issuedToday: number;
    redeemedToday: number;
    activeUsers7d: number;
    pointsPool: number;
    activeCampaigns: number;
    enabledRules: number;
  };
  trends: {
    labels: string[];
    issued: number[];
    redeemed: number[];
    activeUsers: number[];
  };
}

export interface AdminSelfCheckItem {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export interface AdminOpsSelfCheck {
  generatedAt: number;
  summary: {
    total: number;
    ok: number;
    warn: number;
    error: number;
  };
  items: AdminSelfCheckItem[];
  snapshot: {
    totalUsers: number;
    totalOrders: number;
    todayNewUsers: number;
    todayOrders: number;
    pendingPaymentOrders: number;
    pendingWithdrawals: number;
  };
}

export interface AdminAuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  status: 'success' | 'failed' | string;
  message: string;
  ip: string;
  userAgent: string;
  beforeData?: string;
  afterData?: string;
  createdAt: number;
}

export type AddressTag = 'home' | 'company' | 'school' | 'other';

export interface Address {
  id: string;
  userId: string;
  name: string;
  phone: string;
  region: string;
  detail: string;
  tag: AddressTag;
  isDefault: boolean;
  createdAt?: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  points: number;
  frozenPoints: number;
  totalSpend: number;
  levelId: number;
  levelName: string;
  referralCode?: string;
  referrerId?: string;
  referrerName?: string;
  phone?: string;
  createdAt: number;
  lastLoginAt: number;
  orderCount: number;
  isDistributor?: boolean;
}

export interface Banner {
  id: string | number;
  imageUrl: string;
  link?: string;
  durationSeconds?: number;
}

export interface OrderItem {
  name: string;
  description: string;
  price: number;
  count: number;
  imagePreview?: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'pending_production'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refund_requested';

export interface LogisticEvent {
  time: number;
  title: string;
  detail: string;
  location?: string;
}

export interface Order {
  id: string;
  orderNo?: string;
  userId: string;
  userName: string;
  userAvatar: string;
  items: OrderItem[];
  totalAmount: number;
  payAmount?: number;
  status: OrderStatus;
  createdAt: number;
  shippingAddress: string;
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: number;
  logistics?: LogisticEvent[];
  remarks?: string;
  couponAmount?: number;
  pointsUsed?: number;
  pointsDeductAmount?: number;
  shippingFee?: number;
  handworkFee?: number;
}

export interface FeatureFlags {
  enableTrade: boolean;
  enableAffiliate: boolean;
  enableCommunity: boolean;
  showPrice: boolean;
  enableAddOns: boolean;
}

export interface BusinessConfig {
  freeShippingThreshold: number;
  baseShippingFee: number;
  handworkFee: number;
  customerServiceLink?: string;
}

export interface SupportFaqItem {
  question: string;
  answer: string;
}

export interface SupportConfig {
  wechat: string;
  phone: string;
  serviceHours: string;
  faq: SupportFaqItem[];
}

export interface AffiliateConfig {
  pointsPerYuan: number;
  commissionRatePercent: number;
  pointsToMoneyRate: number;
  minWithdrawPoints: number;
  pointsRuleText: string;
  announcementText: string;
}

export interface AppUIConfig {
  appTitle: string;
  logoUrl?: string;
  homeBanner: {
    imageUrl: string;
    title: string;
    subtitle: string;
  };
}

export interface DesignerUIConfig {
  /** 工作台中心预览图 */
  watermarkUrl: string;
  /** 珠子间隙修正(mm) */
  beadGapMm: number;
}

export type PaymentProvider = 'wechat' | 'alipay' | 'stripe' | 'mock' | 'custom';
export type LogisticsProvider = 'manual' | 'kuaidi100' | 'kdniao' | 'mock' | 'custom';

export interface PaymentIntegrationConfig {
  provider: PaymentProvider;
  enabled: boolean;
  appId?: string;
  mchId?: string;
  mchKey?: string;
  notifyUrl?: string;
  [key: string]: unknown;
}

export interface LogisticsIntegrationConfig {
  provider: LogisticsProvider;
  enabled: boolean;
  companyId?: string;
  apiKey?: string;
  apiSecret?: string;
  callbackUrl?: string;
  [key: string]: unknown;
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

export interface QiniuConfig {
  enabled: boolean;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  domain?: string;
  region?: string;
}

export interface IntegrationConfig {
  payment?: PaymentIntegrationConfig;
  logistics?: LogisticsIntegrationConfig;
  qiniu?: QiniuConfig;
  platforms?: ExternalPlatformConfig[];
  [key: string]: unknown;
}

export interface MediaLibraryItem {
  id: string;
  url: string;
  storage: 'local' | 'qiniu';
  name?: string;
  createdAt: number;
}

export interface SystemConfig {
  appUI: AppUIConfig;
  plazaTitle?: string;
  wristValidation: {
    toleranceMm: number;
    overflowMessage: string;
    underflowMessage: string;
  };
  announcement: string;
  features: FeatureFlags;
  business: BusinessConfig;
  affiliate: AffiliateConfig;
  inventoryTree?: InventoryTree;
  plazaCategories?: PlazaCategory[];
  plazaPinnedIds?: string[];
  mediaLibrary?: MediaLibraryItem[];
  banners?: Banner[];
  integrations?: IntegrationConfig;
  support?: SupportConfig;
  designerUI?: DesignerUIConfig;
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
  addOns?: AddOnProduct[];
}
export type AiProviderAuthType = 'bearer' | 'x-api-key' | 'query' | string;
export type AiModelStatus = 'active' | 'deprecated' | 'offline' | string;

export interface AiProviderConfigView {
  id: string;
  provider: string;
  displayName: string;
  baseUrl: string;
  authType: AiProviderAuthType;
  enabled: boolean;
  apiKeyMasked: string;
  hasApiKey: boolean;
  metaJson: string;
  updatedAt: number;
}

export interface AiModelRegistryView {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  version: string;
  releaseDate: number | null;
  status: AiModelStatus;
  isDefault: boolean;
  metaJson: string;
  updatedAt: number;
}

export interface AiRouterRuleView {
  id: string;
  mode: 'manual' | 'auto' | string;
  manualProvider: string;
  manualModelId: string;
  manualVersion: string;
  autoConfig: string;
}

export interface AiPromptTemplateView {
  id: string;
  taskType: string;
  name: string;
  version: string;
  content: string;
  status: string;
  trafficPercent: number;
  isDefault: boolean;
  updatedAt: number;
}

export interface AiPolicyRuleView {
  id: string;
  key: string;
  type: string;
  content: string;
  enabled: boolean;
  updatedAt: number;
}

export interface CommunityTagMappingView {
  id: string;
  tag: string;
  filter: string;
  enabled: boolean;
  updatedAt: number;
}

export interface AdminAiDashboardView {
  rangeDays: number;
  labels: string[];
  series: {
    newUsers: number[];
    analysesSuccess: number[];
    analysesFail: number[];
    reportsSaved: number[];
    tagClicks: number[];
    gotoDesigner: number[];
    cost: number[];
  };
  totals: {
    newUsers: number;
    analysesSuccess: number;
    analysesFail: number;
    reportsSaved: number;
    tagClicks: number;
    gotoDesigner: number;
    cost: number;
  };
}


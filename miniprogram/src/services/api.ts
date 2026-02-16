import Taro from "@tarojs/taro";
import { Design, SystemConfig, DEFAULT_CONFIG } from "../constants";
export type { SystemConfig };

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const API_PREFIX = "/api";
const TOKEN_KEY = "auth_token";
const PENDING_REFERRAL_KEY = "pending_referral_code";
const COMMUNITY_SESSION_KEY = "community_session_id";
const DEV_OPENID_KEY = "dev_openid";

function isDevtoolsPlatformSafe(): boolean {
  try {
    const info = Taro.getSystemInfoSync();
    return (info as any)?.platform === "devtools";
  } catch {
    return false;
  }
}

function getMiniProgramAppIdSafe(): string {
  try {
    const account = (Taro as any).getAccountInfoSync?.();
    const appId = account?.miniProgram?.appId;
    return typeof appId === "string" ? appId : "";
  } catch {
    return "";
  }
}

function isLocalApiBaseUrl(): boolean {
  const base = String(API_BASE_URL || "").toLowerCase();
  return base.includes("localhost") || base.includes("127.0.0.1");
}

function shouldBypassNetworkInDevtools(): boolean {
  // Workaround: in some DevTools/base-library combos (esp. touristappid),
  // internal webapi calls can error and crash AppService, causing blank pages.
  // For UI development, bypass network calls and return safe mock data.
  return isDevtoolsPlatformSafe() && isLocalApiBaseUrl() && getMiniProgramAppIdSafe() === "touristappid";
}

function mockDevtoolsTouristResponse<T>(method: HttpMethod, url: string): T | undefined {
  if (method === "GET" && url === "/system/banners") return [] as any;
  if (method === "GET" && url === "/system/config") return DEFAULT_CONFIG as any;

  // Community module safe defaults
  if (method === "GET" && url === "/community/drafts/latest") return null as any;
  if (method === "GET" && url === "/community/reports") return [] as any;

  // Plaza safe defaults
  if (method === "GET" && url.startsWith("/products/plaza")) return [] as any;

  return undefined;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}

export interface User {
  id: string;
  nickname: string;
  avatarUrl: string;
  points: number;
  levelName: string;
  role: string;
  referralCode?: string;
  frozenPoints?: number;
  totalSpend?: number;
  orderCount?: number;
  phone?: string;
}

export interface OrderItem {
  name: string;
  spec?: string;
  price: number;
  count: number;
}

export interface Order {
  id: string;
  orderNo?: string;
  items: OrderItem[];
  totalAmount: number;
  payAmount?: number;
  status: string;
  createdAt: string;
  shippingAddress?: string;
  trackingNumber?: string;
  carrier?: string;
  remarks?: string;
  shippedAt?: number;
  couponAmount?: number;
  pointsUsed?: number;
  pointsDeductAmount?: number;
  shippingFee?: number;
  handworkFee?: number;
}

export interface LogisticsEvent {
  time: number;
  title: string;
  detail: string;
  location?: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  region: string | null;
  detail: string;
  tag: string;
  isDefault: boolean;
}

export interface Banner {
  id: number;
  imageUrl: string;
  linkUrl?: string;
}

export interface PointHistoryItem {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: number;
}

export interface WithdrawalItem {
  id: string;
  userId: string;
  userName: string;
  pointsAmount: number;
  moneyAmount: number;
  account: string;
  status: string;
  createdAt: number;
  processedAt?: number;
  rejectReason?: string;
}

export interface ComplaintItem {
  id: string;
  userId: string;
  userName: string;
  type: "complaint" | "appeal" | string;
  title: string;
  description: string;
  images: string[];
  contact: string;
  status: string;
  reply: string;
  replyMessages?: Array<{
    id: string;
    sender: 'admin' | 'system';
    content: string;
    createdAt: number;
  }>;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: string;
  bizId?: string;
  orderId?: string;
  complaintId?: string;
  readAt?: number;
  createdAt: number;
}

export interface CartItem {
  id: string;
  quantity: number;
  selected: boolean;
  design: {
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
  };
  createdAt: number;
  updatedAt: number;
}

export interface CouponTemplate {
  id: string;
  name: string;
  description: string;
  discountType: string;
  discountValue: number;
  minAmount: number;
  totalCount?: number;
  issuedCount?: number;
  perUserLimit?: number;
  status?: number;
  startAt: number;
  endAt: number;
}

export interface UserCoupon {
  id: string;
  templateId: string;
  status: string;
  obtainedAt: number;
  usedAt?: number;
  orderId?: string;
  template: CouponTemplate;
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

export type CommunityTaskType = "bazi" | "liuyao";

export interface CommunityDraft {
  id: string;
  type: CommunityTaskType;
  payload: Record<string, unknown>;
  updatedAt: number;
}

export interface CommunityAnalysisResult {
  type: CommunityTaskType;
  summary: string;
  tags: string[];
  insights: Array<{ title: string; content: string }>;
  recommendedTags: Array<{ tag: string; reason: string }>;
  disclaimer?: string;
}

export interface CommunityAnalysisResponse {
  traceId: string;
  riskStatus: string;
  result: CommunityAnalysisResult;
  provider?: string;
  modelId?: string;
  version?: string;
}

export interface CommunityReportListItem {
  id: string;
  type: CommunityTaskType;
  title: string;
  tags: string[];
  createdAt: number;
}

export interface CommunityReportDetail extends CommunityReportListItem {
  input: Record<string, unknown>;
  output: CommunityAnalysisResult;
  provider: string;
  modelId: string;
  version: string;
}

function getToken() {
  const token = Taro.getStorageSync(TOKEN_KEY);
  return token ? String(token) : "";
}

function setToken(token: string) {
  Taro.setStorageSync(TOKEN_KEY, token);
}

function clearToken() {
  Taro.removeStorageSync(TOKEN_KEY);
}

function getDevOpenId() {
  const raw = Taro.getStorageSync(DEV_OPENID_KEY);
  const existing = raw ? String(raw) : "";
  if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
    return existing;
  }
  const next = `do_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.replace(/[^a-zA-Z0-9_-]/g, "");
  Taro.setStorageSync(DEV_OPENID_KEY, next);
  return next;
}

function getCommunitySessionId() {
  const raw = Taro.getStorageSync(COMMUNITY_SESSION_KEY);
  const existing = raw ? String(raw) : "";
  if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
    return existing;
  }
  const next = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.replace(/[^a-zA-Z0-9_-]/g, "");
  Taro.setStorageSync(COMMUNITY_SESSION_KEY, next);
  return next;
}

function safeJsonParse(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeUser(raw: any): User {
  return {
    id: String(raw?.id || ""),
    nickname: String(raw?.nickname || raw?.name || "用户"),
    avatarUrl: String(raw?.avatarUrl || raw?.avatar || ""),
    points: Number(raw?.points || 0),
    levelName: String(raw?.levelName || "普通会员"),
    role: String(raw?.role || "user"),
    referralCode: raw?.referralCode ? String(raw.referralCode) : "",
    frozenPoints: Number(raw?.frozenPoints || 0),
    totalSpend: Number(raw?.totalSpend || 0),
    orderCount: Number(raw?.orderCount || 0),
    phone: raw?.phone ? String(raw.phone) : ""
  };
}

function normalizeDesign(raw: any): Design {
  return {
    id: String(raw?.id || ""),
    name: String(raw?.name || "未命名作品"),
    wristSize: Number(raw?.wristSize || 15),
    beads: safeJsonParse(raw?.beads),
    totalPrice: Number(raw?.totalPrice || 0),
    createdAt: Number(raw?.createdAt || Date.now()),
    likes: Number(raw?.likes || raw?.likeCount || 0),
    author: String(raw?.author || raw?.userName || ""),
    authorAvatar: String(raw?.authorAvatar || raw?.userAvatar || ""),
    imageUrl: typeof raw?.imageUrl === "string" ? raw.imageUrl : undefined,
    description: typeof raw?.description === "string" ? raw.description : undefined,
    plazaCategoryId: typeof raw?.plazaCategoryId === "string" ? raw.plazaCategoryId : undefined,
    isPinned: Boolean(raw?.isPinned)
  };
}

function normalizeOrder(raw: any): Order {
  const itemsRaw = safeJsonParse(raw?.items).map((item: any) => ({
    name: String(item?.name || "定制手串"),
    spec: typeof item?.spec === "string" ? item.spec : String(item?.description || ""),
    price: Number(item?.price || 0),
    count: Number(item?.count || 1)
  }));

  return {
    id: String(raw?.id || ""),
    orderNo: raw?.orderNo ? String(raw.orderNo) : "",
    items: itemsRaw,
    totalAmount: Number(raw?.payAmount || raw?.totalAmount || 0),
    payAmount: Number(raw?.payAmount || 0),
    status: String(raw?.status || "pending_payment"),
    createdAt: new Date(Number(raw?.createdAt || Date.now())).toISOString(),
    shippingAddress: typeof raw?.shippingAddress === "string" ? raw.shippingAddress : undefined,
    trackingNumber: typeof raw?.trackingNumber === "string" ? raw.trackingNumber : undefined,
    carrier: typeof raw?.carrier === "string" ? raw.carrier : undefined,
    remarks: typeof raw?.remarks === "string" ? raw.remarks : "",
    shippedAt: raw?.shippedAt ? Number(raw.shippedAt) : undefined,
    couponAmount: Number(raw?.couponAmount || 0),
    pointsUsed: Number(raw?.pointsUsed || 0),
    pointsDeductAmount: Number(raw?.pointsDeductAmount || 0),
    shippingFee: Number(raw?.shippingFee || 0),
    handworkFee: Number(raw?.handworkFee || 0)
  };
}

function normalizeAddress(raw: any): Address {
  return {
    id: String(raw?.id || ""),
    name: String(raw?.name || ""),
    phone: String(raw?.phone || ""),
    region: raw?.region == null ? null : String(raw.region),
    detail: String(raw?.detail || ""),
    tag: String(raw?.tag || "家"),
    isDefault: Boolean(raw?.isDefault)
  };
}

function normalizePointHistory(raw: any): PointHistoryItem {
  return {
    id: String(raw?.id || ""),
    type: String(raw?.type || ""),
    amount: Number(raw?.amount || 0),
    description: String(raw?.description || ""),
    createdAt: Number(raw?.createdAt || Date.now())
  };
}

function normalizeWithdrawal(raw: any): WithdrawalItem {
  return {
    id: String(raw?.id || ""),
    userId: String(raw?.userId || ""),
    userName: String(raw?.userName || ""),
    pointsAmount: Number(raw?.pointsAmount || 0),
    moneyAmount: Number(raw?.moneyAmount || 0),
    account: String(raw?.account || ""),
    status: String(raw?.status || "pending"),
    createdAt: Number(raw?.createdAt || Date.now()),
    processedAt: raw?.processedAt ? Number(raw.processedAt) : undefined,
    rejectReason: raw?.rejectReason ? String(raw.rejectReason) : ""
  };
}

function normalizeComplaint(raw: any): ComplaintItem {
  const replyMessages = Array.isArray(raw?.replyMessages)
    ? raw.replyMessages
        .map((item: any) => ({
          id: String(item?.id || ''),
          sender: item?.sender === 'system' ? 'system' : 'admin',
          content: String(item?.content || ''),
          createdAt: Number(item?.createdAt || Date.now())
        }))
        .filter((item: any) => item.id && item.content)
    : [];

  return {
    id: String(raw?.id || ""),
    userId: String(raw?.userId || ""),
    userName: String(raw?.userName || ""),
    type: String(raw?.type || "complaint"),
    title: String(raw?.title || ""),
    description: String(raw?.description || ""),
    images: Array.isArray(raw?.images) ? raw.images.map((item: unknown) => String(item)) : [],
    contact: String(raw?.contact || ""),
    status: String(raw?.status || "pending"),
    reply: String(raw?.reply || (replyMessages[replyMessages.length - 1]?.content || "")),
    replyMessages,
    createdAt: Number(raw?.createdAt || Date.now()),
    updatedAt: Number(raw?.updatedAt || Date.now()),
    resolvedAt: raw?.resolvedAt ? Number(raw.resolvedAt) : undefined
  };
}

function normalizeNotification(raw: any): NotificationItem {
  return {
    id: String(raw?.id || ""),
    userId: String(raw?.userId || ""),
    title: String(raw?.title || ""),
    content: String(raw?.content || ""),
    type: String(raw?.type || ""),
    bizId: raw?.bizId ? String(raw.bizId) : "",
    orderId: raw?.orderId ? String(raw.orderId) : "",
    complaintId: raw?.complaintId ? String(raw.complaintId) : "",
    readAt: raw?.readAt ? Number(raw.readAt) : undefined,
    createdAt: Number(raw?.createdAt || Date.now())
  };
}

function normalizeCartItem(raw: any): CartItem {
  const designRaw = raw?.design || {};
  const beads = Array.isArray(designRaw?.beads) ? designRaw.beads : [];
  return {
    id: String(raw?.id || ""),
    quantity: Math.max(1, Number(raw?.quantity || 1)),
    selected: Boolean(raw?.selected ?? true),
    design: {
      id: typeof designRaw?.id === "string" ? designRaw.id : "",
      name: String(designRaw?.name || "定制手串"),
      wristSize: Number(designRaw?.wristSize || 15),
      totalPrice: Number(designRaw?.totalPrice || 0),
      imageUrl: typeof designRaw?.imageUrl === "string" ? designRaw.imageUrl : "",
      beads: beads.map((item: any) => ({
        id: typeof item?.id === "string" ? item.id : "",
        name: typeof item?.name === "string" ? item.name : "",
        sizeMm: Number(item?.sizeMm || 0),
        price: Number(item?.price || 0),
        color: typeof item?.color === "string" ? item.color : ""
      }))
    },
    createdAt: Number(raw?.createdAt || Date.now()),
    updatedAt: Number(raw?.updatedAt || Date.now())
  };
}

function normalizeCouponTemplate(raw: any): CouponTemplate {
  return {
    id: String(raw?.id || ""),
    name: String(raw?.name || ""),
    description: String(raw?.description || ""),
    discountType: String(raw?.discountType || "fixed"),
    discountValue: Number(raw?.discountValue || 0),
    minAmount: Number(raw?.minAmount || 0),
    totalCount: Number(raw?.totalCount || 0),
    issuedCount: Number(raw?.issuedCount || 0),
    perUserLimit: Number(raw?.perUserLimit || 1),
    status: Number(raw?.status || 1),
    startAt: Number(raw?.startAt || Date.now()),
    endAt: Number(raw?.endAt || Date.now())
  };
}

function normalizeUserCoupon(raw: any): UserCoupon {
  return {
    id: String(raw?.id || ""),
    templateId: String(raw?.templateId || ""),
    status: String(raw?.status || "available"),
    obtainedAt: Number(raw?.obtainedAt || Date.now()),
    usedAt: raw?.usedAt ? Number(raw.usedAt) : undefined,
    orderId: raw?.orderId ? String(raw.orderId) : "",
    template: normalizeCouponTemplate(raw?.template || {})
  };
}

function normalizeAddOn(raw: any): AddOnProduct {
  return {
    id: String(raw?.id || ""),
    name: String(raw?.name || ""),
    price: Number(raw?.price || 0),
    image: String(raw?.image || ""),
    category: String(raw?.category || ""),
    inStock: Boolean(raw?.inStock ?? true),
    visible: raw?.visible !== false,
    note: raw?.note || ""
  };
}

async function request<T>(
  method: HttpMethod,
  url: string,
  data?: unknown,
  options?: { requireAuth?: boolean; headers?: Record<string, string> }
): Promise<T> {
  if (shouldBypassNetworkInDevtools()) {
    const mocked = mockDevtoolsTouristResponse<T>(method, url);
    if (mocked !== undefined) {
      return mocked as T;
    }
    throw new Error("当前为微信开发者工具游客 AppID 模式，已禁用本地接口请求。请配置真实 AppID 后重试。");
  }

  const requireAuth = options?.requireAuth !== false;
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  if (requireAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (requireAuth && !token) {
    throw new Error("请先登录");
  }

  let response: any;
  try {
    response = await Taro.request<ApiEnvelope<T>>({
      url: `${API_BASE_URL}${API_PREFIX}${url}`,
      method,
      data,
      header: headers
    });
  } catch (error: any) {
    const raw = String(error?.errMsg || error?.message || "");
    const lowered = raw.toLowerCase();
    if (lowered.includes("econnrefused") || lowered.includes("failed to connect") || lowered.includes("request:fail")) {
      throw new Error("后端未启动，请先运行本地后端服务(3001)");
    }
    throw new Error("网络异常，请稍后重试");
  }

  if (response.statusCode === 401) {
    clearToken();
    throw new Error("登录状态已失效，请重新登录");
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message = (response.data as any)?.message || `请求失败(${response.statusCode})`;
    throw new Error(message);
  }

  const envelope = response.data as any;
  if (!envelope || typeof envelope.code !== "number") {
    throw new Error("服务返回格式错误");
  }

  if (envelope.code !== 0) {
    throw new Error(envelope.message || "请求失败");
  }

  return envelope.data as T;
}

async function communityRequest<T>(method: HttpMethod, url: string, data?: unknown): Promise<T> {
  return request<T>(method, url, data, {
    headers: {
      "x-community-session-id": getCommunitySessionId()
    }
  });
}

async function getCurrentUserSafe(): Promise<User | null> {
  if (!getToken()) {
    return null;
  }

  try {
    const userRaw = await request<any>("GET", "/auth/me");
    return normalizeUser(userRaw);
  } catch {
    clearToken();
    return null;
  }
}

export const api = {
  request,
  auth: {
    login: async (): Promise<User> => {
      const loginRes = await Taro.login();
      if (!loginRes.code) {
        throw new Error("无法获取微信登录凭证");
      }

      let nickname: string | undefined;
      let avatar: string | undefined;
      try {
        const profile = await Taro.getUserProfile({ desc: "用于完善用户信息" });
        nickname = profile.userInfo?.nickName;
        avatar = profile.userInfo?.avatarUrl;
      } catch {
        // ignore
      }

      const referralCode = String(Taro.getStorageSync(PENDING_REFERRAL_KEY) || "")
        .trim()
        .toUpperCase();

      const loginPayload: Record<string, unknown> = {
        code: loginRes.code,
        nickname,
        avatar,
        referralCode: referralCode || undefined
      };

      if (process.env.NODE_ENV !== "production") {
        loginPayload.devOpenId = getDevOpenId();
      }

      const res = await request<{ token: string; user: any }>(
        "POST",
        "/auth/wechat",
        loginPayload,
        { requireAuth: false }
      );

      setToken(res.token);
      if (referralCode) {
        Taro.removeStorageSync(PENDING_REFERRAL_KEY);
      }
      return normalizeUser(res.user);
    },

    getCurrentUser: async (): Promise<User> => {
      const user = await getCurrentUserSafe();
      if (!user) {
        throw new Error("请先登录");
      }
      return user;
    },

    isLoggedIn: (): boolean => !!getToken(),

    logout: () => {
      clearToken();
    }
  },

  user: {
    updateProfile: async (payload: { name?: string; avatar?: string; phone?: string }): Promise<User> => {
      const updated = await request<any>("POST", "/user/me", payload || {});
      return normalizeUser(updated);
    }
  },

  banners: {
    list: async (): Promise<Banner[]> => {
      return request<Banner[]>("GET", "/system/banners", undefined, { requireAuth: false });
    }
  },

  designs: {
    list: async (): Promise<Design[]> => {
      const list = await request<any[]>("GET", "/user/designs");
      return (list || []).map(normalizeDesign);
    },

    get: async (id: string): Promise<Design> => {
      const all = await request<any[]>("GET", "/user/designs");
      const hit = (all || []).find((row) => String(row?.id) === String(id));
      if (!hit) {
        throw new Error("作品不存在");
      }
      return normalizeDesign(hit);
    },

    create: async (data: {
      name: string;
      wristSize: number;
      totalPrice: number;
      beadsData?: any[];
      beads?: any[];
      isPublic?: boolean;
      imageUrl?: string;
    }): Promise<{ id: string }> => {
      const payload = {
        name: data.name,
        wristSize: data.wristSize,
        totalPrice: data.totalPrice,
        beads: Array.isArray(data.beadsData)
          ? data.beadsData
          : Array.isArray(data.beads)
            ? data.beads
            : [],
        imageUrl: data.imageUrl || ""
      };

      const created = await request<any>("POST", "/user/designs", payload);
      return { id: String(created?.id || "") };
    },

    update: async (id: string, data: Partial<Design> & { beadsData?: any[] }): Promise<void> => {
      const payload = {
        id,
        name: data.name,
        wristSize: data.wristSize,
        totalPrice: data.totalPrice,
        beads: Array.isArray(data.beadsData)
          ? data.beadsData
          : Array.isArray(data.beads)
            ? data.beads
            : [],
        imageUrl: data.imageUrl || ""
      };
      await request("POST", "/user/designs", payload);
    },

    delete: async (id: string): Promise<void> => {
      await request("DELETE", `/user/designs/${id}`);
    },

    publish: async (id: string): Promise<void> => {
      const design = await api.designs.get(id);
      await request("POST", "/products/plaza", {
        name: design.name,
        wristSize: design.wristSize,
        beads: design.beads,
        totalPrice: design.totalPrice,
        imageUrl: design.imageUrl || "",
        plazaCategoryId: design.plazaCategoryId || "cat_bracelets"
      });
    }
  },

  plaza: {
    categories: async (): Promise<Array<{ id: string; name: string }>> => {
      const config = await request<any>("GET", "/system/config", undefined, { requireAuth: false });
      const categories = Array.isArray(config?.plazaCategories) ? config.plazaCategories : [];
      return categories
        .filter((item: any) => item?.visible !== false)
        .map((item: any) => ({ id: String(item.id), name: String(item.name) }));
    },

    list: async (params?: { categoryId?: string; limit?: number; offset?: number; q?: string; sort?: "new" | "hot" | "price_asc" | "price_desc" }): Promise<Design[]> => {
      const query = new URLSearchParams();
      if (params?.categoryId) query.set("categoryId", params.categoryId);
      if (params?.q) query.set("q", params.q);
      if (params?.sort) query.set("sort", params.sort);
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.offset) query.set("offset", String(params.offset));

      const qs = query.toString();
      const list = await request<any[]>("GET", `/products/plaza${qs ? `?${qs}` : ""}`, undefined, {
        requireAuth: false
      });
      return (list || []).map(normalizeDesign);
    },

    like: async (id: string, action: "like" | "unlike" = "like"): Promise<{ liked: boolean; likes: number }> => {
      return request<{ liked: boolean; likes: number }>("POST", `/products/plaza/${id}/like`, { action });
    }
  },

  community: {
    getSessionId: (): string => getCommunitySessionId(),

    drafts: {
      save: async (type: CommunityTaskType, payload: Record<string, unknown>): Promise<CommunityDraft> => {
        return communityRequest<CommunityDraft>("POST", "/community/drafts", { type, payload });
      },

      latest: async (): Promise<CommunityDraft | null> => {
        return communityRequest<CommunityDraft | null>("GET", "/community/drafts/latest");
      }
    },

    analysis: {
      bazi: async (payload: Record<string, unknown>): Promise<CommunityAnalysisResponse> => {
        return communityRequest<CommunityAnalysisResponse>("POST", "/community/analysis/bazi", payload);
      },

      liuyao: async (payload: Record<string, unknown>): Promise<CommunityAnalysisResponse> => {
        return communityRequest<CommunityAnalysisResponse>("POST", "/community/analysis/liuyao", payload);
      }
    },

    reports: {
      save: async (traceId: string, title?: string): Promise<CommunityReportListItem> => {
        return communityRequest<CommunityReportListItem>("POST", "/community/reports", { traceId, title });
      },

      list: async (): Promise<CommunityReportListItem[]> => {
        return communityRequest<CommunityReportListItem[]>("GET", "/community/reports");
      },

      get: async (id: string): Promise<CommunityReportDetail> => {
        return communityRequest<CommunityReportDetail>("GET", `/community/reports/${id}`);
      },

      delete: async (id: string): Promise<{ ok: boolean }> => {
        return communityRequest<{ ok: boolean }>("DELETE", `/community/reports/${id}`);
      }
    },

    recommend: {
      beads: async (tags: string[]): Promise<any> => {
        const query = new URLSearchParams();
        query.set("tags", Array.isArray(tags) ? tags.join(",") : "");
        const qs = query.toString();
        return communityRequest<any>("GET", `/community/recommend/beads${qs ? `?${qs}` : ""}`);
      }
    },

    events: {
      track: async (eventType: string, payload?: Record<string, unknown>): Promise<void> => {
        await communityRequest("POST", "/community/events", { eventType, payload: payload || {} });
      }
    }
  },

  orders: {
    list: async (): Promise<Order[]> => {
      const list = await request<any[]>("GET", "/orders");
      return (list || []).map(normalizeOrder);
    },

    get: async (id: string): Promise<Order> => {
      const order = await request<any>("GET", `/orders/${id}`);
      return normalizeOrder(order);
    },

    logistics: async (id: string): Promise<LogisticsEvent[]> => {
      const list = await request<any[]>("GET", `/orders/${id}/logistics`);
      return (Array.isArray(list) ? list : []).map((item) => ({
        time: Number(item?.time || Date.now()),
        title: String(item?.title || ""),
        detail: String(item?.detail || ""),
        location: item?.location ? String(item.location) : ""
      }));
    },

    preview: async (data: { designs: any[]; addOns?: any[] }): Promise<{ orderId: string; pricing: any }> => {
      return api.orders.create(data);
    },

    create: async (data: {
      designs: any[];
      addOns?: any[];
      shippingAddress?: string;
      remarks?: string;
      addressId?: string;
      couponId?: string;
      pointsToUse?: number;
      addOnItems?: Array<{ id: string; quantity: number }>;
    }): Promise<{ orderId: string; pricing: any }> => {
      const normalizedDesigns = (Array.isArray(data.designs) ? data.designs : []).map((design: any) => ({
        id: design?.id,
        name: design?.name,
        wristSize: Number(design?.wristSize || 15),
        beads: Array.isArray(design?.beads)
          ? design.beads
          : Array.isArray(design?.beadsData)
            ? design.beadsData
            : [],
        totalPrice: Number(design?.totalPrice || 0),
        imageUrl: design?.imageUrl || ""
      }));

      const normalizedAddOns = Array.isArray(data.addOnItems)
        ? data.addOnItems
        : Array.isArray(data.addOns)
          ? data.addOns
          : [];

      const order = await request<any>("POST", "/orders", {
        designs: normalizedDesigns,
        addOns: normalizedAddOns,
        addressId: data.addressId,
        shippingAddress: data.shippingAddress && data.shippingAddress.trim() ? data.shippingAddress.trim() : undefined,
        remarks: data.remarks || "",
        couponId: data.couponId,
        pointsToUse: Number(data.pointsToUse || 0),
      });

      return {
        orderId: String(order?.id || ""),
        pricing: {
          payAmount: Number(order?.payAmount || order?.totalAmount || 0),
          totalAmount: Number(order?.totalAmount || 0)
        }
      };
    },

    updateStatus: async (orderId: string, status: string): Promise<void> => {
      if (status === "pending_production") {
        const prepay = await request<any>("POST", "/payments/create", { orderId });
        const provider = String(prepay?.paymentParams?.provider || "mock");
        if (provider === "mock") {
          await request("POST", "/payments/mock-confirm", { orderId });
          return;
        }

        if (provider === "wechat") {
          const params = prepay?.paymentParams || {};
          await new Promise<void>((resolve, reject) => {
            Taro.requestPayment({
              timeStamp: String(params.timeStamp || ""),
              nonceStr: String(params.nonceStr || ""),
              package: String(params.package || ""),
              signType: String(params.signType || "RSA") as any,
              paySign: String(params.paySign || ""),
              success: () => resolve(),
              fail: (err) => reject(err)
            });
          });
          return;
        }

        throw new Error(`暂不支持的支付渠道: ${provider}`);
      }

      if (status === "cancelled") {
        await request("POST", `/orders/${orderId}/cancel`, {});
        return;
      }

      if (status === "completed") {
        await request("POST", `/orders/${orderId}/confirm`, {});
        return;
      }

      throw new Error(`暂不支持该状态操作: ${status}`);
    }
  },

  addOns: {
    list: async (): Promise<AddOnProduct[]> => {
      const list = await request<any[]>("GET", "/products/addons", undefined, { requireAuth: false });
      return (list || []).map(normalizeAddOn);
    }
  },

  addresses: {
    list: async (): Promise<Address[]> => {
      const list = await request<any[]>("GET", "/user/addresses");
      return (list || []).map(normalizeAddress);
    },

    get: async (id: string): Promise<Address> => {
      const list = await api.addresses.list();
      const hit = list.find((row) => row.id === String(id));
      if (!hit) {
        throw new Error("地址不存在");
      }
      return hit;
    },

    getDefault: async (): Promise<Address | null> => {
      const list = await api.addresses.list();
      return list.find((row) => row.isDefault) || null;
    },

    create: async (data: Omit<Address, "id">): Promise<{ id: string }> => {
      const created = await request<any>("POST", "/user/addresses", {
        name: data.name,
        phone: data.phone,
        region: data.region || "",
        detail: data.detail,
        tag: data.tag,
        isDefault: Boolean(data.isDefault)
      });
      return { id: String(created?.id || "") };
    },

    update: async (id: string, data: Partial<Address>): Promise<void> => {
      await request("PUT", `/user/addresses/${id}`, {
        name: data.name,
        phone: data.phone,
        region: data.region || "",
        detail: data.detail,
        tag: data.tag,
        isDefault: data.isDefault
      });
    },

    delete: async (id: string): Promise<void> => {
      await request("DELETE", `/user/addresses/${id}`);
    },

    setDefault: async (id: string): Promise<void> => {
      await request("POST", `/user/addresses/${id}/default`, {});
    }
  },

  cart: {
    list: async (): Promise<CartItem[]> => {
      const list = await request<any[]>("GET", "/user/cart");
      return (list || []).map(normalizeCartItem);
    },

    replace: async (items: Array<{ id?: string; quantity?: number; selected?: boolean; design: any }>): Promise<CartItem[]> => {
      const payload = Array.isArray(items)
        ? items.map((item) => ({
          id: item?.id,
          quantity: Math.max(1, Number(item?.quantity || 1)),
          selected: Boolean(item?.selected ?? true),
          design: item?.design || {}
        }))
        : [];
      const list = await request<any[]>("PUT", "/user/cart", payload);
      return (list || []).map(normalizeCartItem);
    },

    add: async (item: { id?: string; quantity?: number; selected?: boolean; design: any }): Promise<CartItem> => {
      const created = await request<any>("POST", "/user/cart/items", {
        id: item?.id,
        quantity: Math.max(1, Number(item?.quantity || 1)),
        selected: Boolean(item?.selected ?? true),
        design: item?.design || {}
      });
      return normalizeCartItem(created);
    },

    update: async (
      id: string,
      payload: { quantity?: number; selected?: boolean; design?: any }
    ): Promise<CartItem> => {
      const updated = await request<any>("PATCH", `/user/cart/items/${id}`, payload || {});
      return normalizeCartItem(updated);
    },

    remove: async (id: string): Promise<void> => {
      await request("DELETE", `/user/cart/items/${id}`);
    }
  },

  points: {
    history: async (): Promise<PointHistoryItem[]> => {
      const list = await request<any[]>("GET", "/user/points/history");
      return (list || []).map(normalizePointHistory);
    }
  },

  withdrawals: {
    list: async (): Promise<WithdrawalItem[]> => {
      const list = await request<any[]>("GET", "/user/withdrawals");
      return (list || []).map(normalizeWithdrawal);
    },

    create: async (payload: { moneyAmount: number; account: string }): Promise<WithdrawalItem> => {
      const created = await request<any>("POST", "/user/withdrawals", payload);
      return normalizeWithdrawal(created);
    }
  },

  complaints: {
    list: async (): Promise<ComplaintItem[]> => {
      const list = await request<any[]>("GET", "/complaints");
      return (list || []).map(normalizeComplaint);
    },

    create: async (payload: {
      type: "complaint" | "appeal";
      title: string;
      content: string;
      contact?: string;
      images?: string[];
    }): Promise<ComplaintItem> => {
      const created = await request<any>("POST", "/complaints", payload);
      return normalizeComplaint(created);
    }
  },

  notifications: {
    list: async (params?: { limit?: number; offset?: number }): Promise<{ list: NotificationItem[]; unreadCount: number }> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.offset) query.set("offset", String(params.offset));
      const qs = query.toString();
      const data = await request<{ list: any[]; unreadCount: number }>(
        "GET",
        `/user/notifications${qs ? `?${qs}` : ""}`
      );
      return {
        list: Array.isArray(data?.list) ? data.list.map(normalizeNotification) : [],
        unreadCount: Number(data?.unreadCount || 0)
      };
    },

    read: async (id: string): Promise<void> => {
      await request("POST", `/user/notifications/${id}/read`, {});
    },

    readAll: async (): Promise<void> => {
      await request("POST", "/user/notifications/read-all", {});
    }
  },

  coupons: {
    templates: async (): Promise<CouponTemplate[]> => {
      const list = await request<any[]>("GET", "/coupons/templates", undefined, { requireAuth: false });
      return (list || []).map(normalizeCouponTemplate);
    },

    mine: async (): Promise<UserCoupon[]> => {
      const list = await request<any[]>("GET", "/user/coupons");
      return (list || []).map(normalizeUserCoupon);
    },

    claim: async (templateId: string): Promise<UserCoupon> => {
      const coupon = await request<any>("POST", `/user/coupons/claim/${templateId}`, {});
      return normalizeUserCoupon(coupon);
    }
  },

  upload: {
    imageBase64: async (base64: string): Promise<{ url: string; path: string; fileName: string }> => {
      return request<{ url: string; path: string; fileName: string }>("POST", "/uploads/image", { base64 });
    }
  },

  analytics: {
    track: async (eventType: string, payload?: Record<string, unknown>, page?: string): Promise<void> => {
      if (!eventType) return;
      await request(
        "POST",
        "/analytics/events",
        {
          eventType,
          page: page || "",
          payload: payload || {}
        },
        { requireAuth: false }
      );
    }
  },

  config: {
    get: async (): Promise<SystemConfig> => {
      try {
        const remote = await request<any>("GET", "/system/config", undefined, { requireAuth: false });
        return {
          ...DEFAULT_CONFIG,
          ...remote,
          wristValidation: {
            ...DEFAULT_CONFIG.wristValidation,
            ...(remote?.wristValidation || {})
          },
          inventoryTree:
            remote?.inventoryTree && Array.isArray(remote.inventoryTree.mainCategories)
              ? remote.inventoryTree
              : DEFAULT_CONFIG.inventoryTree,
          features: {
            ...DEFAULT_CONFIG.features,
            ...(remote?.features || {})
          },
          agreements: {
            ...(DEFAULT_CONFIG as any).agreements,
            ...(remote?.agreements || {})
          },
          messageTemplates: {
            ...(DEFAULT_CONFIG as any).messageTemplates,
            ...(remote?.messageTemplates || {})
          }
        };
      } catch (error) {
        if (process.env.NODE_ENV === "production") {
          throw error;
        }
        return DEFAULT_CONFIG;
      }
    }
  }
};

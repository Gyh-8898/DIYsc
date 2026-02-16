import {
  Address,
  AddOnProduct,
  AdminAuditLog,
  AdminOpsSelfCheck,
  Banner,
  CouponIssueStats,
  CouponTemplate,
  Complaint,
  Design,
  AnalyticsOverview,
  LogisticEvent,
  Order,
  OrderStatus,
  PointsCampaign,
  PointsDashboard,
  PointsGrantTask,
  PointHistory,
  PointsLedgerRow,
  PointsRiskRule,
  PointsRule,
  SystemConfig,
  User,
  AiProviderConfigView,
  AiModelRegistryView,
  AiRouterRuleView,
  AiPromptTemplateView,
  AiPolicyRuleView,
  CommunityTagMappingView,
  AdminAiDashboardView
} from '../types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';
const TOKEN_KEY = 'auth_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: HttpMethod, endpoint: string, body?: unknown, withAuth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const token = getToken();
  if (withAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch (_error) {
    payload = null;
  }

  if (response.status === 401) {
    removeToken();
    throw new Error(payload?.message || 'Unauthorized');
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  if (!payload || payload.code !== 0) {
    throw new Error(payload?.message || 'API error');
  }

  return payload.data;
}

export const MockAPI = {
  login: async (username?: string, password?: string): Promise<User> => {
    const finalUsername = username || (import.meta as any).env?.VITE_ADMIN_USERNAME || 'admin';
    const finalPassword = password || (import.meta as any).env?.VITE_ADMIN_PASSWORD || 'admin123';

    const result = await request<{ token: string; user: User }>(
      'POST',
      '/api/auth/login',
      {
        username: finalUsername,
        password: finalPassword
      },
      false
    );

    setToken(result.token);
    return result.user;
  },

  logout: () => {
    removeToken();
  },

  getCurrentUser: async (): Promise<User> => {
    return request<User>('GET', '/api/auth/me');
  },

  getAllUsers: async (): Promise<User[]> => {
    return request<User[]>('GET', '/api/admin/users');
  },

  saveUser: async (user: Partial<User>) => {
    return request('POST', '/api/user/me', user);
  },

  getPointHistory: async (userId: string): Promise<PointHistory[]> => {
    return request<PointHistory[]>('GET', `/api/admin/users/${userId}/points`);
  },

  getWithdrawals: async () => {
    return request<any[]>('GET', '/api/admin/withdrawals');
  },

  approveWithdrawal: async (id: string) => {
    return request('POST', `/api/admin/withdrawals/${id}/approve`, {});
  },

  rejectWithdrawal: async (id: string, reason = 'Rejected by admin') => {
    return request('POST', `/api/admin/withdrawals/${id}/reject`, { reason });
  },

  getUserAddresses: async (userId: string): Promise<Address[]> => {
    return request<Address[]>('GET', `/api/admin/users/${userId}/addresses`);
  },

  addUserAddress: async (addr: Address) => {
    return request('POST', '/api/user/addresses', addr);
  },

  getComplaints: async (): Promise<Complaint[]> => {
    return request<Complaint[]>('GET', '/api/admin/complaints');
  },

  getComplaintDetail: async (id: string): Promise<Complaint> => {
    return request<Complaint>('GET', `/api/admin/complaints/${id}`);
  },

  addComplaint: async (complaint: Partial<Complaint>) => {
    return request('POST', '/api/complaints', complaint);
  },

  resolveComplaint: async (id: string, status: 'resolved' | 'rejected' = 'resolved', reply = '') => {
    const action = status === 'rejected' ? 'reject' : 'resolve';
    return request('POST', `/api/admin/complaints/${id}/${action}`, { status, reply });
  },

  replyComplaint: async (id: string, status: 'processing' | 'resolved' | 'rejected' = 'processing', reply = '') => {
    return request('POST', `/api/admin/complaints/${id}/reply`, { status, reply });
  },

  getAllOrders: async (): Promise<Order[]> => {
    return request<Order[]>('GET', '/api/admin/orders');
  },

  getOrdersByUser: async (userId: string): Promise<Order[]> => {
    return request<Order[]>('GET', `/api/admin/users/${userId}/orders`);
  },

  getOrderById: async (id: string): Promise<Order> => {
    return request<Order>('GET', `/api/orders/${id}`);
  },

  createOrder: async (payload: {
    designs: Design[];
    addressId?: string;
    shippingAddress?: string;
    remarks?: string;
    couponId?: string;
    pointsToUse?: number;
    clientAmount?: number;
  }): Promise<Order> => {
    return request<Order>('POST', '/api/orders', payload);
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus) => {
    if (status === 'pending_production') {
      throw new Error('Please use payment APIs to complete order payment');
    }
    if (status === 'completed') {
      return request('POST', `/api/orders/${orderId}/confirm`, {});
    }
    if (status === 'cancelled') {
      return request('POST', `/api/orders/${orderId}/cancel`, {});
    }
    return Promise.resolve({ success: true });
  },

  shipOrder: async (orderId: string, carrier: string, trackingNumber: string) => {
    return request('POST', `/api/admin/orders/${orderId}/ship`, {
      carrier,
      trackingNumber
    });
  },

  createPayment: async (orderId: string) => {
    return request<any>('POST', '/api/payments/create', { orderId });
  },

  notifyPayment: async (payload: { orderId?: string; orderNo?: string; transactionId?: string; paidAt?: number | string }) => {
    return request<any>('POST', '/api/payments/notify', payload, false);
  },

  getLogistics: async (order: Order): Promise<LogisticEvent[]> => {
    return request<LogisticEvent[]>('GET', `/api/orders/${order.id}/logistics`);
  },

  getDesignsForUser: async (): Promise<Design[]> => {
    return request<Design[]>('GET', '/api/user/designs');
  },

  saveUserDesign: async (design: Design) => {
    return request('POST', '/api/user/designs', design);
  },

  deleteDesign: async (id: string) => {
    return request('DELETE', `/api/user/designs/${id}`);
  },

  getPlazaDesigns: async (params?: { q?: string; categoryId?: string; sort?: 'new' | 'hot' | 'price_asc' | 'price_desc' }): Promise<Design[]> => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return request<Design[]>('GET', `/api/products/plaza${qs ? `?${qs}` : ''}`);
  },

  publishDesignToPlaza: async (design: Design) => {
    return request('POST', '/api/products/plaza', design);
  },

  likePlazaDesign: async (designId: string, action: 'like' | 'unlike') => {
    return request('POST', `/api/products/plaza/${designId}/like`, { action });
  },

  deletePlazaDesign: async (id: string) => {
    return request('DELETE', `/api/admin/plaza/${id}`);
  },

  pinPlazaDesign: async (id: string, pinned: boolean) => {
    return request('POST', `/api/admin/plaza/${id}/pin`, { pinned });
  },

  getAddOns: async (): Promise<AddOnProduct[]> => {
    return request<AddOnProduct[]>('GET', '/api/products/addons');
  },

  saveAddOns: async (addons: AddOnProduct[]) => {
    return request<AddOnProduct[]>('POST', '/api/admin/addons', addons);
  },

  getSystemConfig: async (): Promise<SystemConfig> => {
    return request<SystemConfig>('GET', '/api/admin/system/config');
  },

  updateSystemConfig: async (config: SystemConfig) => {
    return request<SystemConfig>('POST', '/api/system/config', config);
  },

  getBanners: async (): Promise<Banner[]> => {
    return request<Banner[]>('GET', '/api/system/banners', undefined, false);
  },

  uploadImage: async (base64OrDataUrl: string, storage: 'auto' | 'local' | 'qiniu' = 'auto') => {
    return request<{ fileName: string; url: string; path?: string; key?: string; storage: 'local' | 'qiniu' }>(
      'POST',
      '/api/uploads/image',
      { base64: base64OrDataUrl, storage }
    );
  },

  getAdminCouponTemplates: async (): Promise<CouponTemplate[]> => {
    return request<CouponTemplate[]>('GET', '/api/admin/coupons/templates');
  },

  createAdminCouponTemplate: async (payload: Partial<CouponTemplate>) => {
    return request<CouponTemplate>('POST', '/api/admin/coupons/templates', payload);
  },

  updateAdminCouponTemplate: async (id: string, payload: Partial<CouponTemplate>) => {
    return request<CouponTemplate>('PUT', `/api/admin/coupons/templates/${id}`, payload);
  },

  issueAdminCoupons: async (payload: { templateId: string; mode: 'specific' | 'all' | 'level'; userIds?: string[]; levelId?: number }) => {
    return request<{ requested: number; issued: number; skipped: number }>('POST', '/api/admin/coupons/issue', payload);
  },

  getAdminCouponStats: async (): Promise<CouponIssueStats> => {
    return request<CouponIssueStats>('GET', '/api/admin/coupons/stats');
  },

  getAdminAnalytics: async (days: 1 | 7 | 30 = 7): Promise<AnalyticsOverview> => {
    return request<AnalyticsOverview>('GET', `/api/admin/analytics?days=${days}`);
  },

  getAdminPointsRules: async (): Promise<PointsRule[]> => {
    return request<PointsRule[]>('GET', '/api/admin/points/rules');
  },

  createAdminPointsRule: async (payload: Partial<PointsRule>) => {
    return request<PointsRule>('POST', '/api/admin/points/rules', payload);
  },

  updateAdminPointsRule: async (id: string, payload: Partial<PointsRule>) => {
    return request<PointsRule>('PUT', `/api/admin/points/rules/${id}`, payload);
  },

  toggleAdminPointsRule: async (id: string, enabled: boolean) => {
    return request<PointsRule>('POST', `/api/admin/points/rules/${id}/toggle`, { enabled });
  },

  getAdminPointsCampaigns: async (): Promise<PointsCampaign[]> => {
    return request<PointsCampaign[]>('GET', '/api/admin/points/campaigns');
  },

  createAdminPointsCampaign: async (payload: Partial<PointsCampaign>) => {
    return request<PointsCampaign>('POST', '/api/admin/points/campaigns', payload);
  },

  updateAdminPointsCampaign: async (id: string, payload: Partial<PointsCampaign>) => {
    return request<PointsCampaign>('PUT', `/api/admin/points/campaigns/${id}`, payload);
  },

  toggleAdminPointsCampaign: async (id: string, enabled: boolean) => {
    return request<PointsCampaign>('POST', `/api/admin/points/campaigns/${id}/toggle`, { enabled });
  },

  getAdminPointsRiskRules: async (): Promise<PointsRiskRule[]> => {
    return request<PointsRiskRule[]>('GET', '/api/admin/points/risk-rules');
  },

  createAdminPointsRiskRule: async (payload: Partial<PointsRiskRule>) => {
    return request<PointsRiskRule>('POST', '/api/admin/points/risk-rules', payload);
  },

  updateAdminPointsRiskRule: async (id: string, payload: Partial<PointsRiskRule>) => {
    return request<PointsRiskRule>('PUT', `/api/admin/points/risk-rules/${id}`, payload);
  },

  toggleAdminPointsRiskRule: async (id: string, enabled: boolean) => {
    return request<PointsRiskRule>('POST', `/api/admin/points/risk-rules/${id}/toggle`, { enabled });
  },

  getAdminPointsLedger: async (params?: { userId?: string; type?: string; dateFrom?: number; dateTo?: number; limit?: number }): Promise<PointsLedgerRow[]> => {
    const query = new URLSearchParams();
    if (params?.userId) query.set('userId', params.userId);
    if (params?.type) query.set('type', params.type);
    if (params?.dateFrom) query.set('dateFrom', String(params.dateFrom));
    if (params?.dateTo) query.set('dateTo', String(params.dateTo));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<PointsLedgerRow[]>('GET', `/api/admin/points/ledger${qs ? `?${qs}` : ''}`);
  },

  getAdminPointsGrantTasks: async (limit = 50): Promise<PointsGrantTask[]> => {
    return request<PointsGrantTask[]>('GET', `/api/admin/points/grants?limit=${Math.max(10, Math.min(200, Number(limit || 50)))}`);
  },

  createAdminPointsGrantTask: async (payload: {
    grantType: 'add' | 'deduct' | 'freeze' | 'unfreeze';
    targetType: 'user' | 'level' | 'all';
    userIds?: string[];
    levelId?: number;
    points: number;
    reasonCode: string;
    remark?: string;
  }) => {
    return request<PointsGrantTask>('POST', '/api/admin/points/grants', payload);
  },

  getAdminPointsDashboard: async (days: 1 | 7 | 30 = 7): Promise<PointsDashboard> => {
    return request<PointsDashboard>('GET', `/api/admin/points/dashboard?days=${days}`);
  },

  getAdminOpsSelfCheck: async (): Promise<AdminOpsSelfCheck> => {
    return request<AdminOpsSelfCheck>('GET', '/api/admin/ops/self-check');
  },

  getAdminAuditLogs: async (limit = 100): Promise<AdminAuditLog[]> => {
    return request<AdminAuditLog[]>('GET', `/api/admin/audit-logs?limit=${Math.max(10, Math.min(500, Number(limit || 100)))}`);
  },

  getAdminAiProviders: async (): Promise<AiProviderConfigView[]> => {
    return request<AiProviderConfigView[]>('GET', '/api/admin/ai/providers');
  },

  saveAdminAiProvider: async (provider: string, payload: Record<string, unknown>): Promise<AiProviderConfigView> => {
    return request<AiProviderConfigView>('PUT', `/api/admin/ai/providers/${encodeURIComponent(provider)}`, payload);
  },

  testAdminAiProvider: async (provider: string): Promise<{ ok: boolean; status: number; latencyMs: number; sample: Array<{ id?: string; name?: string; displayName?: string }> }> => {
    return request<any>('POST', `/api/admin/ai/providers/${encodeURIComponent(provider)}/test`, {});
  },

  getAdminAiModels: async (): Promise<AiModelRegistryView[]> => {
    return request<AiModelRegistryView[]>('GET', '/api/admin/ai/models');
  },

  createAdminAiModel: async (payload: Record<string, unknown>): Promise<AiModelRegistryView> => {
    return request<AiModelRegistryView>('POST', '/api/admin/ai/models', payload);
  },

  updateAdminAiModel: async (id: string, payload: Record<string, unknown>): Promise<AiModelRegistryView> => {
    return request<AiModelRegistryView>('PUT', `/api/admin/ai/models/${id}`, payload);
  },

  getAdminAiRouterRules: async (): Promise<AiRouterRuleView> => {
    return request<AiRouterRuleView>('GET', '/api/admin/ai/router-rules');
  },

  updateAdminAiRouterRules: async (payload: Record<string, unknown>): Promise<AiRouterRuleView> => {
    return request<AiRouterRuleView>('PUT', '/api/admin/ai/router-rules', payload);
  },

  getAdminAiPrompts: async (taskType?: string): Promise<AiPromptTemplateView[]> => {
    const qs = taskType ? `?taskType=${encodeURIComponent(taskType)}` : '';
    return request<AiPromptTemplateView[]>('GET', `/api/admin/ai/prompts${qs}`);
  },

  createAdminAiPrompt: async (payload: Record<string, unknown>): Promise<AiPromptTemplateView> => {
    return request<AiPromptTemplateView>('POST', '/api/admin/ai/prompts', payload);
  },

  updateAdminAiPrompt: async (id: string, payload: Record<string, unknown>): Promise<AiPromptTemplateView> => {
    return request<AiPromptTemplateView>('PUT', `/api/admin/ai/prompts/${id}`, payload);
  },

  getAdminAiPolicies: async (): Promise<AiPolicyRuleView[]> => {
    return request<AiPolicyRuleView[]>('GET', '/api/admin/ai/policies');
  },

  updateAdminAiPolicy: async (key: string, payload: Record<string, unknown>): Promise<AiPolicyRuleView> => {
    return request<AiPolicyRuleView>('PUT', `/api/admin/ai/policies/${encodeURIComponent(key)}`, payload);
  },

  getAdminAiTagMappings: async (): Promise<CommunityTagMappingView[]> => {
    return request<CommunityTagMappingView[]>('GET', '/api/admin/ai/tag-mappings');
  },

  updateAdminAiTagMapping: async (tag: string, payload: Record<string, unknown>): Promise<CommunityTagMappingView> => {
    return request<CommunityTagMappingView>('PUT', `/api/admin/ai/tag-mappings/${encodeURIComponent(tag)}`, payload);
  },

  getAdminAiDashboard: async (days: 1 | 7 | 30 = 7): Promise<AdminAiDashboardView> => {
    return request<AdminAiDashboardView>('GET', `/api/admin/ai/dashboard?days=${days}`);
  }
};

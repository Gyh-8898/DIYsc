import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Sparkles,
  Ticket,
  Grid,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Plug,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserPlus,
  Users
} from 'lucide-react';
import { DEFAULT_INVENTORY_TREE } from '../constants';
import {
  AddOnProduct,
  AdminAuditLog,
  AdminOpsSelfCheck,
  AnalyticsOverview,
  CouponIssueStats,
  Complaint,
  CouponTemplate,
  Design,
  Order,
  SystemConfig,
  User,
  WithdrawalRequest
} from '../types';
import { MockAPI } from '../services/api';
import AdminAnalytics from './admin/Admin-Analytics';
import AdminAffiliate from './admin/Admin-Affiliate';
import AdminComplaints from './admin/Admin-Complaints';
import AdminConfig from './admin/Admin-Config';
import AdminCommunityAI from './admin/Admin-CommunityAI';
import AdminCoupons from './admin/Admin-Coupons';
import AdminOrders from './admin/Admin-Orders';
import AdminPlaza from './admin/Admin-Plaza';
import AdminProducts from './admin/Admin-Products';
import AdminIntegrations from './admin/Admin-Integrations';
import AdminOps from './admin/Admin-Ops';
import AdminPoints from './admin/Admin-Points';
import AdminUsers from './admin/Admin-Users';

interface AdminDashboardProps {
  onLogout: () => void;
  api: typeof MockAPI;
}

type DashboardTab = 'config' | 'integrations' | 'community_ai' | 'products' | 'plaza' | 'users' | 'orders' | 'affiliate' | 'points' | 'complaints' | 'coupons' | 'analytics' | 'ops';

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({
  message,
  type,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed left-1/2 top-6 z-[100] -translate-x-1/2 rounded-full px-5 py-2 text-sm font-semibold shadow-xl ${type === 'success' ? 'bg-[#1f2937] text-white' : 'bg-red-500 text-white'
        }`}
    >
      <span className="inline-flex items-center gap-2">
        {type === 'success' ? <CheckCircle2 size={16} className="text-[#07c160]" /> : <AlertCircle size={16} />}
        {message}
      </span>
    </div>
  );
};

function applyConfigDefaults(config: SystemConfig): SystemConfig {
  return {
    ...config,
    appUI: config.appUI || {
      appTitle: '晶奥之境',
      logoUrl: '',
      homeBanner: { imageUrl: '', title: '', subtitle: '' }
    },
    features: config.features || {
      enableTrade: true,
      enableAffiliate: true,
      enableCommunity: true,
      showPrice: true,
      enableAddOns: true
    },
    business: config.business || {
      freeShippingThreshold: 99,
      baseShippingFee: 10,
      handworkFee: 3,
      customerServiceLink: ''
    },
    affiliate: config.affiliate || {
      pointsPerYuan: 5,
      commissionRatePercent: 10,
      pointsToMoneyRate: 0.01,
      minWithdrawPoints: 1000,
      pointsRuleText: '',
      announcementText: ''
    },
    support: config.support || {
      wechat: '',
      phone: '',
      serviceHours: '09:00-21:00',
      faq: [
        { question: '下单后多久发货？', answer: '通常1-3天内完成制作并发货。' },
        { question: '可以修改地址吗？', answer: '未发货前可联系客服处理。' }
      ]
    },
    agreements: config.agreements || {
      user: '',
      privacy: '',
      distribution: ''
    },
    messageTemplates: config.messageTemplates || {
      orderPaid: '',
      orderShipped: '',
      promotion: ''
    },
    mediaLibrary: Array.isArray(config.mediaLibrary) ? config.mediaLibrary : [],
    designerUI: {
      watermarkUrl: config.designerUI?.watermarkUrl || '',
      beadGapMm: Number(config.designerUI?.beadGapMm || 1)
    },
    wristValidation: config.wristValidation || {
      toleranceMm: 20,
      overflowMessage: '手围偏大，请减少珠子',
      underflowMessage: '手围偏小，请继续添加珠子'
    },
    plazaCategories: config.plazaCategories || [],
    plazaPinnedIds: Array.isArray(config.plazaPinnedIds) ? config.plazaPinnedIds : [],
    inventoryTree: config.inventoryTree || DEFAULT_INVENTORY_TREE,
    integrations: {
      payment: {
        provider: config.integrations?.payment?.provider || 'wechat',
        enabled: Boolean(config.integrations?.payment?.enabled),
        appId: config.integrations?.payment?.appId || '',
        mchId: config.integrations?.payment?.mchId || '',
        mchKey: config.integrations?.payment?.mchKey || '',
        notifyUrl: config.integrations?.payment?.notifyUrl || ''
      },
      logistics: {
        provider: config.integrations?.logistics?.provider || 'manual',
        enabled: Boolean(config.integrations?.logistics?.enabled),
        companyId: config.integrations?.logistics?.companyId || '',
        apiKey: config.integrations?.logistics?.apiKey || '',
        apiSecret: config.integrations?.logistics?.apiSecret || ''
      },
      qiniu: {
        enabled: Boolean(config.integrations?.qiniu?.enabled),
        accessKey: config.integrations?.qiniu?.accessKey || '',
        secretKey: config.integrations?.qiniu?.secretKey || '',
        bucket: config.integrations?.qiniu?.bucket || '',
        domain: config.integrations?.qiniu?.domain || '',
        region: config.integrations?.qiniu?.region || 'z2'
      },
      platforms: config.integrations?.platforms || []
    }
  };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, api }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [addOns, setAddOns] = useState<AddOnProduct[]>([]);
  const [couponTemplates, setCouponTemplates] = useState<CouponTemplate[]>([]);
  const [couponStats, setCouponStats] = useState<CouponIssueStats | null>(null);
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<1 | 7 | 30>(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [opsSelfCheck, setOpsSelfCheck] = useState<AdminOpsSelfCheck | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const fetchOpsData = async () => {
    const [checkRes, auditRes] = await Promise.all([
      api.getAdminOpsSelfCheck().catch(() => null),
      api.getAdminAuditLogs(100).catch(() => [])
    ]);
    return { checkRes, auditRes };
  };

  const refreshCouponData = async () => {
    const [templates, stats] = await Promise.all([
      api.getAdminCouponTemplates().catch(() => []),
      api.getAdminCouponStats().catch(() => null)
    ]);
    setCouponTemplates(templates);
    setCouponStats(stats);
  };

  const refreshAnalytics = async (days: 1 | 7 | 30 = analyticsRange) => {
    setAnalyticsLoading(true);
    try {
      const rows = await api.getAdminAnalytics(days).catch(() => null);
      setAnalyticsOverview(rows);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const refreshOps = async () => {
    setOpsLoading(true);
    try {
      const { checkRes, auditRes } = await fetchOpsData();
      setOpsSelfCheck(checkRes);
      setAuditLogs(auditRes);
    } finally {
      setOpsLoading(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configRes, usersRes, ordersRes, withdrawalsRes, plazaRes, complaintsRes, addOnsRes, couponsRes, couponStatsRes, opsData] =
        await Promise.all([
          api.getSystemConfig(),
          api.getAllUsers().catch(() => []),
          api.getAllOrders().catch(() => []),
          api.getWithdrawals().catch(() => []),
          api.getPlazaDesigns().catch(() => []),
          api.getComplaints().catch(() => []),
          api.getAddOns().catch(() => []),
          api.getAdminCouponTemplates().catch(() => []),
          api.getAdminCouponStats().catch(() => null),
          fetchOpsData()
        ]);

      setConfig(applyConfigDefaults(configRes));
      setUsers(usersRes);
      setOrders(ordersRes);
      setWithdrawals(withdrawalsRes);
      setDesigns(plazaRes);
      setComplaints(complaintsRes);
      setAddOns(addOnsRes);
      setCouponTemplates(couponsRes);
      setCouponStats(couponStatsRes);
      setOpsSelfCheck(opsData.checkRes);
      setAuditLogs(opsData.auditRes);
      await refreshAnalytics(analyticsRange);
    } catch (error) {
      console.error('Failed to load admin dashboard data:', error);
      showToast('后台数据加载失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    refreshAnalytics(analyticsRange);
  }, [analyticsRange]);

  const saveConfig = async (nextConfig?: SystemConfig) => {
    const target = nextConfig || config;
    if (!target) return;

    if (nextConfig) {
      setConfig(nextConfig);
    }

    setIsLoading(true);
    try {
      const saved = await api.updateSystemConfig(target);
      setConfig(applyConfigDefaults(saved));
      showToast('配置已保存');
    } catch (error) {
      console.error('Failed to save config:', error);
      showToast('保存失败，请重试', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrders = async () => {
    try {
      const rows = await api.getAllOrders();
      setOrders(rows);
    } catch (error) {
      console.error('Failed to refresh orders:', error);
      showToast('订单刷新失败', 'error');
    }
  };

  if (!config) {
    return <div className="flex min-h-screen items-center justify-center">后台加载中...</div>;
  }

  const tabs: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: 'config', label: '基础配置', icon: Settings },
    { id: 'integrations', label: '第三方对接', icon: Plug },
    { id: 'community_ai', label: '社区AI', icon: Sparkles },
    { id: 'products', label: '商品库存', icon: Package },
    { id: 'plaza', label: '作品广场', icon: Grid },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'orders', label: '订单管理', icon: ShoppingBag },
    { id: 'affiliate', label: '分销提现', icon: UserPlus },
    { id: 'points', label: '积分运营', icon: Ticket },
    { id: 'complaints', label: '投诉申诉', icon: MessageSquare },
    { id: 'coupons', label: '优惠券', icon: Ticket },
    { id: 'analytics', label: '数据分析', icon: BarChart3 },
    { id: 'ops', label: '系统自检', icon: ShieldCheck }
  ];

  const tabTitleMap: Record<DashboardTab, string> = {
    config: '基础配置与功能',
    integrations: '第三方服务对接',
    community_ai: '社区AI与模型配置',
    products: '商品库存管理',
    plaza: '广场与作品审核',
    users: '用户全景管理',
    orders: '订单处理中心',
    affiliate: '分销与提现处理',
    points: '积分运营与营销规则',
    complaints: '投诉与申诉处理',
    coupons: '优惠券与营销工具',
    analytics: '运营数据分析',
    ops: '系统自检与发布保障'
  };

  const canSaveConfig = activeTab === 'config' || activeTab === 'integrations' || activeTab === 'products' || activeTab === 'plaza';

  return (
    <div className="relative flex h-screen overflow-hidden bg-gray-100 font-sans text-gray-800">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto bg-[#1a1c23] text-white">
        <div className="shrink-0 border-b border-gray-700 p-6">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <LayoutDashboard className="text-[#07c160]" />
            后台管理
          </h1>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${selected ? 'bg-[#07c160] text-white' : 'text-gray-400 hover:bg-gray-800'
                  }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-gray-700 p-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-gray-400 transition-colors hover:text-white"
          >
            <LogOut size={18} />
            退出
          </button>
        </div>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden">
        <header className="z-10 mb-8 flex shrink-0 items-center justify-between bg-white px-8 py-4 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800">{tabTitleMap[activeTab]}</h2>
          {canSaveConfig ? (
            <button
              type="button"
              onClick={() => saveConfig()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-[#07c160] px-4 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#06ad56] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Save size={16} />
              保存配置
            </button>
          ) : activeTab === 'ops' ? (
            <button
              type="button"
              onClick={refreshOps}
              disabled={opsLoading}
              className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              刷新自检
            </button>
          ) : null}
        </header>

        <main className="flex-1 overflow-y-auto px-8 pb-12">
          {activeTab === 'config' && <AdminConfig config={config} setConfig={setConfig} onSave={() => saveConfig()} />}

          {activeTab === 'integrations' && <AdminIntegrations config={config} setConfig={setConfig} onSave={() => saveConfig()} />}

          {activeTab === 'community_ai' && <AdminCommunityAI api={api} />}

          {activeTab === 'products' && (
            <AdminProducts
              config={config}
              setConfig={setConfig}
              addOns={addOns}
              setAddOns={setAddOns}
              onSaveAddOns={api.saveAddOns}
              onSaveConfig={saveConfig}
            />
          )}

          {activeTab === 'plaza' && (
            <AdminPlaza
              designs={designs}
              config={config}
              setConfig={setConfig}
              onSaveConfig={saveConfig}
              onTogglePin={async (id, pinned) => {
                try {
                  await api.pinPlazaDesign(id, pinned);
                  setDesigns(await api.getPlazaDesigns());
                  showToast(pinned ? '已置顶' : '已取消置顶');
                } catch (error) {
                  console.error('Failed to toggle plaza pin:', error);
                  showToast('操作失败', 'error');
                }
              }}
              onDeleteDesign={async (id) => {
                try {
                  await api.deletePlazaDesign(id);
                  setDesigns(await api.getPlazaDesigns());
                  showToast('作品已删除');
                } catch (error) {
                  console.error('Failed to delete design:', error);
                  showToast('删除失败', 'error');
                }
              }}
            />
          )}

          {activeTab === 'users' && <AdminUsers users={users} />}

          {activeTab === 'orders' && <AdminOrders orders={orders} refreshOrders={refreshOrders} />}

          {activeTab === 'affiliate' && (
            <AdminAffiliate
              withdrawals={withdrawals}
              config={config}
              setConfig={setConfig}
              onSaveConfig={() => saveConfig()}
              onApprove={async (id) => {
                try {
                  await api.approveWithdrawal(id);
                  setWithdrawals(await api.getWithdrawals().catch(() => []));
                  showToast('提现申请已通过');
                } catch (error) {
                  console.error('Failed to approve withdrawal:', error);
                  showToast('审核失败', 'error');
                }
              }}
            />
          )}

          {activeTab === 'points' && <AdminPoints api={api} users={users} />}

          {activeTab === 'complaints' && (
            <AdminComplaints
              complaints={complaints}
              onUpdate={async (id, status, reply) => {
                try {
                  if (status === 'processing') {
                    await api.replyComplaint(id, 'processing', reply);
                  } else {
                    await api.resolveComplaint(id, status, reply);
                  }
                  setComplaints(await api.getComplaints().catch(() => []));
                  showToast('工单已更新');
                } catch (error) {
                  console.error('Failed to resolve complaint:', error);
                  showToast('处理失败', 'error');
                }
              }}
            />
          )}

          {activeTab === 'coupons' && (
            <AdminCoupons
              templates={couponTemplates}
              users={users}
              stats={couponStats}
              onRefreshStats={async () => {
                await refreshCouponData();
              }}
              onIssue={async (payload) => {
                try {
                  const result = await api.issueAdminCoupons(payload);
                  await refreshCouponData();
                  showToast(`发放完成：成功${result.issued}，跳过${result.skipped}`);
                } catch (error) {
                  console.error('Failed to issue coupons:', error);
                  showToast('发放失败', 'error');
                }
              }}
              onCreate={async (payload) => {
                try {
                  await api.createAdminCouponTemplate(payload);
                  await refreshCouponData();
                  showToast('优惠券模板已创建');
                } catch (error) {
                  console.error('Failed to create coupon template:', error);
                  showToast('创建失败', 'error');
                }
              }}
              onUpdate={async (id, payload) => {
                try {
                  await api.updateAdminCouponTemplate(id, payload);
                  await refreshCouponData();
                  showToast('优惠券模板已更新');
                } catch (error) {
                  console.error('Failed to update coupon template:', error);
                  showToast('更新失败', 'error');
                }
              }}
            />
          )}

          {activeTab === 'analytics' && (
            <AdminAnalytics
              overview={analyticsOverview}
              rangeDays={analyticsRange}
              onChangeRange={setAnalyticsRange}
              loading={analyticsLoading}
            />
          )}

          {activeTab === 'ops' && (
            <AdminOps
              selfCheck={opsSelfCheck}
              auditLogs={auditLogs}
              loading={opsLoading}
              onRefresh={refreshOps}
            />
          )}
        </main>
      </section>
    </div>
  );
};

export default AdminDashboard;

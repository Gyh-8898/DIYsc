
import React, { useEffect, useMemo, useState } from 'react';
import { MockAPI } from '../../services/api';
import {
  PointsCampaign,
  PointsDashboard,
  PointsGrantTask,
  PointsLedgerRow,
  PointsRiskRule,
  PointsRule,
  User
} from '../../types';

type SubTab = 'dashboard' | 'rules' | 'grant' | 'campaigns' | 'ledger' | 'risk';

interface AdminPointsProps {
  api: typeof MockAPI;
  users: User[];
}

const TABS: Array<{ key: SubTab; label: string }> = [
  { key: 'dashboard', label: '积分看板' },
  { key: 'rules', label: '规则中心' },
  { key: 'grant', label: '发放中心' },
  { key: 'campaigns', label: '营销活动' },
  { key: 'ledger', label: '流水审计' },
  { key: 'risk', label: '风控设置' }
];

const EVENT_OPTIONS = [
  { value: 'register', label: '用户注册' },
  { value: 'first_order_paid', label: '首单支付' },
  { value: 'order_paid', label: '订单支付' },
  { value: 'daily_sign_in', label: '每日签到' },
  { value: 'share_success', label: '分享成功' },
  { value: 'custom', label: '自定义事件' }
];

const WEEKDAY_OPTIONS = [
  { key: '1', label: '周一' },
  { key: '2', label: '周二' },
  { key: '3', label: '周三' },
  { key: '4', label: '周四' },
  { key: '5', label: '周五' },
  { key: '6', label: '周六' },
  { key: '0', label: '周日' }
];

const CHANNEL_OPTIONS = [
  { key: 'wechat', label: '微信小程序' },
  { key: 'app', label: 'App' },
  { key: 'h5', label: 'H5' },
  { key: 'miniapp', label: '其他小程序' }
];

const RULE_SCOPE_OPTIONS = [
  { value: 'all', label: '全部用户' },
  { value: 'new_user', label: '新用户' },
  { value: 'level', label: '指定等级' },
  { value: 'tag', label: '指定标签' },
  { value: 'user', label: '指定用户' }
];

const RULE_STACK_OPTIONS = [
  { value: 'stack', label: '可叠加' },
  { value: 'exclusive', label: '互斥不叠加' }
];

const CAMPAIGN_TYPE_OPTIONS = [
  { value: 'general', label: '通用活动' },
  { value: 'festival', label: '节日活动' },
  { value: 'growth', label: '拉新活动' },
  { value: 'retention', label: '留存活动' }
];

const CAMPAIGN_AUDIENCE_OPTIONS = [
  { value: 'all', label: '全部用户' },
  { value: 'level', label: '按等级' },
  { value: 'tag', label: '按标签' },
  { value: 'user', label: '指定用户' }
];

const DEFAULT_RULE: Partial<PointsRule> = {
  name: '',
  eventType: 'order_paid',
  rewardMode: 'fixed',
  rewardValue: 10,
  maxPerUserDay: 0,
  maxPerUserTotal: 0,
  cooldownMinutes: 0,
  stackMode: 'stack',
  scopeType: 'all',
  scopeValue: '',
  minOrderAmount: 0,
  maxOrderAmount: 0,
  minUserLevel: 0,
  maxUserLevel: 0,
  newUserWithinDays: 0,
  requireReferral: false,
  requireFirstOrder: false,
  weekdays: '',
  allowedChannels: '',
  extraConditions: '',
  validStart: 0,
  validEnd: 0,
  status: 1,
  remark: ''
};

const DEFAULT_CAMPAIGN: Partial<PointsCampaign> = {
  name: '',
  campaignType: 'general',
  ruleIds: [],
  budgetTotalPoints: 0,
  budgetDailyPoints: 0,
  userCapPoints: 0,
  audienceType: 'all',
  audienceValue: '',
  status: 1,
  startAt: 0,
  endAt: 0
};

const DEFAULT_RISK: Partial<PointsRiskRule> = {
  name: '',
  eventType: 'all',
  freqLimit: 0,
  dailyLimit: 0,
  deviceLimit: 0,
  ipLimit: 0,
  blacklistEnabled: false,
  hitAction: 'review',
  status: 1,
  remark: ''
};

const LABELS = {
  grantType: {
    add: '增加积分',
    deduct: '扣减积分',
    freeze: '冻结积分',
    unfreeze: '解冻积分'
  } as Record<string, string>,
  targetType: {
    user: '指定用户',
    level: '按等级',
    all: '全部用户'
  } as Record<string, string>,
  taskStatus: {
    completed: '完成',
    partial: '部分成功',
    failed: '失败'
  } as Record<string, string>,
  ledgerType: {
    earn: '获得积分',
    redeem: '使用积分',
    refund: '积分返还',
    bonus: '奖励积分',
    freeze: '冻结积分',
    unfreeze: '解冻积分',
    commission: '分销返佣'
  } as Record<string, string>,
  riskAction: {
    review: '人工审核',
    block: '直接拦截',
    downgrade: '降级处理'
  } as Record<string, string>
};

function toNum(v: unknown, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function fmt(ts?: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

function toLocalInput(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function csvSet(text: string) {
  return new Set(String(text || '').split(',').map((x) => x.trim()).filter(Boolean));
}

function toggleCsv(text: string, key: string) {
  const set = csvSet(text);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return Array.from(set).join(',');
}

function Pill({ on, onText, offText }: { on: boolean; onText: string; offText: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
      {on ? onText : offText}
    </span>
  );
}

function Chart({ labels, values, color }: { labels: string[]; values: number[]; color: string }) {
  const max = Math.max(1, ...values, 1);
  const points = values.map((v, idx) => `${(idx / Math.max(values.length - 1, 1)) * 100},${100 - (Number(v || 0) / max) * 100}`).join(' ');
  const idxs = labels.length <= 6 ? labels.map((_, i) => i) : [0, Math.floor((labels.length - 1) / 2), labels.length - 1];

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 100 100" className="h-52 w-full rounded border border-gray-100 bg-white">
        <line x1="0" y1="100" x2="100" y2="100" stroke="#d1d5db" strokeWidth="1" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[11px] text-gray-500">
        {idxs.map((i) => <span key={i}>{labels[i] || '-'}</span>)}
      </div>
    </div>
  );
}

function exportLedgerCsv(rows: PointsLedgerRow[]) {
  const header = ['ID', '用户ID', '用户昵称', '类型', '积分变化', '原因', '业务号', '时间'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')].concat(
    rows.map((r) => [r.id, r.userId, r.userName, LABELS.ledgerType[r.type] || r.type, r.amount, r.reason, r.bizId, fmt(r.createdAt)].map(esc).join(','))
  );
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `积分流水-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
const AdminPoints: React.FC<AdminPointsProps> = ({ api, users }) => {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<1 | 7 | 30>(7);

  const [dashboard, setDashboard] = useState<PointsDashboard | null>(null);
  const [rules, setRules] = useState<PointsRule[]>([]);
  const [campaigns, setCampaigns] = useState<PointsCampaign[]>([]);
  const [riskRules, setRiskRules] = useState<PointsRiskRule[]>([]);
  const [ledger, setLedger] = useState<PointsLedgerRow[]>([]);
  const [tasks, setTasks] = useState<PointsGrantTask[]>([]);

  const [ruleForm, setRuleForm] = useState<Partial<PointsRule>>(DEFAULT_RULE);
  const [editingRuleId, setEditingRuleId] = useState('');

  const [campaignForm, setCampaignForm] = useState<Partial<PointsCampaign>>(DEFAULT_CAMPAIGN);
  const [editingCampaignId, setEditingCampaignId] = useState('');

  const [riskForm, setRiskForm] = useState<Partial<PointsRiskRule>>(DEFAULT_RISK);
  const [editingRiskId, setEditingRiskId] = useState('');

  const [grantType, setGrantType] = useState<'add' | 'deduct' | 'freeze' | 'unfreeze'>('add');
  const [targetType, setTargetType] = useState<'user' | 'level' | 'all'>('user');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [targetLevelId, setTargetLevelId] = useState(1);
  const [grantPoints, setGrantPoints] = useState(10);
  const [grantReasonCode, setGrantReasonCode] = useState('manual_adjustment');
  const [grantRemark, setGrantRemark] = useState('');
  const [userKeyword, setUserKeyword] = useState('');

  const [ledgerUserId, setLedgerUserId] = useState('');
  const [ledgerType, setLedgerType] = useState('');
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');
  const [ledgerLimit, setLedgerLimit] = useState(200);

  const filteredUsers = useMemo(() => {
    const q = userKeyword.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => String(u.id || '').toLowerCase().includes(q) || String(u.name || '').toLowerCase().includes(q) || String(u.phone || '').toLowerCase().includes(q));
  }, [users, userKeyword]);

  const loadDashboard = async (rangeDays = days) => {
    const data = await api.getAdminPointsDashboard(rangeDays).catch(() => null);
    setDashboard(data);
  };

  const loadRules = async () => setRules(await api.getAdminPointsRules().catch(() => []));
  const loadCampaigns = async () => setCampaigns(await api.getAdminPointsCampaigns().catch(() => []));
  const loadRiskRules = async () => setRiskRules(await api.getAdminPointsRiskRules().catch(() => []));
  const loadGrantTasks = async () => setTasks(await api.getAdminPointsGrantTasks(100).catch(() => []));

  const loadLedger = async () => {
    setLedger(await api.getAdminPointsLedger({
      userId: ledgerUserId || undefined,
      type: ledgerType || undefined,
      dateFrom: ledgerDateFrom ? fromLocalInput(ledgerDateFrom) : undefined,
      dateTo: ledgerDateTo ? fromLocalInput(ledgerDateTo) : undefined,
      limit: Math.max(20, Math.min(1000, Number(ledgerLimit || 200)))
    }).catch(() => []));
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadDashboard(days), loadRules(), loadCampaigns(), loadRiskRules(), loadGrantTasks(), loadLedger()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => { void loadDashboard(days); }, [days]);

  const saveRule = async () => {
    if (!String(ruleForm.name || '').trim()) return window.alert('请填写规则名称');
    if (!String(ruleForm.eventType || '').trim()) return window.alert('请选择触发事件');

    setSaving(true);
    try {
      const payload: Partial<PointsRule> = {
        ...ruleForm,
        name: String(ruleForm.name || '').trim(),
        eventType: String(ruleForm.eventType || '').trim(),
        rewardMode: ruleForm.rewardMode === 'rate' ? 'rate' : 'fixed',
        rewardValue: toNum(ruleForm.rewardValue, 0),
        maxPerUserDay: Math.max(0, Math.floor(toNum(ruleForm.maxPerUserDay, 0))),
        maxPerUserTotal: Math.max(0, Math.floor(toNum(ruleForm.maxPerUserTotal, 0))),
        cooldownMinutes: Math.max(0, Math.floor(toNum(ruleForm.cooldownMinutes, 0))),
        stackMode: ruleForm.stackMode === 'exclusive' ? 'exclusive' : 'stack',
        scopeType: (ruleForm.scopeType || 'all') as PointsRule['scopeType'],
        scopeValue: String(ruleForm.scopeValue || ''),
        minOrderAmount: Math.max(0, toNum(ruleForm.minOrderAmount, 0)),
        maxOrderAmount: Math.max(0, toNum(ruleForm.maxOrderAmount, 0)),
        minUserLevel: Math.max(0, Math.floor(toNum(ruleForm.minUserLevel, 0))),
        maxUserLevel: Math.max(0, Math.floor(toNum(ruleForm.maxUserLevel, 0))),
        newUserWithinDays: Math.max(0, Math.floor(toNum(ruleForm.newUserWithinDays, 0))),
        requireReferral: Boolean(ruleForm.requireReferral),
        requireFirstOrder: Boolean(ruleForm.requireFirstOrder),
        weekdays: String(ruleForm.weekdays || ''),
        allowedChannels: String(ruleForm.allowedChannels || ''),
        extraConditions: String(ruleForm.extraConditions || '').trim(),
        validStart: toNum(ruleForm.validStart, 0),
        validEnd: toNum(ruleForm.validEnd, 0),
        status: Number(ruleForm.status || 1) === 1 ? 1 : 0,
        remark: String(ruleForm.remark || '').trim()
      };

      if (editingRuleId) await api.updateAdminPointsRule(editingRuleId, payload);
      else await api.createAdminPointsRule(payload);

      setEditingRuleId('');
      setRuleForm(DEFAULT_RULE);
      await Promise.all([loadRules(), loadDashboard(days)]);
    } catch (error: any) {
      window.alert(error?.message || '保存规则失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    setSaving(true);
    try {
      await api.toggleAdminPointsRule(id, enabled);
      await Promise.all([loadRules(), loadDashboard(days)]);
    } catch (error: any) {
      window.alert(error?.message || '切换规则状态失败');
    } finally {
      setSaving(false);
    }
  };

  const saveCampaign = async () => {
    if (!String(campaignForm.name || '').trim()) return window.alert('请填写活动名称');
    setSaving(true);
    try {
      const payload: Partial<PointsCampaign> = {
        ...campaignForm,
        name: String(campaignForm.name || '').trim(),
        campaignType: String(campaignForm.campaignType || 'general'),
        ruleIds: Array.isArray(campaignForm.ruleIds) ? campaignForm.ruleIds : [],
        budgetTotalPoints: Math.max(0, Math.floor(toNum(campaignForm.budgetTotalPoints, 0))),
        budgetDailyPoints: Math.max(0, Math.floor(toNum(campaignForm.budgetDailyPoints, 0))),
        userCapPoints: Math.max(0, Math.floor(toNum(campaignForm.userCapPoints, 0))),
        audienceType: (campaignForm.audienceType || 'all') as PointsCampaign['audienceType'],
        audienceValue: String(campaignForm.audienceValue || ''),
        status: Number(campaignForm.status || 1) === 1 ? 1 : 0,
        startAt: toNum(campaignForm.startAt, 0),
        endAt: toNum(campaignForm.endAt, 0)
      };

      if (editingCampaignId) await api.updateAdminPointsCampaign(editingCampaignId, payload);
      else await api.createAdminPointsCampaign(payload);

      setEditingCampaignId('');
      setCampaignForm(DEFAULT_CAMPAIGN);
      await Promise.all([loadCampaigns(), loadDashboard(days)]);
    } catch (error: any) {
      window.alert(error?.message || '保存活动失败');
    } finally {
      setSaving(false);
    }
  };
  const toggleCampaign = async (id: string, enabled: boolean) => {
    setSaving(true);
    try {
      await api.toggleAdminPointsCampaign(id, enabled);
      await Promise.all([loadCampaigns(), loadDashboard(days)]);
    } catch (error: any) {
      window.alert(error?.message || '切换活动状态失败');
    } finally {
      setSaving(false);
    }
  };

  const saveRiskRule = async () => {
    if (!String(riskForm.name || '').trim()) return window.alert('请填写风控规则名称');
    setSaving(true);
    try {
      const payload: Partial<PointsRiskRule> = {
        ...riskForm,
        name: String(riskForm.name || '').trim(),
        eventType: String(riskForm.eventType || 'all'),
        freqLimit: Math.max(0, Math.floor(toNum(riskForm.freqLimit, 0))),
        dailyLimit: Math.max(0, Math.floor(toNum(riskForm.dailyLimit, 0))),
        deviceLimit: Math.max(0, Math.floor(toNum(riskForm.deviceLimit, 0))),
        ipLimit: Math.max(0, Math.floor(toNum(riskForm.ipLimit, 0))),
        blacklistEnabled: Boolean(riskForm.blacklistEnabled),
        hitAction: (riskForm.hitAction || 'review') as PointsRiskRule['hitAction'],
        status: Number(riskForm.status || 1) === 1 ? 1 : 0,
        remark: String(riskForm.remark || '').trim()
      };

      if (editingRiskId) await api.updateAdminPointsRiskRule(editingRiskId, payload);
      else await api.createAdminPointsRiskRule(payload);

      setEditingRiskId('');
      setRiskForm(DEFAULT_RISK);
      await loadRiskRules();
    } catch (error: any) {
      window.alert(error?.message || '保存风控规则失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleRisk = async (id: string, enabled: boolean) => {
    setSaving(true);
    try {
      await api.toggleAdminPointsRiskRule(id, enabled);
      await loadRiskRules();
    } catch (error: any) {
      window.alert(error?.message || '切换风控状态失败');
    } finally {
      setSaving(false);
    }
  };

  const submitGrantTask = async () => {
    if (grantPoints <= 0) return window.alert('积分数必须大于 0');
    if (!String(grantReasonCode || '').trim()) return window.alert('请填写原因编码');
    if (targetType === 'user' && selectedUserIds.length === 0) return window.alert('请至少选择 1 个用户');

    setSaving(true);
    try {
      await api.createAdminPointsGrantTask({
        grantType,
        targetType,
        userIds: targetType === 'user' ? selectedUserIds : undefined,
        levelId: targetType === 'level' ? Math.max(1, Math.floor(targetLevelId)) : undefined,
        points: Math.max(1, Math.floor(grantPoints)),
        reasonCode: String(grantReasonCode || '').trim(),
        remark: String(grantRemark || '').trim()
      });
      setGrantRemark('');
      setSelectedUserIds([]);
      await Promise.all([loadGrantTasks(), loadLedger(), loadDashboard(days)]);
    } catch (error: any) {
      window.alert(error?.message || '发放任务创建失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleCampaignRule = (id: string) => {
    const curr = Array.isArray(campaignForm.ruleIds) ? campaignForm.ruleIds : [];
    setCampaignForm((prev) => ({ ...prev, ruleIds: curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id] }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">积分运营中心</h3>
          <div className="text-xs text-gray-500">{loading ? '数据加载中...' : '已连接后端积分服务'}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${subTab === tab.key ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'dashboard' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">积分趋势</h4>
              <div className="flex gap-2">
                {[1, 7, 30].map((d) => (
                  <button key={d} type="button" className={`rounded px-3 py-1.5 text-sm ${days === d ? 'bg-black text-white' : 'border bg-white text-gray-600'}`} onClick={() => setDays(d as 1 | 7 | 30)}>
                    {d === 1 ? '今日' : `${d}天`}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><div className="text-xs text-gray-500">今日发放</div><div className="mt-1 text-2xl font-bold">{dashboard?.kpis.issuedToday || 0}</div></div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><div className="text-xs text-gray-500">今日消耗</div><div className="mt-1 text-2xl font-bold">{dashboard?.kpis.redeemedToday || 0}</div></div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><div className="text-xs text-gray-500">7日活跃用户</div><div className="mt-1 text-2xl font-bold">{dashboard?.kpis.activeUsers7d || 0}</div></div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><div className="text-xs text-gray-500">积分总池</div><div className="mt-1 text-2xl font-bold">{dashboard?.kpis.pointsPool || 0}</div></div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><div className="text-xs text-gray-500">生效活动</div><div className="mt-1 text-2xl font-bold">{dashboard?.kpis.activeCampaigns || 0}</div></div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><div className="text-xs text-gray-500">启用规则</div><div className="mt-1 text-2xl font-bold">{dashboard?.kpis.enabledRules || 0}</div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-sm font-bold">发放趋势</div><Chart labels={dashboard?.trends.labels || []} values={dashboard?.trends.issued || []} color="#16a34a" /></div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-sm font-bold">消耗趋势</div><Chart labels={dashboard?.trends.labels || []} values={dashboard?.trends.redeemed || []} color="#dc2626" /></div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-sm font-bold">活跃用户趋势</div><Chart labels={dashboard?.trends.labels || []} values={dashboard?.trends.activeUsers || []} color="#2563eb" /></div>
          </div>
        </div>
      ) : null}

      {subTab === 'rules' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 text-base font-bold">{editingRuleId ? '编辑积分规则' : '新建积分规则'}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input className="rounded border p-2 text-sm" placeholder="规则名称" value={ruleForm.name || ''} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} />
              <select className="rounded border p-2 text-sm" value={ruleForm.eventType || 'order_paid'} onChange={(e) => setRuleForm((p) => ({ ...p, eventType: e.target.value }))}>
                {EVENT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select className="rounded border p-2 text-sm" value={ruleForm.rewardMode || 'fixed'} onChange={(e) => setRuleForm((p) => ({ ...p, rewardMode: e.target.value as any }))}>
                <option value="fixed">固定积分</option>
                <option value="rate">按比例</option>
              </select>
              <input className="rounded border p-2 text-sm" type="number" placeholder="奖励值" value={toNum(ruleForm.rewardValue, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, rewardValue: toNum(e.target.value, 0) }))} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <select className="rounded border p-2 text-sm" value={ruleForm.scopeType || 'all'} onChange={(e) => setRuleForm((p) => ({ ...p, scopeType: e.target.value as any }))}>
                {RULE_SCOPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <input className="rounded border p-2 text-sm" placeholder="范围值(等级/标签/用户ID)" value={ruleForm.scopeValue || ''} onChange={(e) => setRuleForm((p) => ({ ...p, scopeValue: e.target.value }))} />
              <select className="rounded border p-2 text-sm" value={ruleForm.stackMode || 'stack'} onChange={(e) => setRuleForm((p) => ({ ...p, stackMode: e.target.value as any }))}>
                {RULE_STACK_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select className="rounded border p-2 text-sm" value={ruleForm.status === 0 ? 0 : 1} onChange={(e) => setRuleForm((p) => ({ ...p, status: Number(e.target.value) as 0 | 1 }))}>
                <option value={1}>启用</option>
                <option value={0}>停用</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <input className="rounded border p-2 text-sm" type="number" placeholder="最小订单金额" value={toNum(ruleForm.minOrderAmount, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, minOrderAmount: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="最大订单金额(0不限)" value={toNum(ruleForm.maxOrderAmount, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, maxOrderAmount: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="最小用户等级" value={toNum(ruleForm.minUserLevel, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, minUserLevel: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="最大用户等级(0不限)" value={toNum(ruleForm.maxUserLevel, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, maxUserLevel: toNum(e.target.value, 0) }))} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <input className="rounded border p-2 text-sm" type="number" placeholder="单用户日上限(0不限)" value={toNum(ruleForm.maxPerUserDay, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, maxPerUserDay: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="单用户总上限(0不限)" value={toNum(ruleForm.maxPerUserTotal, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, maxPerUserTotal: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="新用户窗口(天)" value={toNum(ruleForm.newUserWithinDays, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, newUserWithinDays: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="冷却时间(分钟)" value={toNum(ruleForm.cooldownMinutes, 0)} onChange={(e) => setRuleForm((p) => ({ ...p, cooldownMinutes: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="datetime-local" value={toLocalInput(ruleForm.validStart)} onChange={(e) => setRuleForm((p) => ({ ...p, validStart: fromLocalInput(e.target.value) }))} />
              <input className="rounded border p-2 text-sm" type="datetime-local" value={toLocalInput(ruleForm.validEnd)} onChange={(e) => setRuleForm((p) => ({ ...p, validEnd: fromLocalInput(e.target.value) }))} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border bg-gray-50 p-3">
                <div className="mb-2 text-xs text-gray-500">生效周几</div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((opt) => {
                    const checked = csvSet(String(ruleForm.weekdays || '')).has(opt.key);
                    return (
                      <button key={opt.key} type="button" className={`rounded-full px-3 py-1 text-xs ${checked ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700'}`} onClick={() => setRuleForm((p) => ({ ...p, weekdays: toggleCsv(String(p.weekdays || ''), opt.key) }))}>{opt.label}</button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="mb-2 text-xs text-gray-500">允许渠道</div>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map((opt) => {
                    const checked = csvSet(String(ruleForm.allowedChannels || '')).has(opt.key);
                    return (
                      <button key={opt.key} type="button" className={`rounded-full px-3 py-1 text-xs ${checked ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700'}`} onClick={() => setRuleForm((p) => ({ ...p, allowedChannels: toggleCsv(String(p.allowedChannels || ''), opt.key) }))}>{opt.label}</button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="inline-flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(ruleForm.requireReferral)} onChange={(e) => setRuleForm((p) => ({ ...p, requireReferral: e.target.checked }))} /> 必须邀请关系</label>
              <label className="inline-flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(ruleForm.requireFirstOrder)} onChange={(e) => setRuleForm((p) => ({ ...p, requireFirstOrder: e.target.checked }))} /> 仅首单生效</label>
              <input className="rounded border p-2 text-sm" placeholder="备注" value={ruleForm.remark || ''} onChange={(e) => setRuleForm((p) => ({ ...p, remark: e.target.value }))} />
            </div>
            <div className="mt-3">
              <textarea className="h-20 w-full rounded border p-2 text-sm" placeholder="扩展条件 extraConditions(JSON)" value={ruleForm.extraConditions || ''} onChange={(e) => setRuleForm((p) => ({ ...p, extraConditions: e.target.value }))} />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" disabled={saving} onClick={saveRule} className="rounded-lg bg-[#07c160] px-5 py-2 text-sm font-bold text-white">{saving ? '保存中...' : editingRuleId ? '更新规则' : '新增规则'}</button>
              {editingRuleId ? <button type="button" className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold" onClick={() => { setEditingRuleId(''); setRuleForm(DEFAULT_RULE); }}>取消编辑</button> : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs text-gray-500"><tr><th className="px-4 py-3">规则</th><th className="px-4 py-3">事件</th><th className="px-4 py-3">奖励</th><th className="px-4 py-3">条件摘要</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">操作</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3"><div className="font-bold">{r.name}</div><div className="text-xs text-gray-500">{r.remark || '-'}</div></td>
                    <td className="px-4 py-3">{EVENT_OPTIONS.find((x) => x.value === r.eventType)?.label || r.eventType}</td>
                    <td className="px-4 py-3">{r.rewardMode === 'rate' ? `${r.rewardValue}%` : `${r.rewardValue} 积分`}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">金额 {r.minOrderAmount}-{r.maxOrderAmount || '不限'} / 等级 {r.minUserLevel}-{r.maxUserLevel || '不限'} / 范围 {r.scopeType}{r.scopeValue ? `:${r.scopeValue}` : ''} / 渠道 {r.allowedChannels || '不限'}</td>
                    <td className="px-4 py-3"><Pill on={r.status === 1} onText="启用" offText="停用" /></td>
                    <td className="px-4 py-3"><div className="flex gap-3 text-xs"><button type="button" className="text-blue-600 hover:underline" onClick={() => { setEditingRuleId(r.id); setRuleForm({ ...r }); }}>编辑</button><button type="button" className="text-gray-700 hover:underline" onClick={() => toggleRule(r.id, r.status !== 1)}>{r.status === 1 ? '停用' : '启用'}</button></div></td>
                  </tr>
                ))}
                {rules.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={6}>暂无规则</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {subTab === 'grant' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 text-base font-bold">创建发放任务</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <select className="rounded border p-2 text-sm" value={grantType} onChange={(e) => setGrantType(e.target.value as any)}>{Object.entries(LABELS.grantType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <select className="rounded border p-2 text-sm" value={targetType} onChange={(e) => setTargetType(e.target.value as any)}>{Object.entries(LABELS.targetType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input className="rounded border p-2 text-sm" type="number" value={grantPoints} onChange={(e) => setGrantPoints(Math.max(0, Math.floor(toNum(e.target.value, 0))))} placeholder="积分数" />
              <input className="rounded border p-2 text-sm" value={grantReasonCode} onChange={(e) => setGrantReasonCode(e.target.value)} placeholder="原因编码" />
            </div>
            {targetType === 'level' ? <div className="mt-3"><input className="w-48 rounded border p-2 text-sm" type="number" value={targetLevelId} onChange={(e) => setTargetLevelId(Math.max(1, Math.floor(toNum(e.target.value, 1))))} placeholder="等级ID" /></div> : null}
            {targetType === 'user' ? (
              <div className="mt-3 rounded border p-3">
                <div className="mb-2 flex items-center justify-between"><input className="w-72 rounded border p-2 text-sm" value={userKeyword} onChange={(e) => setUserKeyword(e.target.value)} placeholder="搜索用户" /><div className="text-xs text-gray-500">已选 {selectedUserIds.length} 人</div></div>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {filteredUsers.map((u) => <label key={u.id} className="flex items-center justify-between rounded border p-2 text-sm hover:bg-gray-50"><span>{u.name} {u.phone ? `(${u.phone})` : ''}</span><input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => setSelectedUserIds((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])} className="accent-black" /></label>)}
                </div>
              </div>
            ) : null}
            <div className="mt-3"><textarea className="h-20 w-full rounded border p-2 text-sm" value={grantRemark} onChange={(e) => setGrantRemark(e.target.value)} placeholder="备注" /></div>
            <div className="mt-4"><button type="button" disabled={saving} onClick={submitGrantTask} className="rounded-lg bg-black px-5 py-2 text-sm font-bold text-white">{saving ? '处理中...' : '执行发放'}</button></div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500"><tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">类型</th><th className="px-4 py-3">目标</th><th className="px-4 py-3">积分</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">结果</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((t) => <tr key={t.id}><td className="px-4 py-3 text-xs text-gray-500">{fmt(t.createdAt)}</td><td className="px-4 py-3">{LABELS.grantType[t.grantType] || t.grantType}</td><td className="px-4 py-3">{LABELS.targetType[t.targetType] || t.targetType} ({t.targetCount}人)</td><td className="px-4 py-3">{t.points}</td><td className="px-4 py-3">{LABELS.taskStatus[t.status] || t.status}</td><td className="px-4 py-3 text-xs text-gray-500">{t.resultSummary}</td></tr>)}
                {tasks.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={6}>暂无发放任务</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {subTab === 'campaigns' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 text-base font-bold">{editingCampaignId ? '编辑营销活动' : '新建营销活动'}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input className="rounded border p-2 text-sm" placeholder="活动名称" value={campaignForm.name || ''} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} />
              <select className="rounded border p-2 text-sm" value={campaignForm.campaignType || 'general'} onChange={(e) => setCampaignForm((p) => ({ ...p, campaignType: e.target.value }))}>
                {CAMPAIGN_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select className="rounded border p-2 text-sm" value={campaignForm.audienceType || 'all'} onChange={(e) => setCampaignForm((p) => ({ ...p, audienceType: e.target.value as any }))}>
                {CAMPAIGN_AUDIENCE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <input className="rounded border p-2 text-sm" placeholder="受众值" value={campaignForm.audienceValue || ''} onChange={(e) => setCampaignForm((p) => ({ ...p, audienceValue: e.target.value }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="总预算" value={toNum(campaignForm.budgetTotalPoints, 0)} onChange={(e) => setCampaignForm((p) => ({ ...p, budgetTotalPoints: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="日预算" value={toNum(campaignForm.budgetDailyPoints, 0)} onChange={(e) => setCampaignForm((p) => ({ ...p, budgetDailyPoints: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="单用户上限" value={toNum(campaignForm.userCapPoints, 0)} onChange={(e) => setCampaignForm((p) => ({ ...p, userCapPoints: toNum(e.target.value, 0) }))} />
              <select className="rounded border p-2 text-sm" value={campaignForm.status === 0 ? 0 : 1} onChange={(e) => setCampaignForm((p) => ({ ...p, status: Number(e.target.value) as 0 | 1 }))}><option value={1}>启用</option><option value={0}>停用</option></select>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input className="rounded border p-2 text-sm" type="datetime-local" value={toLocalInput(campaignForm.startAt)} onChange={(e) => setCampaignForm((p) => ({ ...p, startAt: fromLocalInput(e.target.value) }))} />
              <input className="rounded border p-2 text-sm" type="datetime-local" value={toLocalInput(campaignForm.endAt)} onChange={(e) => setCampaignForm((p) => ({ ...p, endAt: fromLocalInput(e.target.value) }))} />
            </div>
            <div className="mt-3 rounded border bg-gray-50 p-3">
              <div className="mb-2 text-xs text-gray-500">关联规则</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {rules.map((r) => <label key={r.id} className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm"><span>{r.name}</span><input type="checkbox" checked={(campaignForm.ruleIds || []).includes(r.id)} onChange={() => toggleCampaignRule(r.id)} className="accent-black" /></label>)}
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" disabled={saving} onClick={saveCampaign} className="rounded-lg bg-[#07c160] px-5 py-2 text-sm font-bold text-white">{saving ? '保存中...' : editingCampaignId ? '更新活动' : '新增活动'}</button>
              {editingCampaignId ? <button type="button" className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold" onClick={() => { setEditingCampaignId(''); setCampaignForm(DEFAULT_CAMPAIGN); }}>取消编辑</button> : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500"><tr><th className="px-4 py-3">活动</th><th className="px-4 py-3">预算</th><th className="px-4 py-3">受众</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">时间窗</th><th className="px-4 py-3">操作</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => <tr key={c.id}><td className="px-4 py-3"><div className="font-bold">{c.name}</div><div className="text-xs text-gray-500">{CAMPAIGN_TYPE_OPTIONS.find((x) => x.value === c.campaignType)?.label || c.campaignType} / 规则 {c.ruleIds?.length || 0} 条</div></td><td className="px-4 py-3 text-xs"><div>总 {c.budgetTotalPoints}</div><div>日 {c.budgetDailyPoints}</div><div>单用户 {c.userCapPoints}</div></td><td className="px-4 py-3">{CAMPAIGN_AUDIENCE_OPTIONS.find((x) => x.value === c.audienceType)?.label || c.audienceType}</td><td className="px-4 py-3"><Pill on={c.status === 1} onText="启用" offText="停用" /></td><td className="px-4 py-3 text-xs text-gray-500"><div>{fmt(c.startAt)}</div><div>{fmt(c.endAt)}</div></td><td className="px-4 py-3"><div className="flex gap-3 text-xs"><button type="button" className="text-blue-600 hover:underline" onClick={() => { setEditingCampaignId(c.id); setCampaignForm({ ...c }); }}>编辑</button><button type="button" className="text-gray-700 hover:underline" onClick={() => toggleCampaign(c.id, c.status !== 1)}>{c.status === 1 ? '停用' : '启用'}</button></div></td></tr>)}
                {campaigns.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={6}>暂无活动</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {subTab === 'ledger' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <input className="rounded border p-2 text-sm" placeholder="用户ID" value={ledgerUserId} onChange={(e) => setLedgerUserId(e.target.value)} />
              <select className="rounded border p-2 text-sm" value={ledgerType} onChange={(e) => setLedgerType(e.target.value)}><option value="">全部类型</option>{Object.keys(LABELS.ledgerType).map((k) => <option key={k} value={k}>{LABELS.ledgerType[k]}</option>)}</select>
              <input className="rounded border p-2 text-sm" type="datetime-local" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)} />
              <input className="rounded border p-2 text-sm" type="datetime-local" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)} />
              <input className="rounded border p-2 text-sm" type="number" value={ledgerLimit} onChange={(e) => setLedgerLimit(Math.max(20, Math.min(1000, Math.floor(toNum(e.target.value, 200)))))} />
              <div className="flex gap-2"><button type="button" className="flex-1 rounded bg-black px-3 py-2 text-sm font-bold text-white" onClick={() => void loadLedger()}>查询</button><button type="button" className="rounded border border-gray-200 px-3 py-2 text-sm font-semibold" onClick={() => exportLedgerCsv(ledger)}>导出</button></div>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500"><tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">用户</th><th className="px-4 py-3">类型</th><th className="px-4 py-3">变化</th><th className="px-4 py-3">原因</th><th className="px-4 py-3">业务号</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {ledger.map((r) => <tr key={r.id}><td className="px-4 py-3 text-xs text-gray-500">{fmt(r.createdAt)}</td><td className="px-4 py-3">{r.userName || r.userId}</td><td className="px-4 py-3">{LABELS.ledgerType[r.type] || r.type}</td><td className={`px-4 py-3 font-semibold ${r.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.amount >= 0 ? `+${r.amount}` : r.amount}</td><td className="px-4 py-3 text-xs text-gray-600">{r.reason || '-'}</td><td className="px-4 py-3 text-xs text-gray-500">{r.bizId || '-'}</td></tr>)}
                {ledger.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={6}>暂无流水数据</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {subTab === 'risk' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 text-base font-bold">{editingRiskId ? '编辑风控规则' : '新建风控规则'}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input className="rounded border p-2 text-sm" placeholder="规则名称" value={riskForm.name || ''} onChange={(e) => setRiskForm((p) => ({ ...p, name: e.target.value }))} />
              <input className="rounded border p-2 text-sm" placeholder="事件类型" value={riskForm.eventType || 'all'} onChange={(e) => setRiskForm((p) => ({ ...p, eventType: e.target.value }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="分钟频次限制" value={toNum(riskForm.freqLimit, 0)} onChange={(e) => setRiskForm((p) => ({ ...p, freqLimit: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="日限制" value={toNum(riskForm.dailyLimit, 0)} onChange={(e) => setRiskForm((p) => ({ ...p, dailyLimit: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="设备限制" value={toNum(riskForm.deviceLimit, 0)} onChange={(e) => setRiskForm((p) => ({ ...p, deviceLimit: toNum(e.target.value, 0) }))} />
              <input className="rounded border p-2 text-sm" type="number" placeholder="IP限制" value={toNum(riskForm.ipLimit, 0)} onChange={(e) => setRiskForm((p) => ({ ...p, ipLimit: toNum(e.target.value, 0) }))} />
              <select className="rounded border p-2 text-sm" value={riskForm.hitAction || 'review'} onChange={(e) => setRiskForm((p) => ({ ...p, hitAction: e.target.value as any }))}><option value="review">人工审核</option><option value="block">直接拦截</option><option value="downgrade">降级处理</option></select>
              <select className="rounded border p-2 text-sm" value={riskForm.status === 0 ? 0 : 1} onChange={(e) => setRiskForm((p) => ({ ...p, status: Number(e.target.value) as 0 | 1 }))}><option value={1}>启用</option><option value={0}>停用</option></select>
            </div>
            <div className="mt-3"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(riskForm.blacklistEnabled)} onChange={(e) => setRiskForm((p) => ({ ...p, blacklistEnabled: e.target.checked }))} /> 命中后加入黑名单</label></div>
            <div className="mt-3"><textarea className="h-20 w-full rounded border p-2 text-sm" placeholder="备注" value={riskForm.remark || ''} onChange={(e) => setRiskForm((p) => ({ ...p, remark: e.target.value }))} /></div>
            <div className="mt-4 flex gap-3"><button type="button" disabled={saving} onClick={saveRiskRule} className="rounded-lg bg-[#07c160] px-5 py-2 text-sm font-bold text-white">{saving ? '保存中...' : editingRiskId ? '更新规则' : '新增规则'}</button>{editingRiskId ? <button type="button" className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold" onClick={() => { setEditingRiskId(''); setRiskForm(DEFAULT_RISK); }}>取消编辑</button> : null}</div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500"><tr><th className="px-4 py-3">规则</th><th className="px-4 py-3">事件</th><th className="px-4 py-3">限制</th><th className="px-4 py-3">命中动作</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">操作</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {riskRules.map((r) => <tr key={r.id}><td className="px-4 py-3"><div className="font-bold">{r.name}</div><div className="text-xs text-gray-500">{r.remark || '-'}</div></td><td className="px-4 py-3">{r.eventType}</td><td className="px-4 py-3 text-xs"><div>频次 {r.freqLimit}</div><div>日限 {r.dailyLimit}</div><div>设备/IP {r.deviceLimit}/{r.ipLimit}</div></td><td className="px-4 py-3">{LABELS.riskAction[r.hitAction] || r.hitAction}</td><td className="px-4 py-3"><Pill on={r.status === 1} onText="启用" offText="停用" /></td><td className="px-4 py-3"><div className="flex gap-3 text-xs"><button type="button" className="text-blue-600 hover:underline" onClick={() => { setEditingRiskId(r.id); setRiskForm({ ...r }); }}>编辑</button><button type="button" className="text-gray-700 hover:underline" onClick={() => toggleRisk(r.id, r.status !== 1)}>{r.status === 1 ? '停用' : '启用'}</button></div></td></tr>)}
                {riskRules.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={6}>暂无风控规则</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminPoints;


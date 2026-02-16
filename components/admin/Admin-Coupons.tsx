import React, { useMemo, useState } from 'react';
import { CouponIssueStats, CouponTemplate, User } from '../../types';

interface AdminCouponsProps {
  templates: CouponTemplate[];
  users: User[];
  stats: CouponIssueStats | null;
  onCreate: (payload: Partial<CouponTemplate>) => Promise<void>;
  onUpdate: (id: string, payload: Partial<CouponTemplate>) => Promise<void>;
  onIssue: (payload: { templateId: string; mode: 'specific' | 'all' | 'level'; userIds?: string[]; levelId?: number }) => Promise<void>;
  onRefreshStats: () => Promise<void>;
}

const EMPTY_FORM: Partial<CouponTemplate> = {
  name: '',
  description: '',
  discountType: 'fixed',
  discountValue: 10,
  minAmount: 99,
  totalCount: 1000,
  perUserLimit: 1,
  status: 1
};

function formatDate(ts?: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

const AdminCoupons: React.FC<AdminCouponsProps> = ({
  templates,
  users,
  stats,
  onCreate,
  onUpdate,
  onIssue,
  onRefreshStats
}) => {
  const [form, setForm] = useState<Partial<CouponTemplate>>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState('');

  const [issueTemplateId, setIssueTemplateId] = useState('');
  const [issueMode, setIssueMode] = useState<'specific' | 'all' | 'level'>('specific');
  const [issueLevelId, setIssueLevelId] = useState<number>(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userKeyword, setUserKeyword] = useState('');
  const [issuing, setIssuing] = useState(false);

  const sorted = useMemo(
    () => [...templates].sort((a, b) => Number(b.createdAt || b.startAt || 0) - Number(a.createdAt || a.startAt || 0)),
    [templates]
  );

  const filteredUsers = useMemo(() => {
    const q = userKeyword.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        String(u.id || '').toLowerCase().includes(q) ||
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.phone || '').toLowerCase().includes(q)
      );
    });
  }, [users, userKeyword]);

  const handleSubmit = async () => {
    if (!form.name?.trim()) return;
    setSubmitting(true);
    try {
      const startAt = form.startAt || Date.now();
      const endAt = form.endAt || Date.now() + 30 * 24 * 3600 * 1000;
      const payload = {
        ...form,
        name: form.name?.trim(),
        startAt,
        endAt
      };

      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }

      setEditingId('');
      setForm(EMPTY_FORM);
      await onRefreshStats();
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: CouponTemplate) => {
    setEditingId(item.id);
    setForm({ ...item });
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleIssue = async () => {
    if (!issueTemplateId) return;

    setIssuing(true);
    try {
      await onIssue({
        templateId: issueTemplateId,
        mode: issueMode,
        userIds: issueMode === 'specific' ? selectedUserIds : undefined,
        levelId: issueMode === 'level' ? issueLevelId : undefined
      });
      await onRefreshStats();
    } finally {
      setIssuing(false);
    }
  };

  const summary = stats?.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">模板总数</div><div className="mt-1 text-2xl font-bold">{summary?.totalTemplates || 0}</div></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">总发放</div><div className="mt-1 text-2xl font-bold">{summary?.totalIssued || 0}</div></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">已使用</div><div className="mt-1 text-2xl font-bold">{summary?.totalUsed || 0}</div></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">可用中</div><div className="mt-1 text-2xl font-bold">{summary?.totalAvailable || 0}</div></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">核销率</div><div className="mt-1 text-2xl font-bold">{((summary?.usageRate || 0) * 100).toFixed(2)}%</div></div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 border-b pb-2 text-lg font-bold">优惠券模板管理</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <input type="text" className="rounded border p-2" placeholder="券名称" value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          <input type="text" className="rounded border p-2" placeholder="说明" value={form.description || ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          <select className="rounded border p-2" value={form.discountType || 'fixed'} onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value as any }))}>
            <option value="fixed">固定减免</option>
            <option value="percent">折扣百分比</option>
          </select>
          <input type="number" className="rounded border p-2" placeholder="优惠值" value={form.discountValue ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, discountValue: Number(e.target.value) }))} />
          <input type="number" className="rounded border p-2" placeholder="最低消费" value={form.minAmount ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, minAmount: Number(e.target.value) }))} />
          <input type="number" className="rounded border p-2" placeholder="发放总量" value={form.totalCount ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, totalCount: Number(e.target.value) }))} />
          <input type="number" className="rounded border p-2" placeholder="每人限领" value={form.perUserLimit ?? 1} onChange={(e) => setForm((prev) => ({ ...prev, perUserLimit: Number(e.target.value) }))} />
          <input type="datetime-local" className="rounded border p-2" value={form.startAt ? new Date(form.startAt).toISOString().slice(0, 16) : ''} onChange={(e) => setForm((prev) => ({ ...prev, startAt: new Date(e.target.value).getTime() }))} />
          <input type="datetime-local" className="rounded border p-2" value={form.endAt ? new Date(form.endAt).toISOString().slice(0, 16) : ''} onChange={(e) => setForm((prev) => ({ ...prev, endAt: new Date(e.target.value).getTime() }))} />
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" disabled={submitting} onClick={handleSubmit} className="rounded-lg bg-[#07c160] px-5 py-2 text-sm font-bold text-white">{submitting ? '保存中...' : editingId ? '更新模板' : '新增模板'}</button>
          {editingId ? <button type="button" className="rounded-lg border px-5 py-2 text-sm font-bold" onClick={() => { setEditingId(''); setForm(EMPTY_FORM); }}>取消编辑</button> : null}
          <button type="button" className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50" onClick={() => { setEditingId(''); setForm(EMPTY_FORM); }}>
            清空表单
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 border-b pb-2 text-lg font-bold">定向发放优惠券</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">优惠券模板</label>
            <select value={issueTemplateId} onChange={(e) => setIssueTemplateId(e.target.value)} className="w-full rounded border p-2 text-sm">
              <option value="">请选择模板</option>
              {sorted.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">发放方式</label>
            <select value={issueMode} onChange={(e) => setIssueMode(e.target.value as any)} className="w-full rounded border p-2 text-sm">
              <option value="specific">指定用户</option>
              <option value="level">指定等级</option>
              <option value="all">全部用户</option>
            </select>
          </div>

          {issueMode === 'level' ? (
            <div>
              <label className="mb-1 block text-xs text-gray-500">会员等级 ID</label>
              <input type="number" value={issueLevelId} onChange={(e) => setIssueLevelId(Number(e.target.value || 1))} className="w-full rounded border p-2 text-sm" />
            </div>
          ) : (
            <div className="rounded border border-dashed p-3 text-xs text-gray-500">{issueMode === 'all' ? '将发放给全部用户，受每人限领和模板库存限制。' : '在下方列表中勾选目标用户。'}</div>
          )}
        </div>

        {issueMode === 'specific' ? (
          <div className="mt-4 rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <input value={userKeyword} onChange={(e) => setUserKeyword(e.target.value)} placeholder="搜索用户" className="w-64 rounded border p-2 text-sm" />
              <div className="text-xs text-gray-500">已选 {selectedUserIds.length} 人</div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredUsers.map((user) => (
                <label key={user.id} className="flex items-center justify-between rounded border p-2 text-sm hover:bg-gray-50">
                  <span>{user.name} {user.phone ? `(${user.phone})` : ''}</span>
                  <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleUser(user.id)} className="accent-black" />
                </label>
              ))}
              {filteredUsers.length === 0 ? <div className="text-center text-xs text-gray-400">无匹配用户</div> : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex gap-3">
          <button type="button" disabled={issuing} onClick={handleIssue} className="rounded-lg bg-black px-5 py-2 text-sm font-bold text-white hover:opacity-90">
            {issuing ? '发放中...' : '执行发放'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            onClick={() => {
              setIssueTemplateId('');
              setIssueMode('specific');
              setIssueLevelId(1);
              setSelectedUserIds([]);
              setUserKeyword('');
            }}
          >
            重置发放条件
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-4 py-3 text-sm font-bold">模板使用统计</div>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-white text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">模板</th>
              <th className="px-4 py-2">发放</th>
              <th className="px-4 py-2">使用</th>
              <th className="px-4 py-2">可用</th>
              <th className="px-4 py-2">过期</th>
              <th className="px-4 py-2">核销率</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(stats?.templateStats || []).map((item) => (
              <tr key={item.templateId}>
                <td className="px-4 py-2 font-bold">{item.templateName}</td>
                <td className="px-4 py-2">{item.issuedCount}</td>
                <td className="px-4 py-2">{item.usedCount}</td>
                <td className="px-4 py-2">{item.availableCount}</td>
                <td className="px-4 py-2">{item.expiredCount}</td>
                <td className="px-4 py-2">{(item.usageRate * 100).toFixed(2)}%</td>
                <td className="px-4 py-2">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => {
                    const hit = sorted.find((tpl) => tpl.id === item.templateId);
                    if (hit) startEdit(hit);
                  }}>编辑模板</button>
                </td>
              </tr>
            ))}
            {(stats?.templateStats || []).length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={7}>暂无统计数据</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3">名称</th>
              <th className="px-4 py-3">优惠</th>
              <th className="px-4 py-3">门槛</th>
              <th className="px-4 py-3">库存</th>
              <th className="px-4 py-3">有效期</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3"><div className="font-bold">{item.name}</div><div className="text-xs text-gray-500">{item.description || '-'}</div></td>
                <td className="px-4 py-3">{item.discountType === 'percent' ? `${item.discountValue}%` : `¥${item.discountValue}`}</td>
                <td className="px-4 py-3">¥{item.minAmount}</td>
                <td className="px-4 py-3">{item.issuedCount}/{item.totalCount}</td>
                <td className="px-4 py-3 text-xs"><div>{formatDate(item.startAt)}</div><div>{formatDate(item.endAt)}</div></td>
                <td className="px-4 py-3">{item.status === 1 ? '启用' : '停用'}</td>
                <td className="px-4 py-3"><button type="button" className="text-blue-600 hover:underline" onClick={() => startEdit(item)}>编辑</button></td>
              </tr>
            ))}
            {sorted.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={7}>暂无优惠券模板</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCoupons;

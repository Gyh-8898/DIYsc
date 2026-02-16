import React, { useEffect, useMemo, useState } from 'react';
import { AdminAuditLog, AdminOpsSelfCheck } from '../../types';

interface AdminOpsProps {
  selfCheck: AdminOpsSelfCheck | null;
  auditLogs: AdminAuditLog[];
  loading?: boolean;
  onRefresh: () => void;
}

const CHECKLIST_STORAGE_KEY = 'gem_ops_release_checklist_v1';

const RELEASE_CHECKLIST_ITEMS = [
  '后端健康检查通过（数据库 / 支付 / 物流配置）',
  '小程序下单链路通过（创建订单 -> 支付 -> 待发货）',
  '后台发货链路通过（发货 -> 前端可见物流轨迹）',
  '优惠券链路通过（发券 -> 领券 -> 下单核销）',
  '投诉链路通过（提交 -> 后台回复 -> 前端可见）',
  '提现链路通过（申请 -> 审核 -> 记录可追溯）',
  '广场运营链路通过（置顶/取消置顶/排序）'
];

function statusClass(status: 'ok' | 'warn' | 'error') {
  if (status === 'ok') return 'bg-green-50 text-green-700 border-green-100';
  if (status === 'warn') return 'bg-yellow-50 text-yellow-700 border-yellow-100';
  return 'bg-red-50 text-red-700 border-red-100';
}

function statusLabel(status: 'ok' | 'warn' | 'error') {
  if (status === 'ok') return '正常';
  if (status === 'warn') return '警告';
  return '异常';
}

const AdminOps: React.FC<AdminOpsProps> = ({ selfCheck, auditLogs, loading, onRefresh }) => {
  const [checkedItems, setCheckedItems] = useState<boolean[]>(RELEASE_CHECKLIST_ITEMS.map(() => false));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as boolean[];
      if (Array.isArray(parsed) && parsed.length === RELEASE_CHECKLIST_ITEMS.length) {
        setCheckedItems(parsed.map((item) => Boolean(item)));
      }
    } catch (_error) {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checkedItems));
  }, [checkedItems]);

  const completed = useMemo(() => checkedItems.filter(Boolean).length, [checkedItems]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">系统自检与发布保障</h3>
            <p className="mt-1 text-xs text-gray-500">
              最近检查时间：{selfCheck?.generatedAt ? new Date(selfCheck.generatedAt).toLocaleString() : '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded bg-black px-3 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            刷新检查
          </button>
        </div>
        {loading ? <div className="mt-2 text-xs text-gray-500">自检刷新中...</div> : null}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">总检查项</div>
          <div className="mt-1 text-2xl font-bold">{selfCheck?.summary?.total || 0}</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">正常</div>
          <div className="mt-1 text-2xl font-bold text-green-700">{selfCheck?.summary?.ok || 0}</div>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">警告</div>
          <div className="mt-1 text-2xl font-bold text-yellow-700">{selfCheck?.summary?.warn || 0}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">异常</div>
          <div className="mt-1 text-2xl font-bold text-red-700">{selfCheck?.summary?.error || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-bold">实时运营快照</div>
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            <div className="rounded border p-3"><div className="text-xs text-gray-500">总会员</div><div className="mt-1 text-lg font-bold">{selfCheck?.snapshot?.totalUsers || 0}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-gray-500">总订单</div><div className="mt-1 text-lg font-bold">{selfCheck?.snapshot?.totalOrders || 0}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-gray-500">今日新增会员</div><div className="mt-1 text-lg font-bold">{selfCheck?.snapshot?.todayNewUsers || 0}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-gray-500">今日订单</div><div className="mt-1 text-lg font-bold">{selfCheck?.snapshot?.todayOrders || 0}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-gray-500">待付款订单</div><div className="mt-1 text-lg font-bold">{selfCheck?.snapshot?.pendingPaymentOrders || 0}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-gray-500">待审核提现</div><div className="mt-1 text-lg font-bold">{selfCheck?.snapshot?.pendingWithdrawals || 0}</div></div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-bold">灰度发布检查清单</div>
          <div className="space-y-2 p-4">
            <div className="mb-2 text-xs text-gray-500">
              完成进度：{completed}/{RELEASE_CHECKLIST_ITEMS.length}
            </div>
            {RELEASE_CHECKLIST_ITEMS.map((item, idx) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 rounded border border-gray-100 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(checkedItems[idx])}
                  onChange={(e) => {
                    const next = [...checkedItems];
                    next[idx] = e.target.checked;
                    setCheckedItems(next);
                  }}
                  className="h-4 w-4 accent-black"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-4 py-3 text-sm font-bold">系统自检详情</div>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-white text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">检查项</th>
              <th className="px-4 py-2">状态</th>
              <th className="px-4 py-2">结果说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(selfCheck?.items || []).map((item) => (
              <tr key={item.key}>
                <td className="px-4 py-3 font-medium">{item.label}</td>
                <td className="px-4 py-3">
                  <span className={`rounded border px-2 py-0.5 text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <div>{item.message}</div>
                  {item.detail ? <div className="mt-1 text-gray-400">{item.detail}</div> : null}
                </td>
              </tr>
            ))}
            {(selfCheck?.items || []).length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-400" colSpan={3}>
                  暂无自检数据
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-4 py-3 text-sm font-bold">关键操作审计日志</div>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-white text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">时间</th>
              <th className="px-4 py-2">操作人</th>
              <th className="px-4 py-2">动作</th>
              <th className="px-4 py-2">目标</th>
              <th className="px-4 py-2">结果</th>
              <th className="px-4 py-2">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {auditLogs.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 text-xs text-gray-500">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{row.actorName || row.actorUserId || '-'}</td>
                <td className="px-4 py-2 font-mono text-xs">{row.action}</td>
                <td className="px-4 py-2 text-xs">{row.targetType || '-'} / {row.targetId || '-'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded border px-2 py-0.5 text-xs ${row.status === 'success' ? 'border-green-100 bg-green-50 text-green-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                    {row.status === 'success' ? '成功' : row.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{row.message || '-'}</td>
              </tr>
            ))}
            {auditLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-400" colSpan={6}>
                  暂无审计日志
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOps;

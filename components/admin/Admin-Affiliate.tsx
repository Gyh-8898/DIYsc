import React from 'react';
import { WithdrawalRequest, SystemConfig } from '../../types';
import { Check, UserPlus, Wallet } from 'lucide-react';

interface AdminAffiliateProps {
  withdrawals: WithdrawalRequest[];
  onApprove: (id: string) => void;
  config: SystemConfig;
  setConfig: (c: SystemConfig) => void;
  onSaveConfig: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝'
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700'
};

function formatTime(ts?: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

const AdminAffiliate: React.FC<AdminAffiliateProps> = ({
  withdrawals,
  onApprove,
  config,
  setConfig,
  onSaveConfig
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 border-b pb-2 text-lg font-bold">分销规则设置</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">佣金比例（%）</label>
            <input
              type="number"
              value={config.affiliate.commissionRatePercent}
              onChange={(e) =>
                setConfig({
                  ...config,
                  affiliate: { ...config.affiliate, commissionRatePercent: Number(e.target.value || 0) }
                })
              }
              className="w-full rounded border p-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">积分兑换比例（100积分=X元）</label>
            <input
              type="number"
              value={config.affiliate.pointsToMoneyRate * 100}
              onChange={(e) =>
                setConfig({
                  ...config,
                  affiliate: { ...config.affiliate, pointsToMoneyRate: Number(e.target.value || 0) / 100 }
                })
              }
              className="w-full rounded border p-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">最低提现积分</label>
            <input
              type="number"
              value={config.affiliate.minWithdrawPoints}
              onChange={(e) =>
                setConfig({
                  ...config,
                  affiliate: { ...config.affiliate, minWithdrawPoints: Number(e.target.value || 0) }
                })
              }
              className="w-full rounded border p-2 text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onSaveConfig}
          className="mt-4 rounded-lg bg-[#07c160] px-4 py-2 text-sm font-bold text-white"
        >
          保存规则
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b bg-gray-50 p-4">
          <Wallet size={18} />
          <h3 className="font-bold">提现申请</h3>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b bg-white text-xs text-gray-500">
            <tr>
              <th className="px-6 py-3">用户</th>
              <th className="px-6 py-3">积分</th>
              <th className="px-6 py-3">金额</th>
              <th className="px-6 py-3">申请时间</th>
              <th className="px-6 py-3">状态</th>
              <th className="px-6 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-300">
                  暂无提现申请
                </td>
              </tr>
            ) : null}

            {withdrawals.map((w) => (
              <tr key={w.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{w.userName}</div>
                  <div className="text-xs text-gray-400">{w.userId}</div>
                </td>
                <td className="px-6 py-4">{w.pointsAmount}</td>
                <td className="px-6 py-4 font-bold">¥{Number(w.moneyAmount || 0).toFixed(2)}</td>
                <td className="px-6 py-4 text-xs text-gray-500">{formatTime(w.createdAt)}</td>
                <td className="px-6 py-4">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[w.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[w.status] || w.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {w.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => onApprove(w.id)}
                      className="inline-flex items-center gap-1 rounded bg-[#07c160] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#06ad56]"
                    >
                      <Check size={14} />
                      通过
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">无需处理</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-500">
        当前页面支持“通过”操作。若需要“驳回并填写原因”，可在下一轮补充后端接口与前端交互。
      </div>
    </div>
  );
};

export default AdminAffiliate;

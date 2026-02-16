import React, { useMemo, useState } from 'react';
import { Complaint } from '../../types';
import { CheckCircle2, MessageSquare, Search, XCircle } from 'lucide-react';

interface AdminComplaintsProps {
  complaints: Complaint[];
  onUpdate: (id: string, status: 'processing' | 'resolved' | 'rejected', reply: string) => Promise<void>;
}

const statusMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  rejected: '已驳回'
};

const statusClassMap: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-600',
  processing: 'bg-blue-50 text-blue-600',
  resolved: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-600'
};

function formatTime(ts?: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

const AdminComplaints: React.FC<AdminComplaintsProps> = ({ complaints, onUpdate }) => {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'processing' | 'resolved' | 'rejected'>('all');
  const [active, setActive] = useState<Complaint | null>(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (complaints || []).filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (!q) return true;
      return (
        String(item.id || '').toLowerCase().includes(q) ||
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.userName || '').toLowerCase().includes(q)
      );
    });
  }, [complaints, keyword, status]);

  const submitUpdate = async (nextStatus: 'processing' | 'resolved' | 'rejected') => {
    if (!active) return;
    setSubmitting(true);
    try {
      await onUpdate(active.id, nextStatus, reply.trim());
      setReply('');
    } finally {
      setSubmitting(false);
    }
  };

  const activeMessages = Array.isArray(active?.replyMessages) ? active?.replyMessages : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-gray-800">
            <MessageSquare size={18} />
            <h3 className="font-bold">投诉与申诉工单</h3>
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索工单ID/标题/用户"
              className="w-full rounded border p-2 pl-9 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded border p-2 text-sm"
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
            <option value="rejected">已驳回</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setKeyword('');
              setStatus('all');
            }}
            className="rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            重置筛选
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">标题</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">提交时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${item.type === 'appeal' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                    {item.type === 'appeal' ? '申诉' : '投诉'}
                  </span>
                </td>
                <td className="px-4 py-3">{item.userName || '-'}</td>
                <td className="px-4 py-3">
                  <div className="font-bold">{item.title}</div>
                  <div className="line-clamp-1 text-xs text-gray-500">{item.description}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusClassMap[item.status] || 'bg-gray-50 text-gray-500'}`}>
                    {statusMap[item.status] || item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatTime(item.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActive(item);
                      setReply('');
                    }}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  暂无工单
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="border-b p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold">工单详情</h4>
                  <p className="mt-1 text-xs text-gray-500">{active.id}</p>
                </div>
                <button type="button" onClick={() => setActive(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusClassMap[active.status] || 'bg-gray-50 text-gray-500'}`}>
                    {statusMap[active.status] || active.status}
                  </span>
                  <span className="text-xs text-gray-500">{active.type === 'appeal' ? '申诉' : '投诉'}</span>
                </div>
                <div className="font-bold">{active.title}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{active.description}</div>
                <div className="mt-2 text-xs text-gray-500">用户：{active.userName || '-'} | 联系方式：{active.contact || '-'}</div>
                <div className="mt-1 text-xs text-gray-500">提交时间：{formatTime(active.createdAt)}</div>
              </div>

              {Array.isArray(active.images) && active.images.length > 0 ? (
                <div className="rounded-lg border p-3">
                  <div className="mb-2 text-sm font-bold">用户上传图片</div>
                  <div className="grid grid-cols-3 gap-2">
                    {active.images.map((url, idx) => (
                      <img key={`${url}_${idx}`} src={url} className="h-20 w-full rounded object-cover" />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-bold">回复记录</div>
                {activeMessages.length === 0 ? (
                  <div className="text-xs text-gray-400">暂无回复记录</div>
                ) : (
                  <div className="space-y-2">
                    {activeMessages.map((msg) => (
                      <div key={msg.id} className="rounded bg-gray-50 p-2">
                        <div className="text-xs text-gray-500">平台回复 · {formatTime(msg.createdAt)}</div>
                        <div className="mt-1 text-sm text-gray-800">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-bold">新增回复</div>
                <textarea
                  rows={4}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="输入回复内容（可选）"
                  className="w-full rounded border p-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t p-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitUpdate('processing')}
                className="rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                标记处理中
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitUpdate('rejected')}
                className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                驳回
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitUpdate('resolved')}
                className="inline-flex items-center gap-1 rounded bg-[#07c160] px-4 py-2 text-sm text-white hover:bg-[#06ad56]"
              >
                <CheckCircle2 size={14} /> 已解决
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminComplaints;

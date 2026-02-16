import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { MockAPI } from '../../../services/api';
import { AiPromptTemplateView } from '../../../types';

interface PromptsPanelProps {
  api: typeof MockAPI;
}

type PromptForm = {
  id: string;
  taskType: string;
  name: string;
  version: string;
  status: string;
  trafficPercent: number;
  isDefault: boolean;
  content: string;
};

const DEFAULT_FORM: PromptForm = {
  id: '',
  taskType: 'community_bazi',
  name: 'default',
  version: '1',
  status: 'active',
  trafficPercent: 0,
  isDefault: true,
  content: ''
};

function fmtTime(ts?: number) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '-';
  }
}

function toNum(v: unknown, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export default function PromptsPanel({ api }: PromptsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AiPromptTemplateView[]>([]);
  const [taskType, setTaskType] = useState('');

  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<PromptForm>(DEFAULT_FORM);

  const load = async (nextTaskType = taskType) => {
    setLoading(true);
    try {
      const data = await api.getAdminAiPrompts(nextTaskType || undefined).catch(() => []);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(''); }, []);

  const taskTypes = useMemo(() => {
    const set = new Set(rows.map((r) => String(r.taskType || '').trim()).filter(Boolean));
    // ensure community tasks visible even before data exists
    set.add('community_bazi');
    set.add('community_liuyao');
    return Array.from(set).sort();
  }, [rows]);

  const startCreate = () => {
    setIsNew(true);
    setEditing(true);
    setForm({ ...DEFAULT_FORM, taskType: taskType || 'community_bazi' });
  };

  const startEdit = (row: AiPromptTemplateView) => {
    setIsNew(false);
    setEditing(true);
    setForm({
      id: row.id,
      taskType: row.taskType || 'community_bazi',
      name: row.name || 'default',
      version: row.version || '1',
      status: row.status || 'active',
      trafficPercent: Math.max(0, Math.min(100, toNum(row.trafficPercent, 0))),
      isDefault: Boolean(row.isDefault),
      content: row.content || ''
    });
  };

  const save = async () => {
    const payload: Record<string, unknown> = {
      taskType: String(form.taskType || '').trim(),
      name: String(form.name || '').trim() || 'default',
      version: String(form.version || '').trim() || '1',
      status: String(form.status || 'active').trim() || 'active',
      trafficPercent: Math.max(0, Math.min(100, Math.floor(toNum(form.trafficPercent, 0)))),
      isDefault: Boolean(form.isDefault),
      content: String(form.content || '').trim()
    };

    if (!payload.taskType) return window.alert('请填写 taskType');
    if (!payload.content) return window.alert('提示词内容不能为空');

    setLoading(true);
    try {
      if (isNew) {
        await api.createAdminAiPrompt(payload);
      } else {
        if (!form.id) return window.alert('缺少提示词ID');
        await api.updateAdminAiPrompt(form.id, payload);
      }
      window.alert('已保存');
      setEditing(false);
      setForm(DEFAULT_FORM);
      await load(taskType);
    } catch (error: any) {
      window.alert(error?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold">提示词中心</div>
            <div className="mt-1 text-xs text-gray-500">支持版本管理、灰度流量与默认提示词切换（每个 taskType 可设置默认）。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => load(taskType)}
              disabled={loading}
            >
              <RefreshCcw size={16} />
              刷新
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded bg-black px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={startCreate}
              disabled={loading}
            >
              <Plus size={16} />
              新增提示词
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={taskType} onChange={(e) => { setTaskType(e.target.value); void load(e.target.value); }} className="rounded border px-3 py-2 text-sm">
            <option value="">全部 taskType</option>
            {taskTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="text-xs text-gray-400">共 {rows.length} 条</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2">taskType</th>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">版本</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">灰度(%)</th>
                <th className="px-3 py-2">默认</th>
                <th className="px-3 py-2">更新时间</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="px-3 py-5 text-center text-gray-400" colSpan={8}>暂无提示词</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{r.taskType}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.version}</td>
                    <td className="px-3 py-2">{r.status || '-'}</td>
                    <td className="px-3 py-2">{Math.max(0, Math.min(100, toNum(r.trafficPercent, 0)))}%</td>
                    <td className="px-3 py-2">{r.isDefault ? <span className="rounded bg-black px-2 py-0.5 text-xs font-semibold text-white">默认</span> : '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{fmtTime(r.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50" onClick={() => startEdit(r)} disabled={loading}>
                        编辑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base font-bold">{isNew ? '新增提示词' : '编辑提示词'}</div>
            <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => { setEditing(false); setForm(DEFAULT_FORM); }}>
              关闭
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">taskType</label>
              <input value={form.taskType} onChange={(e) => setForm((prev) => ({ ...prev, taskType: e.target.value }))} className="w-full rounded border p-2 font-mono text-xs" placeholder="community_bazi" />
              <div className="mt-1 text-[11px] text-gray-400">建议：`community_bazi` / `community_liuyao`。</div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">名称</label>
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="default" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">版本号</label>
              <input value={form.version} onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))} className="w-full rounded border p-2 font-mono text-xs" placeholder="1" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">状态</label>
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded border p-2 text-sm">
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">灰度流量（%）</label>
              <input value={form.trafficPercent} onChange={(e) => setForm((prev) => ({ ...prev, trafficPercent: toNum(e.target.value, 0) }))} className="w-full rounded border p-2 text-sm" type="number" min={0} max={100} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">默认</label>
              <div className="flex items-center gap-2 rounded border p-2 text-sm">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))} />
                <span className="text-gray-700">设为该 taskType 的默认提示词</span>
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">提示词内容</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                className="h-72 w-full rounded border p-2 font-mono text-xs"
                placeholder="写入系统提示词 / 指令模板..."
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              保存
            </button>
            <div className="text-xs text-gray-500">保存后立即生效；默认提示词会覆盖同 taskType 的其它默认。</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


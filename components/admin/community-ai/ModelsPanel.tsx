import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { MockAPI } from '../../../services/api';
import { AiModelRegistryView } from '../../../types';
import { safeJsonPretty } from './shared';

interface ModelsPanelProps {
  api: typeof MockAPI;
}

type ModelStatus = 'active' | 'deprecated' | 'offline';

type ModelForm = {
  id: string;
  provider: string;
  modelId: string;
  version: string;
  displayName: string;
  releaseDate: string;
  status: ModelStatus;
  isDefault: boolean;
  metaJson: string;
};

const DEFAULT_FORM: ModelForm = {
  id: '',
  provider: '',
  modelId: '',
  version: '',
  displayName: '',
  releaseDate: '',
  status: 'active',
  isDefault: false,
  metaJson: ''
};

function fmtYmd(ts?: number | null) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '-';
  }
}

function fmtTime(ts?: number) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '-';
  }
}

export default function ModelsPanel({ api }: ModelsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<AiModelRegistryView[]>([]);

  const [providerFilter, setProviderFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<ModelForm>(DEFAULT_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.getAdminAiModels().catch(() => []);
      setModels(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const providers = useMemo(() => {
    const set = new Set(models.map((m) => String(m.provider || '').trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return models
      .filter((m) => (providerFilter ? String(m.provider) === providerFilter : true))
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.provider} ${m.modelId} ${m.displayName} ${m.version}`.toLowerCase();
        return hay.includes(q);
      });
  }, [models, providerFilter, keyword]);

  const startCreate = () => {
    setIsNew(true);
    setEditing(true);
    setForm(DEFAULT_FORM);
  };

  const startEdit = (row: AiModelRegistryView) => {
    setIsNew(false);
    setEditing(true);
    setForm({
      id: row.id,
      provider: row.provider,
      modelId: row.modelId,
      version: row.version,
      displayName: row.displayName || row.modelId,
      releaseDate: row.releaseDate ? fmtYmd(row.releaseDate) : '',
      status: (row.status as any) === 'deprecated' ? 'deprecated' : (row.status as any) === 'offline' ? 'offline' : 'active',
      isDefault: Boolean(row.isDefault),
      metaJson: safeJsonPretty(row.metaJson || '')
    });
  };

  const save = async () => {
    const payload: Record<string, unknown> = {
      displayName: String(form.displayName || '').trim(),
      status: form.status,
      isDefault: Boolean(form.isDefault),
      releaseDate: form.releaseDate ? String(form.releaseDate) : '',
      metaJson: String(form.metaJson || '').trim()
    };

    if (isNew) {
      const provider = String(form.provider || '').trim();
      const modelId = String(form.modelId || '').trim();
      const version = String(form.version || '').trim();
      if (!provider || !modelId || !version) return window.alert('请填写 provider / modelId / version');
      payload.provider = provider;
      payload.modelId = modelId;
      payload.version = version;
    } else {
      if (!form.id) return window.alert('缺少模型ID');
    }

    setLoading(true);
    try {
      if (isNew) {
        await api.createAdminAiModel(payload);
      } else {
        await api.updateAdminAiModel(form.id, payload);
      }
      window.alert('已保存');
      setEditing(false);
      setForm(DEFAULT_FORM);
      await load();
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
            <div className="text-base font-bold">模型中心</div>
            <div className="mt-1 text-xs text-gray-500">注册可用模型，并维护详细版本号（手动路由会按版本号精确调用）。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => load()}
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
              新增模型
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="rounded border px-3 py-2 text-sm">
            <option value="">全部供应商</option>
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-72 rounded border px-3 py-2 text-sm"
            placeholder="搜索：模型名 / modelId / version"
          />
          <div className="text-xs text-gray-400">共 {filtered.length} 条</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2">供应商</th>
                <th className="px-3 py-2">展示名</th>
                <th className="px-3 py-2">modelId</th>
                <th className="px-3 py-2">版本号</th>
                <th className="px-3 py-2">发布日期</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">默认</th>
                <th className="px-3 py-2">更新时间</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-center text-gray-400" colSpan={9}>暂无模型</td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-semibold">{m.provider}</td>
                    <td className="px-3 py-2">{m.displayName || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.modelId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.version}</td>
                    <td className="px-3 py-2">{fmtYmd(m.releaseDate)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${m.status === 'active' ? 'bg-green-100 text-green-700' : m.status === 'deprecated' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-700'}`}>
                        {m.status === 'active' ? '可用' : m.status === 'deprecated' ? '已过期' : '下线'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{m.isDefault ? <span className="rounded bg-black px-2 py-0.5 text-xs font-semibold text-white">默认</span> : '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{fmtTime(m.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50" onClick={() => startEdit(m)} disabled={loading}>
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
            <div className="text-base font-bold">{isNew ? '新增模型' : '编辑模型'}</div>
            <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => { setEditing(false); setForm(DEFAULT_FORM); }}>
              关闭
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">供应商</label>
              <input
                value={form.provider}
                onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
                disabled={!isNew}
                className="w-full rounded border p-2 text-sm"
                placeholder="openai / gemini / zhipu / custom"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">展示名</label>
              <input value={form.displayName} onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="gpt-5.2（高质量）" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">modelId（调用参数）</label>
              <input
                value={form.modelId}
                onChange={(e) => setForm((prev) => ({ ...prev, modelId: e.target.value }))}
                disabled={!isNew}
                className="w-full rounded border p-2 font-mono text-xs"
                placeholder="gpt-5.2"
              />
              {!isNew ? <div className="mt-1 text-[11px] text-gray-400">提示：modelId/version 创建后不可修改（避免路由错配）。</div> : null}
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">版本号（精确）</label>
              <input
                value={form.version}
                onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                disabled={!isNew}
                className="w-full rounded border p-2 font-mono text-xs"
                placeholder="gpt-5.2-2025-02-12"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">发布日期</label>
              <input value={form.releaseDate} onChange={(e) => setForm((prev) => ({ ...prev, releaseDate: e.target.value }))} className="w-full rounded border p-2 text-sm" type="date" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">状态</label>
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ModelStatus }))} className="w-full rounded border p-2 text-sm">
                <option value="active">可用（active）</option>
                <option value="deprecated">已过期（deprecated）</option>
                <option value="offline">下线（offline）</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Meta JSON（可选）</label>
              <textarea
                value={form.metaJson}
                onChange={(e) => setForm((prev) => ({ ...prev, metaJson: e.target.value }))}
                className="h-40 w-full rounded border p-2 font-mono text-xs"
                placeholder={'{\n  "contextTokens": 128000,\n  "price": { "input": 0.0, "output": 0.0 },\n  "tags": ["quality", "fast"]\n}'}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">默认模型</label>
              <div className="flex items-center gap-2 rounded border p-2 text-sm">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))} />
                <span className="text-gray-700">设为默认（全局唯一）</span>
                <span className="ml-auto text-xs text-gray-400">注意：设为默认会取消其它模型的默认状态</span>
              </div>
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
            <div className="text-xs text-gray-500">上线版本必须为「可用」状态；手动路由只允许选择可用模型。</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


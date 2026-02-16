import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Wifi } from 'lucide-react';
import { MockAPI } from '../../../services/api';
import { AiProviderConfigView } from '../../../types';
import { safeJsonPretty } from './shared';

interface ProvidersPanelProps {
  api: typeof MockAPI;
}

type ProviderForm = {
  provider: string;
  displayName: string;
  baseUrl: string;
  authType: 'bearer' | 'x-api-key' | 'query';
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  metaJson: string;
};

function fmtTime(ts?: number) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '-';
  }
}

const DEFAULT_FORM: ProviderForm = {
  provider: '',
  displayName: '',
  baseUrl: '',
  authType: 'bearer',
  enabled: true,
  apiKey: '',
  apiSecret: '',
  metaJson: ''
};

export default function ProvidersPanel({ api }: ProvidersPanelProps) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<AiProviderConfigView[]>([]);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<ProviderForm>(DEFAULT_FORM);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const rows = await api.getAdminAiProviders().catch(() => []);
      setProviders(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProviders(); }, []);

  const providerIds = useMemo(() => providers.map((p) => p.provider), [providers]);

  const startCreate = () => {
    setIsNew(true);
    setEditing(true);
    setForm(DEFAULT_FORM);
  };

  const startEdit = (row: AiProviderConfigView) => {
    setIsNew(false);
    setEditing(true);
    setForm({
      provider: row.provider,
      displayName: row.displayName || row.provider,
      baseUrl: row.baseUrl || '',
      authType: (row.authType as any) === 'x-api-key' ? 'x-api-key' : (row.authType as any) === 'query' ? 'query' : 'bearer',
      enabled: Boolean(row.enabled),
      apiKey: '',
      apiSecret: '',
      metaJson: safeJsonPretty(row.metaJson || '')
    });
  };

  const save = async () => {
    const provider = String(form.provider || '').trim();
    if (!provider) return window.alert('请填写供应商ID（例如 openai / gemini / zhipu / custom）');
    if (isNew && providerIds.includes(provider)) return window.alert('该供应商ID已存在');
    if (form.baseUrl && !/^https?:\/\//i.test(form.baseUrl)) return window.alert('Base URL 必须以 http(s):// 开头');

    setLoading(true);
    try {
      await api.saveAdminAiProvider(provider, {
        displayName: String(form.displayName || provider).trim(),
        baseUrl: String(form.baseUrl || '').trim(),
        authType: form.authType,
        enabled: Boolean(form.enabled),
        apiKey: String(form.apiKey || ''),
        apiSecret: String(form.apiSecret || ''),
        metaJson: String(form.metaJson || '').trim()
      });
      window.alert('已保存');
      setEditing(false);
      setForm(DEFAULT_FORM);
      await loadProviders();
    } catch (error: any) {
      window.alert(error?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const testProvider = async (provider: string) => {
    setLoading(true);
    try {
      const result = await api.testAdminAiProvider(provider);
      const sample = Array.isArray(result?.sample) ? result.sample : [];
      const lines = [
        `连通测试：${result?.ok ? '成功' : '失败'}`,
        `HTTP: ${result?.status ?? '-'}`,
        `耗时: ${result?.latencyMs ?? '-'}ms`,
        '',
        '模型样例:',
        ...sample.map((m: any) => `- ${m?.id || m?.name || m?.displayName || '-'}`)
      ];
      window.alert(lines.join('\n'));
    } catch (error: any) {
      window.alert(error?.message || '连通测试失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold">供应商配置</div>
            <div className="mt-1 text-xs text-gray-500">用于配置 OpenAI / Gemini / 智谱 / 通用第三方 API 的请求地址与密钥。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => loadProviders()}
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
              新增供应商
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2">供应商ID</th>
                <th className="px-3 py-2">展示名</th>
                <th className="px-3 py-2">Base URL</th>
                <th className="px-3 py-2">鉴权</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">密钥</th>
                <th className="px-3 py-2">更新时间</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-center text-gray-400" colSpan={8}>
                    暂无供应商配置
                  </td>
                </tr>
              ) : (
                providers.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-semibold">{p.provider}</td>
                    <td className="px-3 py-2">{p.displayName || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="max-w-[320px] truncate text-gray-700" title={p.baseUrl || ''}>{p.baseUrl || '-'}</div>
                    </td>
                    <td className="px-3 py-2">{p.authType || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                        {p.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{p.hasApiKey ? (p.apiKeyMasked || '已配置') : '未配置'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{fmtTime(p.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50" onClick={() => startEdit(p)} disabled={loading}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => testProvider(p.provider)}
                          disabled={loading || !p.enabled}
                          title={p.enabled ? '连通测试' : '供应商已停用'}
                        >
                          <Wifi size={14} />
                          测试
                        </button>
                      </div>
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
            <div className="text-base font-bold">{isNew ? '新增供应商' : '编辑供应商'}</div>
            <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => { setEditing(false); setForm(DEFAULT_FORM); }}>
              关闭
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">供应商ID（唯一）</label>
              <input
                value={form.provider}
                onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
                disabled={!isNew}
                className="w-full rounded border p-2 text-sm"
                placeholder="openai / gemini / zhipu / custom"
              />
              <div className="mt-1 text-[11px] text-gray-400">提示：供应商ID用于后端识别与路由（建议全小写）。</div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">展示名</label>
              <input value={form.displayName} onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="OpenAI" />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Base URL</label>
              <input value={form.baseUrl} onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="https://api.openai.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">鉴权方式</label>
              <select
                value={form.authType}
                onChange={(e) => setForm((prev) => ({ ...prev, authType: e.target.value as any }))}
                className="w-full rounded border p-2 text-sm"
              >
                <option value="bearer">Bearer Token</option>
                <option value="x-api-key">X-API-Key</option>
                <option value="query">Query 参数（key=...）</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">启用</label>
              <div className="flex items-center gap-2 rounded border p-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
                <span className="text-gray-700">启用该供应商</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">API Key</label>
              <input
                value={form.apiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                className="w-full rounded border p-2 text-sm"
                type="password"
                placeholder={isNew ? '必填（或稍后填写）' : '留空表示不变'}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">API Secret（可选）</label>
              <input
                value={form.apiSecret}
                onChange={(e) => setForm((prev) => ({ ...prev, apiSecret: e.target.value }))}
                className="w-full rounded border p-2 text-sm"
                type="password"
                placeholder="部分供应商需要"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Meta JSON（可选）</label>
              <textarea
                value={form.metaJson}
                onChange={(e) => setForm((prev) => ({ ...prev, metaJson: e.target.value }))}
                className="h-40 w-full rounded border p-2 font-mono text-xs"
                placeholder={'{\n  "notes": "可填写上下文长度、价格等元信息"\n}'}
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
            {!isNew ? (
              <button
                type="button"
                onClick={() => testProvider(String(form.provider || '').trim())}
                disabled={loading || !form.enabled || !String(form.provider || '').trim()}
                className="rounded border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                连通测试
              </button>
            ) : null}
            <div className="text-xs text-gray-500">保存后立即生效；手动路由会校验模型注册中心的可用状态。</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


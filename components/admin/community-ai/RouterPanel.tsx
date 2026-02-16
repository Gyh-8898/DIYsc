import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Save } from 'lucide-react';
import { MockAPI } from '../../../services/api';
import { AiModelRegistryView, AiRouterRuleView } from '../../../types';
import { safeJsonPretty } from './shared';

interface RouterPanelProps {
  api: typeof MockAPI;
}

type Mode = 'manual' | 'auto';

function uniqSorted(items: string[]) {
  return Array.from(new Set(items.map((x) => String(x || '').trim()).filter(Boolean))).sort();
}

function statusLabel(status: string) {
  if (status === 'active') return '可用';
  if (status === 'deprecated') return '已过期';
  return '下线';
}

function fmtYmd(ts?: number | null) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

export default function RouterPanel({ api }: RouterPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [models, setModels] = useState<AiModelRegistryView[]>([]);
  const [router, setRouter] = useState<AiRouterRuleView | null>(null);

  const [mode, setMode] = useState<Mode>('manual');
  const [manualProvider, setManualProvider] = useState('');
  const [manualModelKey, setManualModelKey] = useState(''); // provider|modelId|version
  const [autoConfig, setAutoConfig] = useState('');
  const [keyword, setKeyword] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        api.getAdminAiRouterRules().catch(() => null),
        api.getAdminAiModels().catch(() => [])
      ]);
      setRouter(r);
      setModels(m);

      const nextMode: Mode = r?.mode === 'auto' ? 'auto' : 'manual';
      setMode(nextMode);
      setAutoConfig(safeJsonPretty(r?.autoConfig || ''));

      const p = String(r?.manualProvider || '').trim();
      const mid = String(r?.manualModelId || '').trim();
      const v = String(r?.manualVersion || '').trim();

      if (p) setManualProvider(p);
      if (p && mid && v) setManualModelKey(`${p}|${mid}|${v}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const providers = useMemo(() => uniqSorted(models.map((m) => m.provider)), [models]);

  const modelsForProvider = useMemo(() => {
    const list = models
      .filter((m) => (manualProvider ? String(m.provider) === manualProvider : true))
      .sort((a, b) => String(b.updatedAt || 0).localeCompare(String(a.updatedAt || 0)));
    const q = keyword.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => `${m.provider} ${m.displayName} ${m.modelId} ${m.version}`.toLowerCase().includes(q));
  }, [models, manualProvider, keyword]);

  const selectedModel = useMemo(() => {
    if (!manualModelKey) return null;
    const [p, mid, v] = manualModelKey.split('|');
    return models.find((m) => m.provider === p && m.modelId === mid && m.version === v) || null;
  }, [models, manualModelKey]);

  const ensureValidSelection = () => {
    if (!manualProvider) return;
    const active = models.filter((m) => m.provider === manualProvider && m.status === 'active');
    if (active.length <= 0) return;
    const currentOk = active.some((m) => `${m.provider}|${m.modelId}|${m.version}` === manualModelKey);
    if (currentOk) return;
    const first = active[0];
    setManualModelKey(`${first.provider}|${first.modelId}|${first.version}`);
  };

  useEffect(() => {
    // When provider changes, pick a valid active model by default.
    ensureValidSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualProvider, models.length]);

  const save = async () => {
    setSaving(true);
    try {
      if (mode === 'manual') {
        if (!manualModelKey) return window.alert('请选择一个模型版本');
        const [p, mid, v] = manualModelKey.split('|');
        await api.updateAdminAiRouterRules({
          mode: 'manual',
          provider: p,
          modelId: mid,
          version: v,
          autoConfig: String(autoConfig || '').trim()
        });
      } else {
        await api.updateAdminAiRouterRules({
          mode: 'auto',
          autoConfig: String(autoConfig || '').trim()
        });
      }
      window.alert('已保存');
      await load();
    } catch (error: any) {
      window.alert(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const manualSummary = useMemo(() => {
    if (mode !== 'manual') return '';
    if (!manualModelKey) return '未选择模型';
    const [p, mid, v] = manualModelKey.split('|');
    return `${p} / ${mid} / ${v}`;
  }, [mode, manualModelKey]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold">路由策略</div>
            <div className="mt-1 text-xs text-gray-500">
              手动模式用于运营精确指定到「供应商 + modelId + 版本号」；自动模式用于按策略在多模型之间切换。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => load()}
              disabled={loading || saving}
            >
              <RefreshCcw size={16} />
              刷新
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded bg-black px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              onClick={save}
              disabled={loading || saving}
            >
              <Save size={16} />
              保存
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'manual' ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            手动模式
          </button>
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'auto' ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            自动模式
          </button>
          <div className="ml-auto text-xs text-gray-500">当前后端：{router ? `mode=${router.mode}` : '未加载'}</div>
        </div>
      </div>

      {mode === 'manual' ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-bold">手动选择具体版本</div>
          <div className="mt-1 text-xs text-gray-500">注意：仅「可用」状态的模型可以被选择并生效。</div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">供应商</label>
              <select
                value={manualProvider}
                onChange={(e) => {
                  setManualProvider(e.target.value);
                  setKeyword('');
                }}
                className="w-full rounded border p-2 text-sm"
              >
                <option value="">请选择供应商</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">模型版本（可搜索版本号）</label>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full rounded border p-2 text-sm"
                  placeholder="搜索：displayName / modelId / version"
                />
                <select
                  value={manualModelKey}
                  onChange={(e) => setManualModelKey(e.target.value)}
                  className="w-full rounded border p-2 text-sm"
                  disabled={!manualProvider}
                >
                  <option value="">{manualProvider ? '请选择模型版本' : '请先选择供应商'}</option>
                  {modelsForProvider.map((m) => {
                    const key = `${m.provider}|${m.modelId}|${m.version}`;
                    const label = `${m.displayName || m.modelId} (${m.modelId})  |  ${m.version}  |  ${statusLabel(m.status)}${m.releaseDate ? `  |  ${fmtYmd(m.releaseDate)}` : ''}`;
                    return (
                      <option key={key} value={key} disabled={m.status !== 'active'}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="mt-1 text-[11px] text-gray-400">下线/过期模型将被禁选；如果需要切换版本，请先在「模型中心」将其状态设为可用。</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">本次将调用</div>
            <div className="mt-1 font-mono text-sm font-semibold text-gray-900">{manualSummary}</div>
            {selectedModel ? (
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-3">
                <div>状态：<span className="font-semibold">{statusLabel(selectedModel.status)}</span></div>
                <div>发布日期：<span className="font-semibold">{selectedModel.releaseDate ? fmtYmd(selectedModel.releaseDate) : '-'}</span></div>
                <div>默认：<span className="font-semibold">{selectedModel.isDefault ? '是' : '否'}</span></div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-rose-600">提示：当前选择的 provider/modelId/version 未在注册中心找到（请到模型中心检查）。</div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-bold">自动模式配置</div>
          <div className="mt-1 text-xs text-gray-500">后端会在「可用」模型中按策略选型（当前为轻量实现，主要用于后续扩展）。</div>
          <div className="mt-4">
            <label className="mb-1 block text-xs text-gray-500">autoConfig（JSON，可选）</label>
            <textarea
              value={autoConfig}
              onChange={(e) => setAutoConfig(e.target.value)}
              className="h-56 w-full rounded border p-2 font-mono text-xs"
              placeholder={'{\n  "strategy": "balanced",\n  "maxLatencyMs": 8000,\n  "maxCostPerRequest": 0.30\n}'}
            />
          </div>
        </div>
      )}
    </div>
  );
}


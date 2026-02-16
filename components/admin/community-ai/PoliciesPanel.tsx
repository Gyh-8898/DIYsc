import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { MockAPI } from '../../../services/api';
import { AiPolicyRuleView } from '../../../types';
import { safeJsonPretty } from './shared';

interface PoliciesPanelProps {
  api: typeof MockAPI;
}

type PolicyForm = {
  key: string;
  type: string;
  enabled: boolean;
  content: string;
};

const DEFAULT_FORM: PolicyForm = {
  key: 'community_disclaimer',
  type: 'text',
  enabled: true,
  content: '仅供文化交流与娱乐参考，不构成任何承诺或保证。'
};

function fmtTime(ts?: number) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '-';
  }
}

function compact(text: string, max = 120) {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function guessTypeByKey(key: string) {
  if (/(_words|_list|_json)$/i.test(key)) return 'json';
  if (key.includes('banned') || key.includes('high_risk') || key.includes('rate_limit')) return 'json';
  return 'text';
}

function validateJsonIfNeeded(type: string, content: string) {
  if (type !== 'json') return { ok: true, pretty: content };
  const raw = String(content || '').trim();
  if (!raw) return { ok: true, pretty: '' };
  try {
    const val = JSON.parse(raw);
    return { ok: true, pretty: JSON.stringify(val, null, 2) };
  } catch {
    return { ok: false, pretty: raw };
  }
}

const RECOMMENDED_KEYS: Array<{ key: string; label: string; hint: string; type: 'text' | 'json' }> = [
  { key: 'community_disclaimer', label: '免责声明', hint: '固定附加到结果中，确保合规表达', type: 'text' },
  { key: 'community_refuse_template', label: '拒答模板', hint: '高风险问题触发时返回的中性提示', type: 'text' },
  { key: 'community_banned_words', label: '禁用词（输出）', hint: 'JSON 数组，命中会拦截输出并拒答', type: 'json' },
  { key: 'community_high_risk_words', label: '高风险词（输入）', hint: 'JSON 数组，命中会直接拒答', type: 'json' },
  { key: 'community_rate_limit', label: '限频规则', hint: 'JSON 对象：windowSeconds/maxRequests/scope(session|user)', type: 'json' }
];

export default function PoliciesPanel({ api }: PoliciesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AiPolicyRuleView[]>([]);

  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<PolicyForm>(DEFAULT_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminAiPolicies().catch(() => []);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const startCreate = () => {
    setIsNew(true);
    setEditing(true);
    setForm(DEFAULT_FORM);
  };

  const startEdit = (row: AiPolicyRuleView) => {
    const guessed = guessTypeByKey(row.key);
    setIsNew(false);
    setEditing(true);
    setForm({
      key: row.key,
      type: row.type || guessed,
      enabled: Boolean(row.enabled),
      content: guessed === 'json' ? safeJsonPretty(row.content || '') : String(row.content || '')
    });
  };

  const quickEdit = (k: typeof RECOMMENDED_KEYS[number]) => {
    const existing = byKey.get(k.key);
    if (existing) {
      startEdit(existing);
      return;
    }
    setIsNew(true);
    setEditing(true);
    setForm({
      key: k.key,
      type: k.type,
      enabled: true,
      content:
        k.key === 'community_refuse_template'
          ? '该问题涉及高风险内容，建议理性看待并咨询专业人士。'
          : k.key === 'community_banned_words'
            ? JSON.stringify(['改命', '保证', '必发财', '必成功', '包中奖'], null, 2)
            : k.key === 'community_high_risk_words'
              ? JSON.stringify(['彩票', '投资', '疾病', '自杀', '犯罪', '赌博'], null, 2)
              : k.key === 'community_rate_limit'
                ? JSON.stringify({ windowSeconds: 60, maxRequests: 20, scope: 'session' }, null, 2)
                : DEFAULT_FORM.content
    });
  };

  const save = async () => {
    const key = String(form.key || '').trim();
    if (!key) return window.alert('请填写策略 key');
    if (isNew && rows.some((r) => r.key === key)) return window.alert('该 key 已存在，请用编辑');

    const nextType = String(form.type || guessTypeByKey(key)).trim() || 'text';
    const nextContent = String(form.content || '');
    const validated = validateJsonIfNeeded(nextType, nextContent);
    if (!validated.ok) return window.alert('JSON 内容不合法，请检查格式');

    setLoading(true);
    try {
      await api.updateAdminAiPolicy(key, {
        type: nextType,
        enabled: Boolean(form.enabled),
        content: nextType === 'json' ? validated.pretty : nextContent
      });
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
            <div className="text-base font-bold">输出策略</div>
            <div className="mt-1 text-xs text-gray-500">用于控制免责声明、禁用词过滤与高风险场景拒答（社区模块使用）。</div>
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
              新增策略
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {RECOMMENDED_KEYS.map((k) => {
            const r = byKey.get(k.key);
            return (
              <div key={k.key} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold">{k.label}</div>
                    <div className="mt-1 font-mono text-[11px] text-gray-500">{k.key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                        {r.enabled ? '已启用' : '已停用'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">未配置</span>
                    )}
                    <button type="button" className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50" onClick={() => quickEdit(k)} disabled={loading}>
                      {r ? '编辑' : '创建'}
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">{k.hint}</div>
                <div className="mt-2 text-xs text-gray-600">{r ? compact(r.content || '') : '使用默认值（未落库）'}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2">key</th>
                <th className="px-3 py-2">type</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">内容预览</th>
                <th className="px-3 py-2">更新时间</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="px-3 py-5 text-center text-gray-400" colSpan={6}>暂无策略</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{r.key}</td>
                    <td className="px-3 py-2">{r.type || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                        {r.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{compact(r.content || '')}</td>
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
            <div className="text-base font-bold">{isNew ? '新增策略' : '编辑策略'}</div>
            <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => { setEditing(false); setForm(DEFAULT_FORM); }}>
              关闭
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">key</label>
              <input value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} className="w-full rounded border p-2 font-mono text-xs" disabled={!isNew} />
              <div className="mt-1 text-[11px] text-gray-400">key 作为唯一标识，创建后不建议修改。</div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">type</label>
              <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))} className="w-full rounded border p-2 text-sm">
                <option value="text">text</option>
                <option value="json">json</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">启用</label>
              <div className="flex items-center gap-2 rounded border p-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
                <span className="text-gray-700">启用该策略</span>
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                className="h-64 w-full rounded border p-2 font-mono text-xs"
                placeholder={form.type === 'json' ? '["词1","词2"]' : '请输入文本'}
              />
              {form.type === 'json' ? <div className="mt-1 text-[11px] text-gray-400">JSON 类型请填写合法 JSON（例如数组）。保存前会做格式校验。</div> : null}
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
            <div className="text-xs text-gray-500">保存后立即生效；社区分析会在输入/输出阶段按策略执行风控。</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}




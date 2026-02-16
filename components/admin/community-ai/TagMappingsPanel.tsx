import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { MockAPI } from '../../../services/api';
import { CommunityTagMappingView } from '../../../types';
import { safeJsonPretty } from './shared';

interface TagMappingsPanelProps {
  api: typeof MockAPI;
}

type TagFilter = {
  element?: string[];
  material?: string[];
  keyword?: string;
  categoryIds?: string[];
};

type MappingForm = {
  tag: string;
  enabled: boolean;
  filterJson: string;
  elementCsv: string;
  materialCsv: string;
  keyword: string;
  categoryIdsCsv: string;
};

const DEFAULT_FORM: MappingForm = {
  tag: '',
  enabled: true,
  filterJson: '{\n  "element": [],\n  "material": [],\n  "keyword": \"\",\n  "categoryIds": []\n}',
  elementCsv: '',
  materialCsv: '',
  keyword: '',
  categoryIdsCsv: ''
};

function fmtTime(ts?: number) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '-';
  }
}

function compact(text: string, max = 140) {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function csvToList(csv: string) {
  return String(csv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseFilter(raw: string): TagFilter | null {
  const text = String(raw || '').trim();
  if (!text) return {};
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') return {};
    return obj as TagFilter;
  } catch {
    return null;
  }
}

export default function TagMappingsPanel({ api }: TagMappingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CommunityTagMappingView[]>([]);
  const [keyword, setKeyword] = useState('');

  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<MappingForm>(DEFAULT_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminAiTagMappings().catch(() => []);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.tag || '').toLowerCase().includes(q));
  }, [rows, keyword]);

  const startCreate = () => {
    setIsNew(true);
    setEditing(true);
    setForm(DEFAULT_FORM);
  };

  const startEdit = (row: CommunityTagMappingView) => {
    setIsNew(false);
    setEditing(true);
    const pretty = safeJsonPretty(row.filter || '{}');
    const parsed = parseFilter(pretty);
    setForm({
      tag: row.tag,
      enabled: Boolean(row.enabled),
      filterJson: pretty || '{}',
      elementCsv: Array.isArray(parsed?.element) ? parsed!.element!.join(',') : '',
      materialCsv: Array.isArray(parsed?.material) ? parsed!.material!.join(',') : '',
      keyword: typeof parsed?.keyword === 'string' ? parsed.keyword : '',
      categoryIdsCsv: Array.isArray(parsed?.categoryIds) ? parsed!.categoryIds!.join(',') : ''
    });
  };

  const applyHelperToJson = () => {
    const obj: TagFilter = {};
    const element = csvToList(form.elementCsv);
    const material = csvToList(form.materialCsv);
    const categoryIds = csvToList(form.categoryIdsCsv);
    const kw = String(form.keyword || '').trim();
    if (element.length > 0) obj.element = element;
    if (material.length > 0) obj.material = material;
    if (categoryIds.length > 0) obj.categoryIds = categoryIds;
    if (kw) obj.keyword = kw;
    setForm((prev) => ({ ...prev, filterJson: JSON.stringify(obj, null, 2) || '{}' }));
  };

  const save = async () => {
    const tag = String(form.tag || '').trim();
    if (!tag) return window.alert('请填写标签（tag）');

    const parsed = parseFilter(form.filterJson);
    if (parsed === null) return window.alert('filter JSON 不合法，请检查格式');

    setLoading(true);
    try {
      await api.updateAdminAiTagMapping(tag, {
        enabled: Boolean(form.enabled),
        filter: String(form.filterJson || '').trim() || '{}'
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
            <div className="text-base font-bold">标签映射</div>
            <div className="mt-1 text-xs text-gray-500">
              将报告中的标签映射为珠子筛选条件。未配置的标签默认按「元素=标签」做宽松匹配。
            </div>
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
              新增映射
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-72 rounded border px-3 py-2 text-sm"
            placeholder="搜索标签"
          />
          <div className="text-xs text-gray-400">共 {filtered.length} 条</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2">标签</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">筛选条件（JSON）</th>
                <th className="px-3 py-2">更新时间</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td className="px-3 py-5 text-center text-gray-400" colSpan={5}>暂无标签映射</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-semibold">{r.tag}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                        {r.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-600">{compact(r.filter || '{}')}</td>
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
            <div className="text-base font-bold">{isNew ? '新增映射' : '编辑映射'}</div>
            <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => { setEditing(false); setForm(DEFAULT_FORM); }}>
              关闭
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">标签（tag）</label>
              <input
                value={form.tag}
                onChange={(e) => setForm((prev) => ({ ...prev, tag: e.target.value }))}
                className="w-full rounded border p-2 text-sm"
                disabled={!isNew}
                placeholder="例如：木 / 火 / 水 / 金 / 土 / 桃花 / 财运"
              />
              <div className="mt-1 text-[11px] text-gray-400">创建后不建议修改 tag（与历史报告的标签保持一致）。</div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">启用</label>
              <div className="flex items-center gap-2 rounded border p-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
                <span className="text-gray-700">启用该映射</span>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm font-bold">结构化助手（可选）</div>
              <div className="mt-1 text-xs text-gray-500">填写后点击“生成JSON”会覆盖右侧 JSON 文本。</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">元素（逗号分隔）</label>
                  <input value={form.elementCsv} onChange={(e) => setForm((prev) => ({ ...prev, elementCsv: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="木,火" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">材质（逗号分隔）</label>
                  <input value={form.materialCsv} onChange={(e) => setForm((prev) => ({ ...prev, materialCsv: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="水晶,玛瑙" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">关键词</label>
                  <input value={form.keyword} onChange={(e) => setForm((prev) => ({ ...prev, keyword: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="招财" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">分类ID（逗号分隔）</label>
                  <input value={form.categoryIdsCsv} onChange={(e) => setForm((prev) => ({ ...prev, categoryIdsCsv: e.target.value }))} className="w-full rounded border p-2 text-sm" placeholder="cat_001,cat_002" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50" onClick={applyHelperToJson} disabled={loading}>
                  生成JSON
                </button>
                <div className="text-xs text-gray-500">提示：不用助手也可以直接编辑 JSON。</div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">filter（JSON）</label>
              <textarea
                value={form.filterJson}
                onChange={(e) => setForm((prev) => ({ ...prev, filterJson: e.target.value }))}
                className="h-72 w-full rounded border p-2 font-mono text-xs"
                placeholder={'{\n  "element": ["木"],\n  "material": ["水晶"],\n  "keyword": "招财",\n  "categoryIds": ["cat_001"]\n}'}
              />
              <div className="mt-1 text-[11px] text-gray-400">
                字段说明：`element/material` 为数组（命中任一即通过）；`keyword` 为包含匹配；`categoryIds` 用于限制分类。
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
            <div className="text-xs text-gray-500">保存后立即生效；推荐接口会按标签映射筛选珠子。</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


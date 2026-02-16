import React, { useMemo, useState } from 'react';
import { Design, SystemConfig } from '../../types';
import { Grid, Pin, Search, Sparkles, Trash2, User } from 'lucide-react';

interface AdminPlazaProps {
  designs: Design[];
  onDeleteDesign: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  config: SystemConfig;
  setConfig: (c: SystemConfig) => void;
  onSaveConfig: (c?: SystemConfig) => void;
}

const AdminPlaza: React.FC<AdminPlazaProps> = ({
  designs,
  onDeleteDesign,
  onTogglePin,
  config,
  setConfig,
  onSaveConfig
}) => {
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [onlyPinned, setOnlyPinned] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const categories = config.plazaCategories || [];

  const filteredDesigns = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (designs || []).filter((item) => {
      if (categoryId !== 'all' && String(item.plazaCategoryId || '') !== categoryId) return false;
      if (onlyPinned && !item.isPinned) return false;
      if (!q) return true;
      return (
        String(item.id || '').toLowerCase().includes(q) ||
        String(item.name || '').toLowerCase().includes(q) ||
        String(item.author || '').toLowerCase().includes(q)
      );
    });
  }, [designs, keyword, categoryId, onlyPinned]);

  const handleUpdateCategory = (id: string, key: 'name' | 'visible' | 'sortOrder', value: string | boolean | number) => {
    const next = categories.map((cat) => (cat.id === id ? { ...cat, [key]: value } : cat));
    setConfig({ ...config, plazaCategories: next });
  };

  const handleAddCategory = () => {
    const next = [
      ...categories,
      {
        id: `c_${Date.now()}`,
        name: '新分类',
        sortOrder: categories.length + 1,
        visible: true
      }
    ];
    const nextConfig = { ...config, plazaCategories: next };
    setConfig(nextConfig);
    onSaveConfig(nextConfig);
  };

  const requestDeleteCategory = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除分类',
      message: '确认删除该分类？已关联作品不会被删除。',
      onConfirm: () => {
        const next = categories.filter((cat) => cat.id !== id);
        const nextConfig = { ...config, plazaCategories: next };
        setConfig(nextConfig);
        onSaveConfig(nextConfig);
        setConfirmDialog(null);
      }
    });
  };

  const requestDeleteDesign = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除作品',
      message: '确认删除该作品？此操作不可撤销。',
      onConfirm: () => {
        onDeleteDesign(id);
        setConfirmDialog(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-gray-50 pb-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Grid size={20} className="text-[#07c160]" /> 广场分类配置
          </h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => onSaveConfig(config)} className="rounded-lg bg-[#07c160] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#06ad56]">保存分类</button>
            <button type="button" onClick={handleAddCategory} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">新增分类</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {categories.map((cat) => (
            <div key={cat.id} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <input value={cat.name} onChange={(e) => handleUpdateCategory(cat.id, 'name', e.target.value)} className="col-span-6 rounded border p-2 text-sm" />
              <input type="number" value={Number(cat.sortOrder || 0)} onChange={(e) => handleUpdateCategory(cat.id, 'sortOrder', Number(e.target.value || 0))} className="col-span-2 rounded border p-2 text-sm" />
              <label className="col-span-2 flex items-center justify-center gap-1 text-xs text-gray-500">
                <input type="checkbox" checked={cat.visible !== false} onChange={(e) => handleUpdateCategory(cat.id, 'visible', e.target.checked)} className="accent-[#07c160]" /> 显示
              </label>
              <button type="button" className="col-span-2 text-red-500 hover:text-red-600" onClick={() => requestDeleteCategory(cat.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Sparkles size={20} className="text-orange-500" /> 作品管理 ({filteredDesigns.length}/{designs.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索作品ID/标题/作者"
                className="w-56 rounded-lg border py-2 pl-9 pr-3 text-sm"
              />
            </div>

            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="all">全部分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <label className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm">
              <input type="checkbox" checked={onlyPinned} onChange={(e) => setOnlyPinned(e.target.checked)} className="accent-black" /> 仅看置顶
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-6 md:grid-cols-3 lg:grid-cols-4">
          {filteredDesigns.map((d) => (
            <div key={d.id} className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative aspect-square overflow-hidden bg-gray-100">
                {d.imageUrl ? <img src={d.imageUrl} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <div className="flex h-full w-full items-center justify-center text-gray-300">无图片</div>}
                <div className="absolute left-3 top-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onTogglePin(d.id, !d.isPinned)}
                    className={`rounded-full px-2 py-1 text-xs font-bold shadow ${d.isPinned ? 'bg-amber-500 text-white' : 'bg-white/90 text-gray-600 hover:bg-gray-100'}`}
                    title={d.isPinned ? '取消置顶' : '置顶作品'}
                  >
                    <span className="inline-flex items-center gap-1"><Pin size={12} /> {d.isPinned ? '已置顶' : '置顶'}</span>
                  </button>
                </div>

                <button type="button" onClick={() => requestDeleteDesign(d.id)} className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-red-500 opacity-0 shadow-lg transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100" title="删除作品">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h4 className="line-clamp-1 flex-1 font-bold text-gray-800" title={d.name}>{d.name || '未命名作品'}</h4>
                  <div className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">❤ {d.likes}</div>
                </div>

                <div className="mb-3 flex items-center gap-1 text-xs text-gray-500"><User size={12} /> {d.author || '匿名用户'}</div>

                <div className="mt-2 flex items-center justify-between border-t border-gray-50 pt-3">
                  <div className="rounded bg-orange-50 px-2 py-1 text-xs font-medium text-orange-600">{Array.isArray(d.beads) ? d.beads.length : 0} 颗珠</div>
                  <div className="text-base font-bold text-gray-900">¥{Number(d.totalPrice || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredDesigns.length === 0 ? <div className="p-12 text-center text-gray-400">暂无符合条件的作品</div> : null}
      </div>

      {confirmDialog?.isOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">{confirmDialog.title}</h3>
            <p className="mb-6 text-sm text-gray-500">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="rounded-lg px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50">取消</button>
              <button onClick={confirmDialog.onConfirm} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600">确认</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminPlaza;

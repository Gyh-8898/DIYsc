import React, { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Image as ImageIcon, Package, Plus, PlusCircle, Trash2, Upload, X } from 'lucide-react';
import { AddOnProduct, InventoryItem, MainCategory, SubCategory, SystemConfig } from '../../types';
import { MockAPI } from '../../services/api';

interface AdminProductsProps {
  config: SystemConfig;
  setConfig: (c: SystemConfig) => void;
  addOns: AddOnProduct[];
  setAddOns: (a: AddOnProduct[]) => void;
  onSaveAddOns: (a: AddOnProduct[]) => void;
  onSaveConfig: (c?: SystemConfig) => void;
}

interface DialogState {
  isOpen: boolean;
  type: 'confirm' | 'prompt';
  title: string;
  message?: string;
  inputValue?: string;
  onConfirm: (val?: string) => void;
}

interface GalleryImageItem {
  id: string;
  url: string;
  storage: 'local' | 'qiniu';
  name?: string;
  createdAt: number;
}

type ViewType = 'beads' | 'addons' | 'gallery';

type EditableItem = InventoryItem | AddOnProduct;

function ensureInventoryTree(config: SystemConfig) {
  return config.inventoryTree || { mainCategories: [] };
}

const AdminProducts: React.FC<AdminProductsProps> = ({
  config,
  setConfig,
  addOns,
  setAddOns,
  onSaveAddOns,
  onSaveConfig
}) => {
  const [view, setView] = useState<ViewType>('beads');
  const [selectedMainId, setSelectedMainId] = useState<string>('');
  const [selectedSubId, setSelectedSubId] = useState<string>('');

  const [gallerySource, setGallerySource] = useState<'auto' | 'local' | 'qiniu'>('auto');
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImageItem[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [editingImages, setEditingImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: 'confirm',
    title: '',
    onConfirm: () => undefined
  });

  const inventoryTree = ensureInventoryTree(config);
  const mainCategories = inventoryTree.mainCategories || [];

  const activeMain = useMemo(
    () => mainCategories.find((c) => c.id === selectedMainId),
    [mainCategories, selectedMainId]
  );

  const activeSub = useMemo(
    () => activeMain?.subCategories.find((s) => s.id === selectedSubId),
    [activeMain, selectedSubId]
  );

  useEffect(() => {
    if (!selectedMainId && mainCategories.length > 0) {
      setSelectedMainId(mainCategories[0].id);
    }
  }, [mainCategories, selectedMainId]);

  useEffect(() => {
    if (!activeMain) return;
    if (activeMain.subCategories.length === 0) {
      setSelectedSubId('');
      return;
    }
    if (!activeMain.subCategories.some((s) => s.id === selectedSubId)) {
      setSelectedSubId(activeMain.subCategories[0].id);
    }
  }, [activeMain, selectedSubId]);

  useEffect(() => {
    const rows = Array.isArray(config.mediaLibrary) ? config.mediaLibrary : [];
    const normalized: GalleryImageItem[] = rows
      .map((item) => ({
        id: String(item.id || ''),
        url: String(item.url || ''),
        storage: item.storage === 'qiniu' ? 'qiniu' : 'local',
        name: String(item.name || ''),
        createdAt: Number(item.createdAt || Date.now())
      }))
      .filter((item) => Boolean(item.id && item.url));
    setGalleryImages(normalized);
  }, [config.mediaLibrary]);

  const persistConfig = (nextConfig: SystemConfig) => {
    setConfig(nextConfig);
    onSaveConfig(nextConfig);
  };

  const persistGallery = (nextList: GalleryImageItem[]) => {
    const nextConfig: SystemConfig = {
      ...config,
      mediaLibrary: nextList
    };
    persistConfig(nextConfig);
  };

  const requestPrompt = (title: string, onConfirm: (val: string) => void) => {
    setDialog({
      isOpen: true,
      type: 'prompt',
      title,
      inputValue: '',
      onConfirm: (val) => {
        const text = String(val || '').trim();
        if (!text) return;
        onConfirm(text);
        setDialog((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setDialog((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddMainCategory = () => {
    requestPrompt('请输入主分类名称', (name) => {
      const newMain: MainCategory = {
        id: `cat_${Date.now()}`,
        name,
        subCategories: []
      };
      const nextConfig: SystemConfig = {
        ...config,
        inventoryTree: {
          mainCategories: [...mainCategories, newMain]
        }
      };
      persistConfig(nextConfig);
      setSelectedMainId(newMain.id);
      setSelectedSubId('');
    });
  };

  const handleDeleteMainCategory = (id: string) => {
    requestConfirm('删除主分类', '确认删除该主分类及其所有子分类与商品？', () => {
      const nextConfig: SystemConfig = {
        ...config,
        inventoryTree: {
          mainCategories: mainCategories.filter((c) => c.id !== id)
        }
      };
      persistConfig(nextConfig);
      if (selectedMainId === id) {
        setSelectedMainId('');
        setSelectedSubId('');
      }
    });
  };

  const handleAddSubCategory = (mainCatId: string) => {
    requestPrompt('请输入子分类名称', (name) => {
      const newSub: SubCategory = {
        id: `sub_${Date.now()}`,
        name,
        items: []
      };

      const nextMain = mainCategories.map((main) =>
        main.id === mainCatId
          ? {
              ...main,
              subCategories: [...main.subCategories, newSub]
            }
          : main
      );

      persistConfig({
        ...config,
        inventoryTree: { mainCategories: nextMain }
      });

      if (selectedMainId === mainCatId) {
        setSelectedSubId(newSub.id);
      }
    });
  };

  const handleDeleteSubCategory = (mainCatId: string, subCatId: string) => {
    requestConfirm('删除子分类', '确认删除该子分类及其商品？', () => {
      const nextMain = mainCategories.map((main) =>
        main.id === mainCatId
          ? {
              ...main,
              subCategories: main.subCategories.filter((sub) => sub.id !== subCatId)
            }
          : main
      );

      persistConfig({
        ...config,
        inventoryTree: { mainCategories: nextMain }
      });

      if (selectedSubId === subCatId) {
        setSelectedSubId('');
      }
    });
  };

  const openAddModal = () => {
    if (view === 'beads') {
      const item: InventoryItem = {
        id: '',
        name: '',
        price: 0,
        sizeMm: 8,
        color: '#d1d5db',
        image: '',
        inStock: true,
        material: '',
        element: '',
        meaning: '',
        description: '',
        images: []
      };
      setEditingItem(item);
      setEditingImages([]);
    } else {
      const addOn: AddOnProduct = {
        id: '',
        name: '',
        price: 0,
        image: '',
        category: '',
        inStock: true,
        visible: true,
        note: ''
      };
      setEditingItem(addOn);
      setEditingImages([]);
    }
    setNewImageUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: EditableItem) => {
    setEditingItem(item);
    if ('sizeMm' in item) {
      setEditingImages(Array.isArray(item.images) ? item.images : []);
    } else {
      setEditingImages([]);
    }
    setNewImageUrl('');
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!editingItem) return;

    if (view === 'beads') {
      if (!selectedMainId || !selectedSubId) {
        alert('请先选择子分类');
        return;
      }
      const draft = editingItem as InventoryItem;
      if (!draft.name.trim()) {
        alert('请输入商品名称');
        return;
      }

      const savedItem: InventoryItem = {
        ...draft,
        id: draft.id || `item_${Date.now()}`,
        images: editingImages
      };

      const nextMain = mainCategories.map((main) => {
        if (main.id !== selectedMainId) return main;
        const nextSubs = main.subCategories.map((sub) => {
          if (sub.id !== selectedSubId) return sub;
          const index = sub.items.findIndex((item) => item.id === savedItem.id);
          const nextItems = [...sub.items];
          if (index >= 0) {
            nextItems[index] = savedItem;
          } else {
            nextItems.push(savedItem);
          }
          return { ...sub, items: nextItems };
        });
        return { ...main, subCategories: nextSubs };
      });

      persistConfig({
        ...config,
        inventoryTree: { mainCategories: nextMain }
      });
    } else {
      const draft = editingItem as AddOnProduct;
      if (!draft.name.trim()) {
        alert('请输入加购商品名称');
        return;
      }
      const savedAddOn: AddOnProduct = {
        ...draft,
        id: draft.id || `addon_${Date.now()}`
      };
      const index = addOns.findIndex((item) => item.id === savedAddOn.id);
      const nextAddOns = [...addOns];
      if (index >= 0) {
        nextAddOns[index] = savedAddOn;
      } else {
        nextAddOns.push(savedAddOn);
      }
      setAddOns(nextAddOns);
      onSaveAddOns(nextAddOns);
    }

    setIsModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    requestConfirm('删除商品', '确认删除该商品？', () => {
      if (view === 'beads') {
        const nextMain = mainCategories.map((main) => {
          if (main.id !== selectedMainId) return main;
          const nextSubs = main.subCategories.map((sub) => {
            if (sub.id !== selectedSubId) return sub;
            return {
              ...sub,
              items: sub.items.filter((item) => item.id !== id)
            };
          });
          return { ...main, subCategories: nextSubs };
        });
        persistConfig({
          ...config,
          inventoryTree: { mainCategories: nextMain }
        });
      } else {
        const nextAddOns = addOns.filter((item) => item.id !== id);
        setAddOns(nextAddOns);
        onSaveAddOns(nextAddOns);
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, toGallery = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;

      if (toGallery) {
        setGalleryUploading(true);
        try {
          const uploaded = await MockAPI.uploadImage(dataUrl, gallerySource);
          const nextItem: GalleryImageItem = {
            id: `gallery_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
            url: String(uploaded.url || uploaded.path || ''),
            storage: uploaded.storage === 'qiniu' ? 'qiniu' : 'local',
            name: file.name,
            createdAt: Date.now()
          };
          if (!nextItem.url) throw new Error('上传失败，未返回图片地址');
          persistGallery([nextItem, ...galleryImages]);
        } catch (error: any) {
          alert(error?.message || '上传失败');
        } finally {
          setGalleryUploading(false);
        }
        return;
      }

      if (editingItem) {
        setEditingItem({
          ...editingItem,
          image: dataUrl
        } as EditableItem);

        if (!galleryImages.some((item) => item.url === dataUrl)) {
          persistGallery([
            {
              id: `gallery_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
              url: dataUrl,
              storage: 'local',
              name: file.name,
              createdAt: Date.now()
            },
            ...galleryImages
          ]);
        }
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteGalleryImage = (index: number) => {
    requestConfirm('删除图片', '确认删除该图片？', () => {
      persistGallery(galleryImages.filter((_, i) => i !== index));
    });
  };

  const activeItems = activeSub?.items || [];

  return (
    <div className="relative flex h-[calc(100vh-140px)] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-gray-50 p-4">
        <div className="flex gap-6">
          <button type="button" onClick={() => setView('beads')} className={`border-b-2 pb-1 text-sm font-bold transition-colors ${view === 'beads' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}>珠子库存</button>
          <button type="button" onClick={() => setView('addons')} className={`border-b-2 pb-1 text-sm font-bold transition-colors ${view === 'addons' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}>加购商品</button>
          <button type="button" onClick={() => setView('gallery')} className={`flex items-center gap-1 border-b-2 pb-1 text-sm font-bold transition-colors ${view === 'gallery' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}><ImageIcon size={14} /> 素材图库</button>
        </div>

        {view !== 'gallery' ? (
          <button type="button" onClick={openAddModal} className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-xs font-bold text-white hover:opacity-90"><Plus size={14} /> 添加商品</button>
        ) : (
          <div className="flex items-center gap-2">
            <select value={gallerySource} onChange={(e) => setGallerySource(e.target.value as 'auto' | 'local' | 'qiniu')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs">
              <option value="auto">自动选择（推荐）</option>
              <option value="local">仅本地存储</option>
              <option value="qiniu">仅七牛云</option>
            </select>
            <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-[#07c160] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
              <Upload size={14} /> {galleryUploading ? '上传中...' : '上传图片'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} />
            </label>
          </div>
        )}
      </div>

      {view === 'beads' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-60 overflow-y-auto border-r border-gray-100 bg-gray-50 p-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <h4 className="text-xs font-bold text-gray-400">分类结构</h4>
              <button type="button" onClick={handleAddMainCategory} className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] hover:bg-gray-100">+ 主分类</button>
            </div>

            {mainCategories.map((main) => (
              <div key={main.id} className="mb-2">
                <div onClick={() => { setSelectedMainId(main.id); setSelectedSubId(''); }} className={`group mb-1 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${selectedMainId === main.id ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <span className="flex-1 truncate">{main.name}</span>
                  <button type="button" className="p-1 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteMainCategory(main.id); }}><Trash2 size={12} /></button>
                </div>

                {selectedMainId === main.id && (
                  <div className="space-y-1 pl-3">
                    {main.subCategories.map((sub) => (
                      <div key={sub.id} onClick={() => setSelectedSubId(sub.id)} className={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${selectedSubId === sub.id ? 'bg-[#07c160]/5 font-bold text-[#07c160]' : 'text-gray-500 hover:text-gray-800'}`}>
                        <span className="flex-1 truncate">{sub.name}</span>
                        <button type="button" className="p-1 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteSubCategory(main.id, sub.id); }}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => handleAddSubCategory(main.id)} className="flex w-full items-center gap-1 px-3 py-2 text-left text-[10px] text-blue-500 hover:underline"><FolderPlus size={12} /> 添加子分类</button>
                  </div>
                )}
              </div>
            ))}

            {mainCategories.length === 0 && <div className="py-4 text-center text-xs text-gray-400">暂无分类，请先新增主分类</div>}
          </div>

          <div className="flex-1 overflow-y-auto bg-white p-6">
            {activeSub ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                {activeItems.map((item) => (
                  <div key={item.id} className="group relative rounded-xl border border-gray-100 p-3 transition-all hover:border-gray-200 hover:shadow-lg">
                    <div className="relative mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                      {item.image ? <img src={item.image} className="h-full w-full object-cover" /> : <div style={{ background: item.color, width: '60%', height: '60%', borderRadius: '50%' }} />}
                    </div>
                    <div className="truncate text-sm font-bold text-gray-800">{item.name}</div>
                    <div className="mt-1 flex justify-between text-xs text-gray-500"><span>{item.sizeMm}mm</span><span className="font-bold text-black">¥{item.price}</span></div>
                    <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                      <button type="button" onClick={() => openEditModal(item)} className="rounded border border-gray-100 bg-white p-1.5 text-blue-500 shadow-sm hover:bg-blue-50"><Package size={14} /></button>
                      <button type="button" onClick={() => handleDeleteItem(item.id)} className="rounded border border-gray-100 bg-white p-1.5 text-red-500 shadow-sm hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={openAddModal} className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 transition-all hover:border-gray-300 hover:text-gray-600"><PlusCircle size={24} /><span className="text-xs font-bold">添加珠子</span></button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300"><Package size={48} className="opacity-20" /><p>请先选择左侧子分类</p></div>
            )}
          </div>
        </div>
      )}

      {view === 'addons' && (
        <div
          className="flex-1 overflow-y-auto bg-white p-6"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
            alignContent: 'start'
          }}
        >
          {addOns.map((addon) => (
            <div key={addon.id} className="group relative rounded-xl border border-gray-100 p-3 transition-all hover:border-gray-200 hover:shadow-lg" style={{ minHeight: '260px' }}>
              <div className="mb-2 overflow-hidden rounded-lg bg-gray-50" style={{ aspectRatio: '1 / 1' }}>{addon.image ? <img src={addon.image} className="h-full w-full object-cover" /> : null}</div>
              <div className="truncate text-sm font-bold text-gray-800">{addon.name}</div>
              <div className="mt-1 flex justify-between text-xs text-gray-500"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px]">{addon.category || '未分类'}</span><span className="font-bold text-black">¥{addon.price}</span></div>

              <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                <button type="button" onClick={() => openEditModal(addon)} className="rounded border border-gray-100 bg-white p-1.5 text-blue-500 shadow-sm hover:bg-blue-50"><Package size={14} /></button>
                <button type="button" onClick={() => handleDeleteItem(addon.id)} className="rounded border border-gray-100 bg-white p-1.5 text-red-500 shadow-sm hover:bg-red-50"><Trash2 size={14} /></button>
              </div>

              <div className="absolute bottom-2 right-2 flex gap-1">
                <button type="button" onClick={(e) => { e.stopPropagation(); const next = addOns.map((item) => item.id === addon.id ? { ...item, inStock: !item.inStock } : item); setAddOns(next); onSaveAddOns(next); }} className={`rounded border px-1.5 py-0.5 text-[10px] ${addon.inStock ? 'border-green-200 bg-green-50 text-green-600' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>{addon.inStock ? '有货' : '缺货'}</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); const next = addOns.map((item) => item.id === addon.id ? { ...item, visible: item.visible !== false ? false : true } : item); setAddOns(next); onSaveAddOns(next); }} className={`rounded border px-1.5 py-0.5 text-[10px] ${addon.visible !== false ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>{addon.visible !== false ? '显示' : '隐藏'}</button>
              </div>
            </div>
          ))}

          <button type="button" onClick={openAddModal} className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 transition-all hover:border-gray-300 hover:text-gray-600" style={{ minHeight: '260px' }}><PlusCircle size={24} /><span className="text-xs font-bold">添加加购商品</span></button>
        </div>
      )}

      {view === 'gallery' && (
        <div className="flex-1 overflow-y-auto bg-white p-6">
          <div className="grid grid-cols-3 gap-4 md:grid-cols-5 lg:grid-cols-6">
            {galleryImages.map((img, idx) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                <img src={img.url} className="h-full w-full object-contain p-1" />
                <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[10px] text-gray-700">{img.storage === 'qiniu' ? '七牛云' : '本地'}</span>
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => { navigator.clipboard.writeText(img.url); alert(`已复制${img.storage === 'qiniu' ? '七牛云' : '本地'}地址`); }} className="rounded bg-white px-2 py-1 text-xs text-black hover:bg-gray-200">复制地址</button>
                  <button type="button" onClick={() => handleDeleteGalleryImage(idx)} className="rounded bg-red-500 p-1 text-white hover:bg-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          {galleryImages.length === 0 ? <div className="mt-20 text-center text-gray-400">暂无图片，请上传素材</div> : null}
        </div>
      )}

      {isModalOpen && editingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between p-6 pb-4">
              <h3 className="text-lg font-bold text-gray-800">{editingItem.id ? '编辑商品' : '添加商品'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-500">商品名称</label>
                <input type="text" value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 outline-none transition-colors focus:border-black" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-bold text-gray-500">价格 (元)</label>
                  <input type="number" value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value || 0) } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 outline-none transition-colors focus:border-black" />
                </div>
                {'sizeMm' in editingItem ? (
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-bold text-gray-500">尺寸 (mm)</label>
                    <input type="number" value={editingItem.sizeMm} onChange={(e) => setEditingItem({ ...editingItem, sizeMm: Number(e.target.value || 0) } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 outline-none transition-colors focus:border-black" />
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-500">图片 URL</label>
                <div className="flex gap-2">
                  <input type="text" value={(editingItem as any).image || ''} onChange={(e) => setEditingItem({ ...editingItem, image: e.target.value } as EditableItem)} className="flex-1 rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-black" />
                  <label className="flex cursor-pointer items-center justify-center rounded-lg bg-gray-100 px-3 text-gray-600 transition-colors hover:bg-gray-200"><Upload size={18} /><input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} /></label>
                </div>
              </div>

              {'sizeMm' in editingItem ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="mb-1.5 block text-xs font-bold text-gray-500">材质</label><input type="text" value={editingItem.material || ''} onChange={(e) => setEditingItem({ ...editingItem, material: e.target.value } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-black" /></div>
                    <div><label className="mb-1.5 block text-xs font-bold text-gray-500">属性</label><input type="text" value={editingItem.element || ''} onChange={(e) => setEditingItem({ ...editingItem, element: e.target.value } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-black" /></div>
                  </div>

                  <div><label className="mb-1.5 block text-xs font-bold text-gray-500">寓意</label><input type="text" value={editingItem.meaning || ''} onChange={(e) => setEditingItem({ ...editingItem, meaning: e.target.value } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-black" /></div>

                  <div><label className="mb-1.5 block text-xs font-bold text-gray-500">描述</label><textarea rows={3} value={editingItem.description || ''} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value } as EditableItem)} className="w-full resize-none rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-black" /></div>

                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="mb-3 text-xs font-bold text-gray-400">实拍图</h4>
                    <div className="mb-2 flex gap-2">
                      <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="输入实拍图 URL" className="flex-1 rounded-lg border border-gray-200 p-2 text-sm outline-none transition-colors focus:border-black" />
                      <button type="button" onClick={() => { const url = newImageUrl.trim(); if (!url) return; setEditingImages((prev) => [...prev, url]); setNewImageUrl(''); }} className="rounded-lg bg-black px-3 text-xs font-bold text-white hover:opacity-90">添加</button>
                    </div>
                    {editingImages.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {editingImages.map((url, idx) => (
                          <div key={`${url}_${idx}`} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-gray-100"><img src={url} className="h-full w-full object-cover" /><button type="button" onClick={() => setEditingImages((prev) => prev.filter((_, i) => i !== idx))} className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"><Trash2 size={14} /></button></div>
                        ))}
                      </div>
                    ) : <p className="py-3 text-center text-xs text-gray-300">暂无实拍图</p>}
                  </div>
                </>
              ) : (
                <>
                  <div><label className="mb-1.5 block text-xs font-bold text-gray-500">分类/标签</label><input type="text" value={(editingItem as AddOnProduct).category || ''} onChange={(e) => setEditingItem({ ...(editingItem as AddOnProduct), category: e.target.value } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-black" /></div>
                  <div><label className="mb-1.5 block text-xs font-bold text-gray-500">备注说明</label><input type="text" value={(editingItem as AddOnProduct).note || ''} onChange={(e) => setEditingItem({ ...(editingItem as AddOnProduct), note: e.target.value } as EditableItem)} className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-black" /></div>
                  <div className="flex gap-4 pt-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={(editingItem as AddOnProduct).visible !== false} onChange={(e) => setEditingItem({ ...(editingItem as AddOnProduct), visible: e.target.checked } as EditableItem)} className="h-4 w-4 accent-black" /><span>前台显示</span></label>
                    <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={(editingItem as AddOnProduct).inStock !== false} onChange={(e) => setEditingItem({ ...(editingItem as AddOnProduct), inStock: e.target.checked } as EditableItem)} className="h-4 w-4 accent-black" /><span>有货</span></label>
                  </div>
                </>
              )}

              <div className="pt-2"><button type="button" onClick={handleSaveItem} className="w-full rounded-xl bg-[#333] py-3 font-bold text-white shadow-lg transition-all hover:bg-black active:scale-[0.98]">保存商品</button></div>
            </div>
          </div>
        </div>
      ) : null}

      {dialog.isOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">{dialog.title}</h3>
            {dialog.message ? <p className="mb-4 text-sm text-gray-500">{dialog.message}</p> : null}
            {dialog.type === 'prompt' ? <input autoFocus type="text" className="mb-4 w-full rounded-lg border p-2 outline-none focus:border-black" placeholder="请输入..." onChange={(e) => setDialog((prev) => ({ ...prev, inputValue: e.target.value }))} /> : null}
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setDialog((prev) => ({ ...prev, isOpen: false }))} className="rounded-lg px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50">取消</button>
              <button type="button" onClick={() => dialog.onConfirm(dialog.type === 'prompt' ? dialog.inputValue : undefined)} className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white hover:opacity-90">确认</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminProducts;

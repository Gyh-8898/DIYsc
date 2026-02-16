import React from 'react';
import {
  AlertCircle,
  Image as ImageIcon,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Trash2
} from 'lucide-react';
import { SystemConfig } from '../../types';

interface AdminConfigProps {
  config: SystemConfig;
  setConfig: (c: SystemConfig) => void;
  onSave: () => void;
}

function ensureConfig(config: SystemConfig): SystemConfig {
  return {
    ...config,
    appUI: config.appUI || {
      appTitle: '晶奥之境',
      logoUrl: '',
      homeBanner: {
        imageUrl: '',
        title: '',
        subtitle: ''
      }
    },
    designerUI: {
      watermarkUrl: config.designerUI?.watermarkUrl || '',
      beadGapMm: Number(config.designerUI?.beadGapMm || 1)
    },
    features: config.features || {
      enableTrade: true,
      enableAffiliate: true,
      enableCommunity: true,
      showPrice: true,
      enableAddOns: true
    },
    business: config.business || {
      freeShippingThreshold: 99,
      baseShippingFee: 10,
      handworkFee: 3,
      customerServiceLink: ''
    },
    support: config.support || {
      wechat: '',
      phone: '',
      serviceHours: '09:00-21:00',
      faq: [
        { question: '下单后多久发货？', answer: '通常1-3天内完成制作并发货。' },
        { question: '可以修改地址吗？', answer: '未发货前可联系客服处理。' }
      ]
    },
    agreements: config.agreements || {
      user: '',
      privacy: '',
      distribution: ''
    },
    messageTemplates: config.messageTemplates || {
      orderPaid: '',
      orderShipped: '',
      promotion: ''
    },
    wristValidation: config.wristValidation || {
      toleranceMm: 20,
      overflowMessage: '手围偏大，请减少珠子',
      underflowMessage: '手围偏小，请继续添加珠子'
    },
    integrations: {
      payment: {
        provider: config.integrations?.payment?.provider || 'wechat',
        enabled: Boolean(config.integrations?.payment?.enabled),
        appId: config.integrations?.payment?.appId || '',
        mchId: config.integrations?.payment?.mchId || '',
        mchKey: config.integrations?.payment?.mchKey || '',
        notifyUrl: config.integrations?.payment?.notifyUrl || ''
      },
      logistics: {
        provider: config.integrations?.logistics?.provider || 'manual',
        enabled: Boolean(config.integrations?.logistics?.enabled),
        companyId: config.integrations?.logistics?.companyId || '',
        apiKey: config.integrations?.logistics?.apiKey || '',
        apiSecret: config.integrations?.logistics?.apiSecret || ''
      },
      platforms: config.integrations?.platforms || []
    }
  };
}

const AdminConfig: React.FC<AdminConfigProps> = ({ config, setConfig, onSave }) => {
  const safeConfig = ensureConfig(config);

  const updateConfig = (next: Partial<SystemConfig>) => {
    setConfig({ ...safeConfig, ...next });
  };

  const updateSupport = (patch: Partial<NonNullable<SystemConfig['support']>>) => {
    updateConfig({
      support: {
        ...(safeConfig.support || { wechat: '', phone: '', serviceHours: '', faq: [] }),
        ...patch
      }
    });
  };

  const addFaq = () => {
    const faq = [...(safeConfig.support?.faq || [])];
    faq.push({ question: '', answer: '' });
    updateSupport({ faq });
  };

  const updateFaq = (index: number, patch: { question?: string; answer?: string }) => {
    const faq = [...(safeConfig.support?.faq || [])];
    faq[index] = {
      question: String(faq[index]?.question || ''),
      answer: String(faq[index]?.answer || ''),
      ...patch
    };
    updateSupport({ faq });
  };

  const removeFaq = (index: number) => {
    const faq = [...(safeConfig.support?.faq || [])].filter((_item, idx) => idx !== index);
    updateSupport({ faq });
  };

  const toggleFeature = (key: keyof SystemConfig['features']) => {
    updateConfig({
      features: {
        ...safeConfig.features,
        [key]: !safeConfig.features[key]
      }
    });
  };


  const featureItems: Array<{ key: keyof SystemConfig['features']; label: string; desc: string }> = [
    { key: 'enableTrade', label: '开启交易系统', desc: '关闭后隐藏购物车与下单入口' },
    { key: 'enableAffiliate', label: '开启分销系统', desc: '控制推广中心与积分提现能力' },
    { key: 'enableCommunity', label: '开启社区模块', desc: '控制底部社区Tab的展示' },
    { key: 'showPrice', label: '显示商品价格', desc: '关闭后仅展示设计，不展示金额' },
    { key: 'enableAddOns', label: '开启加购商品', desc: '在结算页显示加购商品（如包装盒、贺卡）' }
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <Smartphone size={18} />
          小程序外观配置
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-500">小程序标题</label>
            <input
              type="text"
              value={safeConfig.appUI.appTitle}
              onChange={(e) =>
                updateConfig({
                  appUI: {
                    ...safeConfig.appUI,
                    appTitle: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">Logo URL</label>
            <input
              type="text"
              value={safeConfig.appUI.logoUrl || ''}
              onChange={(e) =>
                updateConfig({
                  appUI: {
                    ...safeConfig.appUI,
                    logoUrl: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <ImageIcon size={18} />
          首页 Banner 配置
        </h3>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-gray-500">Banner 图片 URL</label>
              <input
                type="text"
                value={safeConfig.appUI.homeBanner.imageUrl}
                onChange={(e) =>
                  updateConfig({
                    appUI: {
                      ...safeConfig.appUI,
                      homeBanner: {
                        ...safeConfig.appUI.homeBanner,
                        imageUrl: e.target.value
                      }
                    }
                  })
                }
                className="w-full rounded border p-2"
              />
            </div>
            <div className="h-16 w-24 overflow-hidden rounded border border-gray-200 bg-gray-100">
              {safeConfig.appUI.homeBanner.imageUrl && (
                <img src={safeConfig.appUI.homeBanner.imageUrl} alt="banner" className="h-full w-full object-cover" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-500">主标题</label>
              <input
                type="text"
                value={safeConfig.appUI.homeBanner.title}
                onChange={(e) =>
                  updateConfig({
                    appUI: {
                      ...safeConfig.appUI,
                      homeBanner: {
                        ...safeConfig.appUI.homeBanner,
                        title: e.target.value
                      }
                    }
                  })
                }
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-500">副标题</label>
              <input
                type="text"
                value={safeConfig.appUI.homeBanner.subtitle}
                onChange={(e) =>
                  updateConfig({
                    appUI: {
                      ...safeConfig.appUI,
                      homeBanner: {
                        ...safeConfig.appUI.homeBanner,
                        subtitle: e.target.value
                      }
                    }
                  })
                }
                className="w-full rounded border p-2"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <ImageIcon size={18} />
          工作台预览图配置
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-gray-500">中心背景图 URL（小程序工作台）</label>
            <input
              type="text"
              value={safeConfig.designerUI?.watermarkUrl || ''}
              onChange={(e) =>
                updateConfig({
                  designerUI: {
                    ...(safeConfig.designerUI || { watermarkUrl: '', beadGapMm: 1 }),
                    watermarkUrl: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">珠子间隙修正 (mm)</label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={Number(safeConfig.designerUI?.beadGapMm || 1)}
              onChange={(e) =>
                updateConfig({
                  designerUI: {
                    ...(safeConfig.designerUI || { watermarkUrl: '', beadGapMm: 1 }),
                    beadGapMm: Number(e.target.value || 1)
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
          <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-500">
            保存后，小程序工作台会实时使用该配置；未填写 URL 时显示默认中心标识图。
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <ShieldCheck size={18} />
          功能开关
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {featureItems.map((item) => {
            const enabled = safeConfig.features[item.key];
            return (
              <div key={item.key} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <h4 className="font-bold">{item.label}</h4>
                  <button
                    type="button"
                    onClick={() => toggleFeature(item.key)}
                    className={enabled ? 'text-[#07c160]' : 'text-gray-300'}
                  >
                    {enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <Settings size={18} />
          基础业务参数
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-500">满免运费金额 (元)</label>
            <input
              type="number"
              value={safeConfig.business.freeShippingThreshold}
              onChange={(e) =>
                updateConfig({
                  business: {
                    ...safeConfig.business,
                    freeShippingThreshold: Number(e.target.value)
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">基础运费 (元)</label>
            <input
              type="number"
              value={safeConfig.business.baseShippingFee}
              onChange={(e) =>
                updateConfig({
                  business: {
                    ...safeConfig.business,
                    baseShippingFee: Number(e.target.value)
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">手围误差容忍度 (mm)</label>
            <input
              type="number"
              value={safeConfig.wristValidation.toleranceMm}
              onChange={(e) =>
                updateConfig({
                  wristValidation: {
                    ...safeConfig.wristValidation,
                    toleranceMm: Number(e.target.value)
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">手工费 (元/件)</label>
            <input
              type="number"
              value={safeConfig.business.handworkFee}
              onChange={(e) =>
                updateConfig({
                  business: {
                    ...safeConfig.business,
                    handworkFee: Number(e.target.value)
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm text-gray-500">客服/帮助链接</label>
            <input
              type="text"
              value={safeConfig.business.customerServiceLink || ''}
              onChange={(e) =>
                updateConfig({
                  business: {
                    ...safeConfig.business,
                    customerServiceLink: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <Settings size={18} />
          客服与帮助配置
        </h3>

        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-500">客服微信号</label>
            <input
              type="text"
              value={safeConfig.support?.wechat || ''}
              onChange={(e) => updateSupport({ wechat: e.target.value })}
              className="w-full rounded border p-2"
              placeholder="例如：DIY-BRACELET-SERVICE"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">客服电话</label>
            <input
              type="text"
              value={safeConfig.support?.phone || ''}
              onChange={(e) => updateSupport({ phone: e.target.value })}
              className="w-full rounded border p-2"
              placeholder="例如：4000000000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">服务时间</label>
            <input
              type="text"
              value={safeConfig.support?.serviceHours || ''}
              onChange={(e) => updateSupport({ serviceHours: e.target.value })}
              className="w-full rounded border p-2"
              placeholder="例如：09:00-21:00"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold">FAQ 列表</h4>
            <button
              type="button"
              onClick={addFaq}
              className="inline-flex items-center gap-1 rounded border px-3 py-1 text-xs"
            >
              <Plus size={14} />
              新增 FAQ
            </button>
          </div>

          {(safeConfig.support?.faq || []).length === 0 && (
            <div className="rounded border border-dashed p-3 text-xs text-gray-400">暂无 FAQ，请点击“新增 FAQ”。</div>
          )}

          {(safeConfig.support?.faq || []).map((item, index) => (
            <div key={`faq_${index}`} className="grid grid-cols-12 gap-2 rounded border border-gray-100 p-3">
              <input
                type="text"
                value={item.question}
                onChange={(e) => updateFaq(index, { question: e.target.value })}
                className="col-span-4 rounded border p-2 text-sm"
                placeholder="问题"
              />
              <input
                type="text"
                value={item.answer}
                onChange={(e) => updateFaq(index, { answer: e.target.value })}
                className="col-span-7 rounded border p-2 text-sm"
                placeholder="答案"
              />
              <div className="col-span-1 flex items-center justify-end">
                <button type="button" onClick={() => removeFaq(index)} className="text-red-500" title="删除 FAQ">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <Settings size={18} />
          协议与消息模板
        </h3>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-500">用户协议文本</label>
            <textarea
              value={safeConfig.agreements?.user || ''}
              onChange={(e) =>
                updateConfig({
                  agreements: {
                    ...(safeConfig.agreements || { user: '', privacy: '', distribution: '' }),
                    user: e.target.value
                  }
                })
              }
              className="h-28 w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">隐私政策文本</label>
            <textarea
              value={safeConfig.agreements?.privacy || ''}
              onChange={(e) =>
                updateConfig({
                  agreements: {
                    ...(safeConfig.agreements || { user: '', privacy: '', distribution: '' }),
                    privacy: e.target.value
                  }
                })
              }
              className="h-28 w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">分销规则文本</label>
            <textarea
              value={safeConfig.agreements?.distribution || ''}
              onChange={(e) =>
                updateConfig({
                  agreements: {
                    ...(safeConfig.agreements || { user: '', privacy: '', distribution: '' }),
                    distribution: e.target.value
                  }
                })
              }
              className="h-28 w-full rounded border p-2"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">支付成功模板ID</label>
            <input
              type="text"
              value={safeConfig.messageTemplates?.orderPaid || ''}
              onChange={(e) =>
                updateConfig({
                  messageTemplates: {
                    ...(safeConfig.messageTemplates || { orderPaid: '', orderShipped: '', promotion: '' }),
                    orderPaid: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">发货通知模板ID</label>
            <input
              type="text"
              value={safeConfig.messageTemplates?.orderShipped || ''}
              onChange={(e) =>
                updateConfig({
                  messageTemplates: {
                    ...(safeConfig.messageTemplates || { orderPaid: '', orderShipped: '', promotion: '' }),
                    orderShipped: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">推广活动模板ID</label>
            <input
              type="text"
              value={safeConfig.messageTemplates?.promotion || ''}
              onChange={(e) =>
                updateConfig({
                  messageTemplates: {
                    ...(safeConfig.messageTemplates || { orderPaid: '', orderShipped: '', promotion: '' }),
                    promotion: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 border-b pb-2 font-bold">
          <AlertCircle size={18} />
          提示语配置
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-500">珠子超出手围提示</label>
            <input
              type="text"
              value={safeConfig.wristValidation.overflowMessage}
              onChange={(e) =>
                updateConfig({
                  wristValidation: {
                    ...safeConfig.wristValidation,
                    overflowMessage: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">珠子不足手围提示</label>
            <input
              type="text"
              value={safeConfig.wristValidation.underflowMessage}
              onChange={(e) =>
                updateConfig({
                  wristValidation: {
                    ...safeConfig.wristValidation,
                    underflowMessage: e.target.value
                  }
                })
              }
              className="w-full rounded border p-2"
            />
          </div>
        </div>
      </div>


      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-2 rounded-lg bg-[#07c160] px-8 py-3 font-bold text-white shadow-md"
        >
          <Save size={18} />
          保存所有配置
        </button>
      </div>
    </div>
  );
};

export default AdminConfig;

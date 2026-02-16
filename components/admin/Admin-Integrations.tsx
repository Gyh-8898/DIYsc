import React from 'react';
import {
  Cloud,
  CreditCard,
  Plus,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck
} from 'lucide-react';
import { SystemConfig } from '../../types';

interface AdminIntegrationsProps {
  config: SystemConfig;
  setConfig: (c: SystemConfig) => void;
  onSave: () => void;
}

const AdminIntegrations: React.FC<AdminIntegrationsProps> = ({ config, setConfig, onSave }) => {
  void onSave;
  const safeConfig = config;

  const updateConfig = (next: Partial<SystemConfig>) => {
    setConfig({ ...safeConfig, ...next });
  };

  const updatePayment = (patch: Partial<NonNullable<SystemConfig['integrations']>['payment']>) => {
    updateConfig({
      integrations: {
        ...safeConfig.integrations,
        payment: { ...safeConfig.integrations?.payment, ...patch }
      }
    });
  };

  const updateLogistics = (patch: Partial<NonNullable<SystemConfig['integrations']>['logistics']>) => {
    updateConfig({
      integrations: {
        ...safeConfig.integrations,
        logistics: { ...safeConfig.integrations?.logistics, ...patch }
      }
    });
  };

  const updateQiniu = (patch: Partial<NonNullable<NonNullable<SystemConfig['integrations']>['qiniu']>>) => {
    updateConfig({
      integrations: {
        ...safeConfig.integrations,
        qiniu: {
          enabled: false,
          ...safeConfig.integrations?.qiniu,
          ...patch
        }
      }
    });
  };

  const addPlatform = () => {
    const platform = {
      id: `platform_${Date.now()}`,
      name: '新平台',
      provider: 'custom',
      baseUrl: '',
      apiKey: '',
      apiSecret: '',
      enabled: false,
      notes: ''
    };

    updateConfig({
      integrations: {
        ...safeConfig.integrations,
        platforms: [...(safeConfig.integrations?.platforms || []), platform]
      }
    });
  };

  const updatePlatform = (id: string, patch: Record<string, unknown>) => {
    const next = (safeConfig.integrations?.platforms || []).map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
    updateConfig({
      integrations: { ...safeConfig.integrations, platforms: next }
    });
  };

  const removePlatform = (id: string) => {
    const next = (safeConfig.integrations?.platforms || []).filter((item) => item.id !== id);
    updateConfig({
      integrations: { ...safeConfig.integrations, platforms: next }
    });
  };

  const inputClass = 'w-full rounded border p-2 text-sm';
  const cardClass = 'rounded-lg border border-gray-100 bg-gray-50 p-5';

  return (
    <div className="max-w-5xl space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-gray-800">
          <Settings size={20} className="text-gray-500" />
          第三方服务对接
        </h3>
        <p className="mb-6 text-sm text-gray-400">统一管理第三方 API 接入参数，修改后请点击顶部“保存配置”。</p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-bold">
                <CreditCard size={16} className="text-green-600" />
                支付通道
              </h4>
              <button
                type="button"
                onClick={() => updatePayment({ enabled: !safeConfig.integrations?.payment?.enabled })}
                className={safeConfig.integrations?.payment?.enabled ? 'text-[#07c160]' : 'text-gray-300'}
                title="启用/停用"
              >
                {safeConfig.integrations?.payment?.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">支付渠道</label>
                <select
                  value={safeConfig.integrations?.payment?.provider || 'wechat'}
                  onChange={(e) => updatePayment({ provider: e.target.value as any })}
                  className={inputClass}
                >
                  <option value="wechat">微信支付</option>
                  <option value="alipay">支付宝</option>
                  <option value="stripe">Stripe</option>
                  <option value="mock">模拟支付</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">应用 ID（AppID）</label>
                <input type="text" value={safeConfig.integrations?.payment?.appId || ''} onChange={(e) => updatePayment({ appId: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">商户号（MchID）</label>
                <input type="text" value={safeConfig.integrations?.payment?.mchId || ''} onChange={(e) => updatePayment({ mchId: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">商户密钥（MchKey）</label>
                <input type="password" value={safeConfig.integrations?.payment?.mchKey || ''} onChange={(e) => updatePayment({ mchKey: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">支付回调地址（Notify URL）</label>
                <input type="text" value={safeConfig.integrations?.payment?.notifyUrl || ''} onChange={(e) => updatePayment({ notifyUrl: e.target.value })} className={inputClass} placeholder="https://api.domain.com/api/payments/notify" />
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-bold">
                <Truck size={16} className="text-blue-600" />
                物流通道
              </h4>
              <button
                type="button"
                onClick={() => updateLogistics({ enabled: !safeConfig.integrations?.logistics?.enabled })}
                className={safeConfig.integrations?.logistics?.enabled ? 'text-[#07c160]' : 'text-gray-300'}
                title="启用/停用"
              >
                {safeConfig.integrations?.logistics?.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">物流服务商</label>
                <select
                  value={safeConfig.integrations?.logistics?.provider || 'manual'}
                  onChange={(e) => updateLogistics({ provider: e.target.value as any })}
                  className={inputClass}
                >
                  <option value="manual">手动录入</option>
                  <option value="kuaidi100">快递100</option>
                  <option value="kdniao">快递鸟</option>
                  <option value="mock">模拟物流</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">客户编号 / CompanyId</label>
                <input type="text" value={safeConfig.integrations?.logistics?.companyId || ''} onChange={(e) => updateLogistics({ companyId: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">接口密钥（API Key）</label>
                <input type="text" value={safeConfig.integrations?.logistics?.apiKey || ''} onChange={(e) => updateLogistics({ apiKey: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">接口密钥（API Secret）</label>
                <input type="password" value={safeConfig.integrations?.logistics?.apiSecret || ''} onChange={(e) => updateLogistics({ apiSecret: e.target.value })} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-bold">
                <Cloud size={16} className="text-purple-600" />
                七牛云存储
              </h4>
              <button
                type="button"
                onClick={() => updateQiniu({ enabled: !safeConfig.integrations?.qiniu?.enabled })}
                className={safeConfig.integrations?.qiniu?.enabled ? 'text-[#07c160]' : 'text-gray-300'}
                title="启用/停用"
              >
                {safeConfig.integrations?.qiniu?.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Access Key</label>
                <input type="text" value={safeConfig.integrations?.qiniu?.accessKey || ''} onChange={(e) => updateQiniu({ accessKey: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Secret Key</label>
                <input type="password" value={safeConfig.integrations?.qiniu?.secretKey || ''} onChange={(e) => updateQiniu({ secretKey: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">空间名称（Bucket）</label>
                <input type="text" value={safeConfig.integrations?.qiniu?.bucket || ''} onChange={(e) => updateQiniu({ bucket: e.target.value })} className={inputClass} placeholder="my-bucket" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">访问域名（CDN Domain）</label>
                <input type="text" value={safeConfig.integrations?.qiniu?.domain || ''} onChange={(e) => updateQiniu({ domain: e.target.value })} className={inputClass} placeholder="https://cdn.example.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">区域（Region）</label>
                <select
                  value={safeConfig.integrations?.qiniu?.region || 'z2'}
                  onChange={(e) => updateQiniu({ region: e.target.value })}
                  className={inputClass}
                >
                  <option value="z0">华东（z0）</option>
                  <option value="z1">华北（z1）</option>
                  <option value="z2">华南（z2）</option>
                  <option value="na0">北美（na0）</option>
                  <option value="as0">东南亚（as0）</option>
                </select>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-gray-400">启用后，素材图库上传可选择七牛云并返回对应云端地址。</p>
          </div>

          <div />
        </div>

        <div className="mt-6 rounded-lg border border-gray-100 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-bold">其他平台 API（可扩展）</h4>
            <button type="button" onClick={addPlatform} className="flex items-center gap-1 rounded border px-3 py-1 text-xs hover:bg-gray-50">
              <Plus size={14} />
              新增平台
            </button>
          </div>

          <div className="space-y-3">
            {(safeConfig.integrations?.platforms || []).length === 0 ? (
              <div className="rounded border border-dashed p-3 text-xs text-gray-400">暂无扩展平台配置</div>
            ) : null}

            {(safeConfig.integrations?.platforms || []).map((platform) => (
              <div key={platform.id} className="grid grid-cols-12 gap-2 rounded border border-gray-100 p-3">
                <input type="text" className="col-span-2 rounded border p-2 text-xs" value={platform.name} placeholder="平台名称" onChange={(e) => updatePlatform(platform.id, { name: e.target.value })} />
                <input type="text" className="col-span-2 rounded border p-2 text-xs" value={platform.provider} placeholder="供应商标识" onChange={(e) => updatePlatform(platform.id, { provider: e.target.value })} />
                <input type="text" className="col-span-3 rounded border p-2 text-xs" value={platform.baseUrl || ''} placeholder="接口地址（Base URL）" onChange={(e) => updatePlatform(platform.id, { baseUrl: e.target.value })} />
                <input type="text" className="col-span-2 rounded border p-2 text-xs" value={platform.apiKey || ''} placeholder="ApiKey" onChange={(e) => updatePlatform(platform.id, { apiKey: e.target.value })} />
                <input type="password" className="col-span-2 rounded border p-2 text-xs" value={platform.apiSecret || ''} placeholder="ApiSecret" onChange={(e) => updatePlatform(platform.id, { apiSecret: e.target.value })} />
                <div className="col-span-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => updatePlatform(platform.id, { enabled: !platform.enabled })}
                    className={platform.enabled ? 'text-[#07c160]' : 'text-gray-300'}
                    title="启用/停用"
                  >
                    {platform.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <button type="button" onClick={() => removePlatform(platform.id)} className="text-red-500" title="删除平台">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminIntegrations;

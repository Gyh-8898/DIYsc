import React, { useEffect, useMemo, useState } from 'react';
import { MockAPI } from '../../services/api';
import DashboardPanel from './community-ai/DashboardPanel';
import ModelsPanel from './community-ai/ModelsPanel';
import PoliciesPanel from './community-ai/PoliciesPanel';
import PromptsPanel from './community-ai/PromptsPanel';
import ProvidersPanel from './community-ai/ProvidersPanel';
import RouterPanel from './community-ai/RouterPanel';
import TagMappingsPanel from './community-ai/TagMappingsPanel';

type SubTab = 'dashboard' | 'providers' | 'models' | 'router' | 'prompts' | 'policies' | 'tag_mappings';

const TABS: Array<{ key: SubTab; label: string }> = [
  { key: 'dashboard', label: '运营看板' },
  { key: 'providers', label: '供应商配置' },
  { key: 'models', label: '模型中心' },
  { key: 'router', label: '路由策略' },
  { key: 'prompts', label: '提示词中心' },
  { key: 'policies', label: '输出策略' },
  { key: 'tag_mappings', label: '标签映射' }
];

interface AdminCommunityAIProps {
  api: typeof MockAPI;
}

export default function AdminCommunityAI({ api }: AdminCommunityAIProps) {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [ping, setPing] = useState<'idle' | 'ok' | 'fail'>('idle');

  // Light-weight health check: only verifies admin AI endpoints reachable, no heavy data loads.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.getAdminAiRouterRules();
        if (!cancelled) setPing('ok');
      } catch {
        if (!cancelled) setPing('fail');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const statusText = useMemo(() => {
    if (ping === 'idle') return '连接检测中...';
    if (ping === 'ok') return '已连接后端 AI 配置服务';
    return '连接失败：请先启动后端并确认管理员已登录';
  }, [ping]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">社区AI运营中心</h3>
          <div className={`text-xs ${ping === 'fail' ? 'text-rose-600' : 'text-gray-500'}`}>{statusText}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${subTab === tab.key ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'dashboard' ? <DashboardPanel api={api} /> : null}
      {subTab === 'providers' ? <ProvidersPanel api={api} /> : null}
      {subTab === 'models' ? <ModelsPanel api={api} /> : null}
      {subTab === 'router' ? <RouterPanel api={api} /> : null}
      {subTab === 'prompts' ? <PromptsPanel api={api} /> : null}
      {subTab === 'policies' ? <PoliciesPanel api={api} /> : null}
      {subTab === 'tag_mappings' ? <TagMappingsPanel api={api} /> : null}
    </div>
  );
}

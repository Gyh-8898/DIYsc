import React, { useEffect, useMemo, useState } from 'react';
import { MockAPI } from '../../../services/api';
import { AdminAiDashboardView } from '../../../types';
import MultiLineChart from '../widgets/MultiLineChart';

interface DashboardPanelProps {
  api: typeof MockAPI;
}

function kpiCard(title: string, value: number | string, desc: string) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-400">{desc}</div>
    </div>
  );
}

export default function DashboardPanel({ api }: DashboardPanelProps) {
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AdminAiDashboardView | null>(null);

  const load = async (rangeDays = days) => {
    setLoading(true);
    try {
      const resp = await api.getAdminAiDashboard(rangeDays);
      setData(resp);
    } catch (error: any) {
      window.alert(error?.message || '加载失败，请确认后端已启动并已登录管理员账号');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(days); }, [days]);

  const labels = data?.labels || [];
  const series = useMemo(() => {
    const s = data?.series;
    if (!s) return [];
    return [
      { name: '新增用户', color: '#0ea5e9', data: s.newUsers || [] },
      { name: '分析成功', color: '#16a34a', data: s.analysesSuccess || [] },
      { name: '报告保存', color: '#7c3aed', data: s.reportsSaved || [] },
      { name: '标签点击', color: '#f59e0b', data: s.tagClicks || [] },
      { name: '去工作台', color: '#111827', data: s.gotoDesigner || [] },
      { name: '成本(元)', color: '#ef4444', data: (s.cost || []).map((v) => Number(v || 0)), money: true }
    ];
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold">趋势分析</div>
            <div className="mt-1 text-xs text-gray-500">用于观察社区分析的使用量、转化和成本。</div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 7, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d as 1 | 7 | 30)}
                className={`rounded px-3 py-1.5 text-sm ${days === d ? 'bg-black text-white' : 'border bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {d === 1 ? '今日' : `${d}天`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => load(days)}
              className="rounded border bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              disabled={loading}
              title="刷新"
            >
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {kpiCard('新增用户', data?.totals?.newUsers || 0, '范围内新注册用户')}
          {kpiCard('分析成功', data?.totals?.analysesSuccess || 0, '成功完成分析的次数')}
          {kpiCard('分析失败', data?.totals?.analysesFail || 0, '失败/被拦截的次数')}
          {kpiCard('报告保存', data?.totals?.reportsSaved || 0, '用户保存报告的次数')}
          {kpiCard('标签点击', data?.totals?.tagClicks || 0, '从报告点击标签')}
          {kpiCard('成本(元)', (data?.totals?.cost || 0).toFixed(2), '估算的调用成本')}
        </div>

        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold text-gray-800">趋势曲线</div>
            <div className="text-xs text-gray-500">鼠标悬停可查看每个时间点的明细</div>
          </div>
          <MultiLineChart labels={labels} series={series} height={340} />
          <div className="mt-2 text-xs text-gray-400">时间点已标注在曲线下方</div>
        </div>
      </div>
    </div>
  );
}


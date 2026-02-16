import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, DollarSign, Eye, ShoppingCart, Users } from 'lucide-react';
import { AnalyticsOverview } from '../../types';

interface AdminAnalyticsProps {
  overview: AnalyticsOverview | null;
  rangeDays: 1 | 7 | 30;
  onChangeRange: (days: 1 | 7 | 30) => void;
  loading?: boolean;
}

const EVENT_LABEL: Record<string, string> = {
  register: '用户注册',
  first_order_paid: '首单支付',
  order_paid: '订单支付',
  daily_sign_in: '每日签到',
  share_success: '分享成功',
  coupon_redeem: '优惠券核销',
  order_cancel: '订单取消'
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: '待付款',
  pending_production: '制作中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refund_requested: '售后中'
};

function toNum(v: unknown, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function safeArray(values?: number[]) {
  return Array.isArray(values) ? values.map((v) => toNum(v, 0)) : [];
}

function pct(v: number) {
  return `${Math.abs(v).toFixed(2)}%`;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function pickAxisIndices(total: number) {
  if (total <= 0) return [] as number[];
  if (total <= 6) return Array.from({ length: total }, (_, i) => i);
  const points = [0, Math.round((total - 1) * 0.25), Math.round((total - 1) * 0.5), Math.round((total - 1) * 0.75), total - 1];
  return Array.from(new Set(points)).sort((a, b) => a - b);
}

function AnimatedNumber({ value, precision = 0, prefix = '' }: { value: number; precision?: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const from = display;
    const to = toNum(value, 0);
    const start = performance.now();
    const duration = 400;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{prefix}{display.toFixed(precision)}</>;
}

function KpiCard({
  title,
  value,
  desc,
  change,
  icon,
  color,
  money = false
}: {
  title: string;
  value: number;
  desc: string;
  change: number;
  icon: React.ReactNode;
  color: string;
  money?: boolean;
}) {
  const positive = change >= 0;
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-500">{title}</div>
        <div className="mt-1 mb-1.5 text-2xl font-bold text-gray-800">
          <AnimatedNumber value={value} precision={money ? 2 : 0} prefix={money ? '¥' : ''} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 ${positive ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {pct(change)}
          </span>
          <span className="truncate text-gray-500">{desc}</span>
        </div>
      </div>
      <div className={`grid h-12 w-12 place-items-center rounded-full ${color}`}>{icon}</div>
    </div>
  );
}

function MultiLineChart({
  labels,
  series
}: {
  labels: string[];
  series: Array<{ name: string; color: string; data: number[]; money?: boolean }>;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.data), 1);
  const axisIdx = pickAxisIndices(labels.length);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const pathFor = (data: number[]) =>
    data
      .map((v, idx) => `${(idx / Math.max(data.length - 1, 1)) * 100},${100 - (toNum(v, 0) / max) * 100}`)
      .join(' ');

  const indexToXPct = (idx: number) => (idx / Math.max(labels.length - 1, 1)) * 100;
  const valueToYPct = (v: number) => 100 - (toNum(v, 0) / max) * 100;

  return (
    <div className="h-full">
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <div key={s.name} className="inline-flex items-center gap-1 text-gray-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 100 100"
          className="h-[250px] w-full rounded border border-gray-100 bg-white"
          onMouseMove={(e) => {
            if (labels.length === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const idx = clamp(Math.round((x / rect.width) * Math.max(labels.length - 1, 1)), 0, labels.length - 1);
            setHoverIdx(idx);
            setHoverPos({ x, y });
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <line x1="0" y1="100" x2="100" y2="100" stroke="#e5e7eb" strokeWidth="1" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="#f3f4f6" strokeWidth="0.8" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#f3f4f6" strokeWidth="0.8" />
          <line x1="0" y1="25" x2="100" y2="25" stroke="#f3f4f6" strokeWidth="0.8" />

          {series.map((s) => (
            <polyline key={s.name} points={pathFor(s.data)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {hoverIdx !== null ? (
            <>
              <line x1={indexToXPct(hoverIdx)} y1="0" x2={indexToXPct(hoverIdx)} y2="100" stroke="#94a3b8" strokeWidth="0.7" strokeDasharray="2 2" />
              {series.map((s) => {
                const value = toNum(s.data[hoverIdx], 0);
                return (
                  <circle
                    key={`dot_${s.name}`}
                    cx={indexToXPct(hoverIdx)}
                    cy={valueToYPct(value)}
                    r="1.6"
                    fill="#fff"
                    stroke={s.color}
                    strokeWidth="1"
                  />
                );
              })}
            </>
          ) : null}
        </svg>

        {hoverIdx !== null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[150px] rounded border border-gray-200 bg-white p-2 text-xs shadow-lg"
            style={{
              left: `${hoverPos.x + 10}px`,
              top: `${Math.max(8, hoverPos.y - 30)}px`
            }}
          >
            <div className="mb-1 font-semibold text-gray-700">{labels[hoverIdx] || '-'}</div>
            <div className="space-y-1">
              {series.map((s) => {
                const value = toNum(s.data[hoverIdx], 0);
                return (
                  <div key={`tip_${s.name}`} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-semibold text-gray-800">{s.money ? `¥${value.toFixed(2)}` : value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-gray-400">
        {axisIdx.map((idx) => (
          <span key={idx}>{labels[idx] || '-'}</span>
        ))}
      </div>
    </div>
  );
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ overview, rangeDays, onChangeRange, loading }) => {
  const kpis = overview?.kpis;
  const trends = overview?.trends;
  const eventRows = overview?.events24h || [];
  const orderRows = overview?.orderStats || [];

  const labels = trends?.labels || [];
  const newUsers = safeArray(trends?.newUsers);
  const orders = safeArray(trends?.orders);
  const sales = safeArray(trends?.sales);
  const shipped = safeArray(trends?.shipped);

  const pendingOrders = orderRows.reduce((sum, row) => {
    if (row.status === 'pending_payment' || row.status === 'pending_production') {
      return sum + toNum(row._count?.status, 0);
    }
    return sum;
  }, 0);

  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const avgOrders = avg(orders);
  const avgSales = avg(sales);

  const growthUsers = kpis?.totalUsers ? ((toNum(kpis.newUsersToday, 0) / Math.max(toNum(kpis.totalUsers, 1), 1)) * 100) : 0;
  const growthOrders = avgOrders ? ((toNum(kpis?.ordersToday, 0) - avgOrders) / avgOrders) * 100 : 0;
  const growthSales = avgSales ? ((toNum(kpis?.salesToday, 0) - avgSales) / avgSales) * 100 : 0;
  const growthPending = kpis?.totalOrders ? -((pendingOrders / Math.max(toNum(kpis.totalOrders, 1), 1)) * 100) : 0;

  const cards = [
    {
      title: '用户总数',
      value: toNum(kpis?.totalUsers, 0),
      desc: `今日新增 ${toNum(kpis?.newUsersToday, 0)} 人`,
      change: growthUsers,
      icon: <Users size={22} className="text-indigo-100" />,
      color: 'bg-indigo-500 ring-4 ring-indigo-100'
    },
    {
      title: '今日订单',
      value: toNum(kpis?.ordersToday, 0),
      desc: '对比近期均值',
      change: growthOrders,
      icon: <Eye size={22} className="text-blue-100" />,
      color: 'bg-blue-500 ring-4 ring-blue-100'
    },
    {
      title: '今日销售额',
      value: toNum(kpis?.salesToday, 0),
      desc: '实时订单收入',
      change: growthSales,
      icon: <DollarSign size={22} className="text-emerald-100" />,
      color: 'bg-emerald-500 ring-4 ring-emerald-100',
      money: true
    },
    {
      title: '待处理订单',
      value: pendingOrders,
      desc: '待付款 + 制作中',
      change: growthPending,
      icon: <ShoppingCart size={22} className="text-orange-100" />,
      color: 'bg-orange-500 ring-4 ring-orange-100'
    }
  ];

  const lineSeries = useMemo(
    () => [
      { name: '销售额', color: '#6366f1', data: sales, money: true },
      { name: '订单量', color: '#06b6d4', data: orders },
      { name: '发货量', color: '#22c55e', data: shipped },
      { name: '新增会员', color: '#f59e0b', data: newUsers }
    ],
    [sales, orders, shipped, newUsers]
  );

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800">数据仪表盘</h3>
            <p className="mt-0.5 text-xs text-gray-500">鼠标移入趋势图可实时预览每天数据</p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 7, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onChangeRange(days as 1 | 7 | 30)}
                className={`rounded px-3 py-1.5 text-sm ${rangeDays === days ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {days === 1 ? '今日' : `${days}天`}
              </button>
            ))}
          </div>
        </div>
        {loading ? <div className="mt-2 text-xs text-gray-500">数据刷新中...</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <React.Fragment key={card.title}>
            <KpiCard {...card} />
          </React.Fragment>
        ))}
      </div>

      <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-1 text-lg text-gray-700">趋势分析</div>
        <div className="mb-3 text-sm text-gray-500">销售/订单/发货/新增会员按天对比</div>
        <MultiLineChart labels={labels} series={lineSeries} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-bold">24小时事件统计</div>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-white text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">事件名</th>
                <th className="px-4 py-2">次数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eventRows.map((row) => (
                <tr key={row.eventType}>
                  <td className="px-4 py-2">{EVENT_LABEL[row.eventType] || row.eventType}</td>
                  <td className="px-4 py-2">{row._count.eventType}</td>
                </tr>
              ))}
              {eventRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-400" colSpan={2}>
                    暂无事件数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-bold">订单状态分布</div>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-white text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">状态</th>
                <th className="px-4 py-2">数量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orderRows.map((row) => (
                <tr key={row.status}>
                  <td className="px-4 py-2">{ORDER_STATUS_LABEL[row.status] || row.status}</td>
                  <td className="px-4 py-2">{row._count.status}</td>
                </tr>
              ))}
              {orderRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-400" colSpan={2}>
                    暂无订单统计
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;


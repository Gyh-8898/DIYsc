import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, LogisticEvent } from '../../types';
import { Package, Search, Truck, X } from 'lucide-react';
import { orderService } from '../../services/orderService';

interface AdminOrdersProps {
  orders: Order[];
  refreshOrders: () => void;
}

const CARRIERS = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', 'EMS', '京东物流', '极兔速递'];

const TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: '全部订单' },
  { id: 'pending_payment', label: '待付款' },
  { id: 'pending_production', label: '待发货' },
  { id: 'shipped', label: '已发货' },
  { id: 'completed', label: '已完成' },
  { id: 'cancelled', label: '已取消' }
];

function getStatusLabel(status: OrderStatus) {
  switch (status) {
    case 'pending_payment':
      return '待付款';
    case 'pending_production':
      return '待发货';
    case 'shipped':
      return '已发货';
    case 'completed':
      return '已完成';
    case 'cancelled':
      return '已取消';
    case 'refund_requested':
      return '售后中';
    default:
      return '未知';
  }
}

const AdminOrders: React.FC<AdminOrdersProps> = ({ orders, refreshOrders }) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showShipModal, setShowShipModal] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Order | null>(null);
  const [showLogisticsModal, setShowLogisticsModal] = useState<{ order: Order; events: LogisticEvent[] } | null>(null);

  const [shipForm, setShipForm] = useState({ trackingNo: '', carrier: CARRIERS[0] });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    window.alert(`已复制：${text}`);
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const matchTab = activeTab === 'all' ? true : o.status === activeTab;
        const term = searchTerm.toLowerCase();
        const matchSearch =
          !searchTerm ||
          o.id.toLowerCase().includes(term) ||
          o.userName.toLowerCase().includes(term) ||
          (o.trackingNumber && o.trackingNumber.toLowerCase().includes(term));
        return matchTab && matchSearch;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, activeTab, searchTerm]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach((o) => {
      c[o.status] = (c[o.status] || 0) + 1;
    });
    return c;
  }, [orders]);

  const handleShip = async () => {
    if (!showShipModal || !shipForm.trackingNo.trim()) {
      window.alert('请输入运单号');
      return;
    }

    await orderService.updateOrderStatus(showShipModal, 'shipped', shipForm.trackingNo.trim(), shipForm.carrier);
    setShowShipModal(null);
    setShipForm({ trackingNo: '', carrier: CARRIERS[0] });
    refreshOrders();
    window.alert('发货成功');
  };

  const handleViewLogistics = async (order: Order) => {
    const events = await orderService.getLogistics(order);
    setShowLogisticsModal({ order, events });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-gray-50/50">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-wrap gap-4 items-end shrink-0">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500 font-bold mb-1.5 block ml-1">订单搜索</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="订单号 / 买家 / 物流单号"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-black outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setActiveTab('all');
            }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            重置筛选
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 flex gap-6 text-sm font-bold text-gray-500 sticky top-0 z-10 shrink-0 rounded-t-xl shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 relative transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'text-black' : 'hover:text-gray-700'}`}
          >
            {tab.label}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {counts[tab.id] || 0}
            </span>
            {activeTab === tab.id ? <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-t-full" /> : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-400 flex flex-col items-center">
            <Package size={48} className="opacity-20 mb-2" />
            暂无相关订单
          </div>
        ) : null}

        {filteredOrders.map((order) => (
          <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gray-50/80 px-4 py-3 flex justify-between items-center text-xs text-gray-500 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-900">{new Date(order.createdAt).toLocaleString()}</span>
                <span>
                  订单号 <span className="font-mono text-gray-700 select-all">{order.id}</span>
                </span>
                <button onClick={() => copyToClipboard(order.id)} className="text-blue-500 hover:underline cursor-pointer">
                  复制
                </button>
              </div>
              <div className="flex items-center gap-2">
                {order.trackingNumber ? (
                  <span
                    onClick={() => handleViewLogistics(order)}
                    className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] cursor-pointer hover:bg-blue-100"
                  >
                    <Truck size={10} /> {order.carrier} {order.trackingNumber}
                  </span>
                ) : null}
                <button onClick={() => setShowDetailModal(order)} className="text-gray-900 font-bold hover:underline">
                  查看详情
                </button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-12 gap-3 items-center text-sm">
              <div className="col-span-5">
                <div className="font-bold text-gray-900">{order.items[0]?.name || '定制订单'}</div>
                <div className="text-xs text-gray-500 mt-1">{order.items[0]?.description || ''}</div>
                <div className="text-xs text-gray-400 mt-1">共 {order.items.reduce((s, i) => s + i.count, 0)} 件</div>
              </div>
              <div className="col-span-2 text-center font-bold">¥{order.totalAmount.toFixed(2)}</div>
              <div className="col-span-3 text-center text-xs text-gray-600">
                <div className="font-bold text-gray-900">{order.userName}</div>
                <div className="truncate mt-1">{order.shippingAddress}</div>
              </div>
              <div className="col-span-2 flex flex-col items-end gap-2">
                <span className="px-2 py-1 rounded text-xs font-bold border border-gray-200 bg-gray-50">
                  {getStatusLabel(order.status)}
                </span>
                {order.status === 'pending_production' ? (
                  <button
                    onClick={() => setShowShipModal(order.id)}
                    className="rounded bg-[#07c160] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#06ad56]"
                  >
                    发货
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showShipModal ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">填写发货信息</h3>
              <button onClick={() => setShowShipModal(null)}>
                <X size={20} className="text-gray-400 hover:text-black" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">物流公司</label>
                <select
                  value={shipForm.carrier}
                  onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-black"
                >
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">运单号码</label>
                <input
                  type="text"
                  placeholder="请输入或扫码单号"
                  autoFocus
                  value={shipForm.trackingNo}
                  onChange={(e) => setShipForm({ ...shipForm, trackingNo: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-black font-mono"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowShipModal(null)} className="flex-1 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg">
                取消
              </button>
              <button onClick={handleShip} className="flex-1 py-2.5 text-sm font-bold bg-black text-white rounded-lg hover:opacity-90">
                确认提交
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLogisticsModal ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md h-[70vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Truck size={18} /> 物流动态
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {showLogisticsModal.order.carrier}: {showLogisticsModal.order.trackingNumber}
                </p>
              </div>
              <button onClick={() => setShowLogisticsModal(null)}>
                <X size={20} className="text-gray-400 hover:text-black" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {showLogisticsModal.events.length === 0 ? (
                <div className="text-center text-gray-400 py-10">暂无物流信息</div>
              ) : (
                <div className="space-y-4">
                  {showLogisticsModal.events.map((event, idx) => (
                    <div key={idx} className="border-l-2 border-gray-200 pl-3">
                      <div className="text-sm font-bold text-gray-900">{event.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{event.detail}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(event.time).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showDetailModal ? (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-lg text-gray-900">订单详情</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{showDetailModal.id}</p>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <h4 className="font-bold text-sm mb-3">买家信息</h4>
                  <div className="text-sm text-gray-700">{showDetailModal.userName}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <h4 className="font-bold text-sm mb-3">收货信息</h4>
                  <p className="text-sm text-gray-700 leading-relaxed break-all">{showDetailModal.shippingAddress}</p>
                  {showDetailModal.remarks ? (
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <div className="mb-1 text-xs font-bold text-gray-500">订单备注</div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-all">{showDetailModal.remarks}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm mb-3">商品清单</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs">
                      <tr>
                        <th className="p-3">商品</th>
                        <th className="p-3 text-center">单价</th>
                        <th className="p-3 text-center">数量</th>
                        <th className="p-3 text-right">小计</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {showDetailModal.items.map((item, i) => (
                        <tr key={i}>
                          <td className="p-3">
                            <div className="font-bold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                          </td>
                          <td className="p-3 text-center">¥{item.price.toFixed(2)}</td>
                          <td className="p-3 text-center">x{item.count}</td>
                          <td className="p-3 text-right font-bold">¥{(item.price * item.count).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowDetailModal(null)} className="px-6 py-2.5 rounded-lg border border-gray-300 font-bold text-sm text-gray-600 hover:bg-white">
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminOrders;

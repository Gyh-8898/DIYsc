import React, { useMemo, useState } from 'react';
import { User, Order, PointHistory, Address } from '../../types';
import { MockAPI } from '../../services/api';
import { Users, X, MapPin, ShoppingBag, Coins, Network, Calendar, Search, Phone, User as UserIcon, Crown } from 'lucide-react';

interface AdminUsersProps {
  users: User[];
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: '待付款',
  pending_production: '制作中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refund_requested: '售后中'
};

const POINT_TYPE_LABEL: Record<string, string> = {
  earn_purchase: '消费获得',
  earn_referral: '邀请奖励',
  redeem: '积分抵扣',
  withdraw: '提现',
  refund: '退款返还',
  bonus: '后台发放',
  freeze: '冻结',
  unfreeze: '解冻',
  commission: '分销返佣'
};

function fmtDate(ts?: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString();
}

function fmtDateTime(ts?: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

const AdminUsers: React.FC<AdminUsersProps> = ({ users }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userPoints, setUserPoints] = useState<PointHistory[]>([]);
  const [userAddresses, setUserAddresses] = useState<Address[]>([]);
  const [userDownlines, setUserDownlines] = useState<User[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [activeTab, setActiveTab] = useState<'info' | 'orders' | 'points' | 'address' | 'team'>('info');

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.id || '').toLowerCase().includes(q) ||
        String(u.phone || '').toLowerCase().includes(q)
      );
    });
  }, [users, searchTerm]);

  const handleViewDetails = async (user: User) => {
    setSelectedUser(user);
    setActiveTab('info');
    setIsLoadingDetails(true);

    try {
      const [allOrders, points, addresses] = await Promise.all([
        MockAPI.getAllOrders(),
        MockAPI.getPointHistory(user.id),
        MockAPI.getUserAddresses(user.id)
      ]);

      setUserOrders(allOrders.filter((o) => o.userId === user.id).sort((a, b) => b.createdAt - a.createdAt));
      setUserPoints(points.sort((a, b) => b.createdAt - a.createdAt));
      setUserAddresses(addresses);
      setUserDownlines(users.filter((u) => u.referrerId === user.id));
    } catch (e) {
      console.error(e);
      window.alert('获取用户详情失败');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelectedUser(null);
    setUserOrders([]);
    setUserPoints([]);
    setUserAddresses([]);
    setUserDownlines([]);
  };

  const tabs = [
    { id: 'info' as const, icon: Users, label: '概览' },
    { id: 'orders' as const, icon: ShoppingBag, label: `订单 (${userOrders.length})` },
    { id: 'points' as const, icon: Coins, label: '积分明细' },
    { id: 'address' as const, icon: MapPin, label: `地址 (${userAddresses.length})` },
    { id: 'team' as const, icon: Network, label: `团队 (${userDownlines.length})` }
  ];

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[#333]" />
          <h3 className="font-bold text-[#333]">用户全景（{users.length}）</h3>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索昵称 / 用户ID / 手机号"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 rounded-full border border-gray-200 py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-black"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b bg-white text-xs text-gray-500 shadow-sm">
            <tr>
              <th className="px-6 py-3">用户</th>
              <th className="px-6 py-3">会员等级</th>
              <th className="px-6 py-3">可用积分</th>
              <th className="px-6 py-3">累计消费</th>
              <th className="px-6 py-3">注册时间</th>
              <th className="px-6 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="transition-colors hover:bg-gray-50">
                <td className="flex items-center gap-3 px-6 py-4">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                    {String(user.avatar || '').startsWith('http') ? <img src={user.avatar} className="h-full w-full object-cover" /> : <UserIcon size={20} className="text-gray-400" />}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{user.name}</div>
                    <div className="font-mono text-xs text-gray-400">{user.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-100 bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                    <Crown size={12} /> {user.levelName}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="font-bold text-gray-900">{user.points}</span>
                  <span className="ml-1 text-xs text-gray-400">分</span>
                </td>
                <td className="px-6 py-4 font-mono text-gray-600">¥{Number(user.totalSpend || 0).toFixed(2)}</td>
                <td className="px-6 py-4 text-xs text-gray-400">{fmtDate(user.createdAt)}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => void handleViewDetails(user)}
                    className="rounded-lg bg-black px-4 py-2 text-xs text-white shadow-sm transition-all hover:bg-gray-800 active:scale-95"
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">未找到匹配用户</td></tr> : null}
          </tbody>
        </table>
      </div>

      {selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="flex h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="w-64 shrink-0 border-r border-gray-100 bg-gray-50 p-6">
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-3 h-20 w-20 rounded-full bg-white p-1 shadow-sm">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gray-200">
                    {String(selectedUser.avatar || '').startsWith('http') ? <img src={selectedUser.avatar} className="h-full w-full object-cover" /> : <UserIcon size={32} className="text-gray-400" />}
                  </div>
                </div>
                <h2 className="text-lg font-bold text-gray-900">{selectedUser.name}</h2>
                <p className="mt-1 select-all font-mono text-xs text-gray-400">{selectedUser.id}</p>
              </div>

              <div className="space-y-4 text-sm">
                <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="mb-1 text-xs text-gray-400">会员等级</div>
                  <div className="flex items-center gap-1 font-bold text-yellow-600">
                    <Crown size={14} />
                    {selectedUser.levelName}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="mb-1 text-xs text-gray-400">绑定手机</div>
                  <div className="flex items-center gap-1 font-medium">
                    <Phone size={14} />
                    {selectedUser.phone || '未绑定'}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="mb-1 text-xs text-gray-400">注册时间</div>
                  <div className="flex items-center gap-1 font-medium">
                    <Calendar size={14} />
                    {fmtDate(selectedUser.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col bg-white">
              <div className="border-b border-gray-100 p-4 pr-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        <tab.icon size={16} />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={closeDetails} className="rounded-full p-2 transition-colors hover:bg-gray-100">
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="relative flex-1 overflow-y-auto bg-white p-6">
                {isLoadingDetails ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                    <div className="font-bold text-gray-400">加载数据中...</div>
                  </div>
                ) : null}

                {activeTab === 'info' ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white shadow-lg">
                      <div className="mb-1 text-sm text-white/60">累计消费金额</div>
                      <div className="text-3xl font-bold">¥{Number(selectedUser.totalSpend || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-[#d4bba3] to-[#c4ab93] p-6 text-white shadow-lg">
                      <div className="mb-1 text-sm text-white/80">当前可用积分</div>
                      <div className="text-3xl font-bold">{selectedUser.points}</div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-gray-100 p-6">
                      <h4 className="mb-4 flex items-center gap-2 font-bold text-gray-800">
                        <Network size={18} />
                        邀请关系
                      </h4>
                      {selectedUser.referrerName ? (
                        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-500">
                            {selectedUser.referrerName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold">{selectedUser.referrerName}</div>
                            <div className="text-xs text-gray-400">ID: {selectedUser.referrerId}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">无上级邀请人（系统直属用户）</div>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeTab === 'orders' ? (
                  <div className="space-y-3">
                    {userOrders.length > 0 ? userOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition-shadow hover:shadow-sm">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{order.items?.[0]?.name || '手串订单'}</span>
                            {Array.isArray(order.items) && order.items.length > 1 ? <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-500">+{order.items.length - 1}件</span> : null}
                          </div>
                          <div className="text-xs text-gray-400">订单号: {order.id} | {fmtDateTime(order.createdAt)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">¥{Number(order.totalAmount || 0).toFixed(2)}</div>
                          <span className={`rounded px-2 py-0.5 text-xs ${
                            order.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : order.status === 'pending_payment'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                          >
                            {ORDER_STATUS_LABEL[order.status] || order.status}
                          </span>
                        </div>
                      </div>
                    )) : <div className="py-10 text-center text-gray-400">暂无订单记录</div>}
                  </div>
                ) : null}

                {activeTab === 'points' ? (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-gray-400">
                      <tr>
                        <th className="pb-2 font-normal">时间</th>
                        <th className="pb-2 font-normal">类型 / 描述</th>
                        <th className="pb-2 text-right font-normal">变动</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {userPoints.map((p) => (
                        <tr key={p.id}>
                          <td className="w-36 py-3 text-xs text-gray-500">{fmtDate(p.createdAt)}</td>
                          <td className="py-3">
                            <div className="font-medium text-gray-800">{p.description}</div>
                            <div className="text-[10px] text-gray-400">{POINT_TYPE_LABEL[p.type] || p.type}</div>
                          </td>
                          <td className={`py-3 text-right font-bold ${p.amount > 0 ? 'text-[#d4bba3]' : 'text-gray-900'}`}>
                            {p.amount > 0 ? '+' : ''}{p.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                {activeTab === 'address' ? (
                  <div className="grid grid-cols-2 gap-4">
                    {userAddresses.length > 0 ? userAddresses.map((addr) => (
                      <div key={addr.id} className="relative rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                        <div className="mb-2 flex items-start justify-between">
                          <span className="font-bold text-gray-900">{addr.name}</span>
                          {addr.isDefault ? <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">默认</span> : null}
                        </div>
                        <div className="mb-1 text-sm text-gray-600">{addr.phone}</div>
                        <div className="text-xs leading-relaxed text-gray-400">{addr.region} {addr.detail}</div>
                      </div>
                    )) : <div className="col-span-2 py-10 text-center text-gray-400">暂无收货地址</div>}
                  </div>
                ) : null}

                {activeTab === 'team' ? (
                  <div className="space-y-2">
                    {userDownlines.length > 0 ? userDownlines.map((downline) => (
                      <div key={downline.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                          {String(downline.avatar || '').startsWith('http') ? <img src={downline.avatar} className="h-full w-full object-cover" /> : <UserIcon size={16} className="text-gray-400" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-gray-900">{downline.name}</div>
                          <div className="text-xs text-gray-400">注册: {fmtDate(downline.createdAt)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">订单数</div>
                          <div className="text-sm font-bold">{downline.orderCount}</div>
                        </div>
                      </div>
                    )) : <div className="py-10 text-center text-gray-400">暂无下级团队成员</div>}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminUsers;

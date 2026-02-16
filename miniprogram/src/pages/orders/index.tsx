import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ShoppingBag } from "../../components/Icons";
import { api, Order } from "../../services/api";
import "./index.scss";

type OrderTabKey = "all" | "pending_payment" | "pending_production" | "shipped";

const ORDER_TABS: Array<{ key: OrderTabKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "pending_payment", label: "待付款" },
  { key: "pending_production", label: "制作中" },
  { key: "shipped", label: "已发货" }
];

function getStatusText(status: string) {
  switch (status) {
    case "pending_payment":
      return "待付款";
    case "pending_production":
      return "制作中";
    case "shipped":
      return "已发货";
    case "completed":
      return "已完成";
    case "cancelled":
      return "已取消";
    default:
      return "处理中";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "pending_payment":
      return "status-pending";
    case "pending_production":
      return "status-production";
    case "shipped":
      return "status-shipped";
    case "completed":
      return "status-completed";
    default:
      return "status-default";
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<OrderTabKey>("all");
  const [loading, setLoading] = useState(false);

  useLoad((params) => {
    const status = typeof params?.status === "string" ? params.status : "";
    if (status === "pending_payment" || status === "pending_production" || status === "shipped") {
      setActiveTab(status);
      return;
    }
    setActiveTab("all");
  });

  const loadOrders = async () => {
    if (!api.auth.isLoggedIn()) {
      setOrders([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.orders.list();
      const sorted = (res || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载订单失败", icon: "none" });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadOrders();
  });

  const filteredOrders = useMemo(() => {
    if (activeTab === "all") return orders;
    if (activeTab === "shipped") {
      return orders.filter((order) => order.status === "shipped" || order.status === "completed");
    }
    return orders.filter((order) => order.status === activeTab);
  }, [activeTab, orders]);

  const openDetail = (orderId: string) => {
    Taro.navigateTo({ url: `/pages/order/detail?id=${encodeURIComponent(orderId)}` });
  };

  const handlePay = async (orderId: string) => {
    Taro.showLoading({ title: "支付中..." });
    try {
      await api.orders.updateStatus(orderId, "pending_production");
      Taro.hideLoading();
      Taro.showToast({ title: "支付成功", icon: "success" });
      loadOrders();
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || "支付失败", icon: "none" });
    }
  };

  const handleCancel = async (orderId: string) => {
    const confirm = await Taro.showModal({
      title: "提示",
      content: "确定取消该订单吗？"
    });
    if (!confirm.confirm) return;

    try {
      await api.orders.updateStatus(orderId, "cancelled");
      Taro.showToast({ title: "已取消", icon: "success" });
      loadOrders();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "取消失败", icon: "none" });
    }
  };

  const handleConfirmReceipt = async (orderId: string) => {
    const confirm = await Taro.showModal({
      title: "提示",
      content: "确认已收到商品吗？"
    });
    if (!confirm.confirm) return;

    try {
      await api.orders.updateStatus(orderId, "completed");
      Taro.showToast({ title: "已确认收货", icon: "success" });
      loadOrders();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "操作失败", icon: "none" });
    }
  };

  if (!api.auth.isLoggedIn()) {
    return (
      <View className="orders-container">
        <View className="empty-state">
          <ShoppingBag size={48} color="#e5e7eb" />
          <Text className="empty-text">登录后查看订单记录</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="orders-container">
      <View className="orders-tabs">
        {ORDER_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {activeTab === tab.key ? <View className="tab-indicator" /> : null}
          </View>
        ))}
      </View>

      <ScrollView scrollY className="orders-list">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <View key={order.id} className="order-card" onClick={() => openDetail(order.id)}>
              <View className="order-header">
                <Text className="order-date">{new Date(order.createdAt).toLocaleString()}</Text>
                <View className={`order-status ${getStatusClass(order.status)}`}>{getStatusText(order.status)}</View>
              </View>

              {order.items.map((item, idx) => (
                <View key={`${order.id}_${idx}`} className="order-body">
                  <View className="order-icon">
                    <ShoppingBag size={24} />
                  </View>
                  <View className="order-info">
                    <Text className="order-name">{item.name}</Text>
                    <Text className="order-desc">{item.spec || ""}</Text>
                    <View className="order-meta">
                      <Text className="order-price">¥{item.price}</Text>
                      <Text className="order-qty">x{item.count}</Text>
                    </View>
                  </View>
                </View>
              ))}

              <View className="order-footer">
                <View className="order-summary-row">
                  <Text className="summary-text">共{order.items.reduce((sum, item) => sum + item.count, 0)}件，实付</Text>
                  <Text className="summary-price">¥{order.totalAmount.toFixed(2)}</Text>
                </View>

                <View className="order-actions">
                  {order.status === "pending_payment" ? (
                    <>
                      <View
                        className="btn-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCancel(order.id);
                        }}
                      >
                        取消订单
                      </View>
                      <View
                        className="btn-action btn-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePay(order.id);
                        }}
                      >
                        立即支付
                      </View>
                    </>
                  ) : null}

                  {order.status === "pending_production" ? (
                    <View
                      className="btn-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(order.id);
                      }}
                    >
                      查看详情
                    </View>
                  ) : null}

                  {order.status === "shipped" ? (
                    <>
                      <View
                        className="btn-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetail(order.id);
                        }}
                      >
                        查看物流
                      </View>
                      <View
                        className="btn-action btn-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleConfirmReceipt(order.id);
                        }}
                      >
                        确认收货
                      </View>
                    </>
                  ) : null}

                  {order.status === "completed" || order.status === "cancelled" ? (
                    <View
                      className="btn-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(order.id);
                      }}
                    >
                      查看详情
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className="empty-state">
            <ShoppingBag size={48} color="#e5e7eb" />
            <Text className="empty-text">{loading ? "加载中..." : "暂无订单"}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

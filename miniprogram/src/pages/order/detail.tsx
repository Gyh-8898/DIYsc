import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useLoad, useUnload } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { api, LogisticsEvent, Order } from "../../services/api";
import "./detail.scss";

function formatDate(input: string | number) {
  const date = new Date(input);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

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
      return "pending";
    case "pending_production":
      return "production";
    case "shipped":
      return "shipped";
    case "completed":
      return "completed";
    default:
      return "default";
  }
}

export default function OrderDetailPage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [logistics, setLogistics] = useState<LogisticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingLogistics, setRefreshingLogistics] = useState(false);
  const [orderShippedTplId, setOrderShippedTplId] = useState("");
  const logisticsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearLogisticsTimer = () => {
    if (logisticsTimerRef.current) {
      clearInterval(logisticsTimerRef.current);
      logisticsTimerRef.current = null;
    }
  };

  useLoad((params) => {
    const id = typeof params?.id === "string" ? params.id : "";
    setOrderId(id);
  });

  const loadOrder = async (id: string) => {
    setLoading(true);
    try {
      const [detail, config] = await Promise.all([api.orders.get(id), api.config.get()]);
      const templates = (config as any)?.messageTemplates || {};
      setOrderShippedTplId(String(templates?.orderShipped || ""));
      setOrder(detail);
      if (detail.status === "shipped" || detail.status === "completed") {
        await loadLogistics(id, true);
      } else {
        setLogistics([]);
      }
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "订单加载失败", icon: "none" });
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const loadLogistics = async (id: string, silent = false) => {
    if (!silent) setRefreshingLogistics(true);
    try {
      const rows = await api.orders.logistics(id);
      setLogistics(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      if (!silent) {
        Taro.showToast({ title: error?.message || "物流加载失败", icon: "none" });
      }
      setLogistics([]);
    } finally {
      setRefreshingLogistics(false);
    }
  };

  useDidShow(() => {
    if (!orderId) return;
    loadOrder(orderId);
  });

  useDidHide(() => {
    clearLogisticsTimer();
  });

  useUnload(() => {
    clearLogisticsTimer();
  });

  useEffect(() => {
    clearLogisticsTimer();
    if (!orderId || !order || order.status !== "shipped") return;
    logisticsTimerRef.current = setInterval(() => {
      loadLogistics(orderId, true);
    }, 15000);
    return clearLogisticsTimer;
  }, [orderId, order?.status]);

  const handleCopyTracking = async () => {
    if (!order?.trackingNumber) {
      Taro.showToast({ title: "暂无物流单号", icon: "none" });
      return;
    }
    await Taro.setClipboardData({ data: order.trackingNumber });
    Taro.showToast({ title: "物流单号已复制", icon: "success" });
  };

  const handleSubscribe = async () => {
    if (!orderShippedTplId) {
      Taro.showToast({ title: "后台未配置发货通知模板", icon: "none" });
      return;
    }
    try {
      await Taro.requestSubscribeMessage({ tmplIds: [orderShippedTplId] } as any);
      Taro.showToast({ title: "订阅请求已发送", icon: "success" });
    } catch (_error) {
      Taro.showToast({ title: "订阅失败或已取消", icon: "none" });
    }
  };

  const handlePay = async () => {
    if (!order) return;
    Taro.showLoading({ title: "支付中..." });
    try {
      await api.orders.updateStatus(order.id, "pending_production");
      Taro.hideLoading();
      Taro.showToast({ title: "支付成功", icon: "success" });
      loadOrder(order.id);
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || "支付失败", icon: "none" });
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const confirm = await Taro.showModal({
      title: "提示",
      content: "确定取消该订单吗？"
    });
    if (!confirm.confirm) return;

    try {
      await api.orders.updateStatus(order.id, "cancelled");
      Taro.showToast({ title: "已取消", icon: "success" });
      loadOrder(order.id);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "取消失败", icon: "none" });
    }
  };

  const handleConfirmReceipt = async () => {
    if (!order) return;
    const confirm = await Taro.showModal({
      title: "提示",
      content: "确认已收到商品吗？"
    });
    if (!confirm.confirm) return;

    try {
      await api.orders.updateStatus(order.id, "completed");
      Taro.showToast({ title: "已确认收货", icon: "success" });
      loadOrder(order.id);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "操作失败", icon: "none" });
    }
  };

  if (!orderId) return <View className="order-detail-empty">缺少订单ID</View>;
  if (loading) return <View className="order-detail-loading">加载中...</View>;
  if (!order) return <View className="order-detail-empty">订单不存在或已删除</View>;

  const itemTotal = order.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.count || 0), 0);
  const shippingFee = Number(order.shippingFee || 0);
  const handworkFee = Number(order.handworkFee || 0);
  const couponAmount = Number(order.couponAmount || 0);
  const pointsDeduct = Number(order.pointsDeductAmount || 0);
  const payAmount = Number(order.totalAmount || 0);

  return (
    <View className="order-detail-page">
      <ScrollView scrollY className="order-detail-scroll">
        <View className="order-detail-body">
          <View className="order-detail-card">
            <View className="order-detail-top">
              <Text className={`order-detail-status ${getStatusClass(order.status)}`}>{getStatusText(order.status)}</Text>
            </View>
            <Text className="order-detail-time">下单时间：{formatDate(order.createdAt)}</Text>
            <Text className="order-detail-no">订单编号：{order.orderNo || order.id}</Text>
            {order.trackingNumber ? (
              <>
                <Text className="order-detail-no">物流单号：{order.trackingNumber}</Text>
                <View className="order-detail-copy" onClick={handleCopyTracking}>
                  复制单号
                </View>
              </>
            ) : null}
            <View className="order-detail-copy" onClick={handleSubscribe}>
              订阅发货通知
            </View>
          </View>

          <View className="order-detail-card">
            <Text className="order-detail-section-title">商品明细</Text>
            {order.items.map((item, index) => (
              <View key={`${order.id}_${index}`} className="order-detail-item">
                <View className="order-detail-item-top">
                  <Text className="order-detail-item-name">{item.name}</Text>
                  <Text className="order-detail-item-price">¥{Number(item.price || 0).toFixed(2)}</Text>
                </View>
                <Text className="order-detail-item-spec">
                  {item.spec || "定制手串"} x {item.count}
                </Text>
              </View>
            ))}
          </View>

          <View className="order-detail-card">
            <Text className="order-detail-section-title">费用明细</Text>
            <View className="order-detail-row">
              <Text className="order-detail-row-label">商品金额</Text>
              <Text className="order-detail-row-value">¥{itemTotal.toFixed(2)}</Text>
            </View>
            <View className="order-detail-row">
              <Text className="order-detail-row-label">手工费</Text>
              <Text className="order-detail-row-value">¥{handworkFee.toFixed(2)}</Text>
            </View>
            <View className="order-detail-row">
              <Text className="order-detail-row-label">运费</Text>
              <Text className="order-detail-row-value">¥{shippingFee.toFixed(2)}</Text>
            </View>
            {couponAmount > 0 ? (
              <View className="order-detail-row">
                <Text className="order-detail-row-label">优惠券</Text>
                <Text className="order-detail-row-value discount">-¥{couponAmount.toFixed(2)}</Text>
              </View>
            ) : null}
            {pointsDeduct > 0 ? (
              <View className="order-detail-row">
                <Text className="order-detail-row-label">积分抵扣</Text>
                <Text className="order-detail-row-value discount">-¥{pointsDeduct.toFixed(2)}</Text>
              </View>
            ) : null}
            <View className="order-detail-row">
              <Text className="order-detail-row-label">实付金额</Text>
              <Text className="order-detail-row-value strong">¥{payAmount.toFixed(2)}</Text>
            </View>
          </View>

          <View className="order-detail-card">
            <Text className="order-detail-section-title">收货信息</Text>
            <Text className="order-detail-address">{order.shippingAddress || "暂无收货地址"}</Text>
            {order.remarks ? (
              <>
                <Text className="order-detail-section-title" style={{ marginTop: "16rpx" }}>
                  订单备注
                </Text>
                <Text className="order-detail-remark">{order.remarks}</Text>
              </>
            ) : null}
          </View>

          {order.status === "shipped" || order.status === "completed" ? (
            <View className="order-detail-card">
              <View className="order-detail-logistics-head">
                <Text className="order-detail-section-title">物流进度</Text>
                <View className="order-detail-refresh" onClick={() => loadLogistics(order.id)}>
                  {refreshingLogistics ? "刷新中..." : "刷新物流"}
                </View>
              </View>

              {logistics.length === 0 ? (
                <View className="order-detail-logistics-empty">暂未同步到物流轨迹，请稍后刷新</View>
              ) : (
                <View className="order-detail-logistics-list">
                  {logistics.map((event, index) => (
                    <View key={`${event.time}_${index}`} className="order-detail-logistics-item">
                      <Text className="order-detail-logistics-title">{event.title}</Text>
                      <Text className="order-detail-logistics-meta">{event.detail}</Text>
                      <Text className="order-detail-logistics-meta">{formatDate(event.time)}</Text>
                      {event.location ? <Text className="order-detail-logistics-meta">地点：{event.location}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {order.status === "pending_payment" ? (
        <View className="order-detail-footer">
          <View className="order-detail-btn light" onClick={handleCancel}>
            取消订单
          </View>
          <View className="order-detail-btn dark" onClick={handlePay}>
            立即支付
          </View>
        </View>
      ) : null}

      {order.status === "shipped" ? (
        <View className="order-detail-footer">
          <View className="order-detail-btn light" onClick={() => loadLogistics(order.id)}>
            刷新物流
          </View>
          <View className="order-detail-btn dark" onClick={handleConfirmReceipt}>
            确认收货
          </View>
        </View>
      ) : null}
    </View>
  );
}

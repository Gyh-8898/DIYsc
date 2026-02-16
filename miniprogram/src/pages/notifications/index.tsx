import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { NotificationItem, api } from "../../services/api";
import "./index.scss";

function formatTime(ts: number) {
  const date = new Date(ts);
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export default function NotificationsPage() {
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = async () => {
    if (!api.auth.isLoggedIn()) {
      setList([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const data = await api.notifications.list({ limit: 50, offset: 0 });
      setList(data.list || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "消息加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadData();
  });

  const handleRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    try {
      await api.notifications.read(item.id);
      await loadData();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "操作失败", icon: "none" });
    }
  };

  const handleReadAll = async () => {
    if (unreadCount <= 0) return;
    try {
      await api.notifications.readAll();
      await loadData();
      Taro.showToast({ title: "已全部标记已读", icon: "success" });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "操作失败", icon: "none" });
    }
  };

  const handleJump = async (item: NotificationItem) => {
    if (!item.readAt) {
      await handleRead(item);
    }
    if (item.orderId) {
      Taro.navigateTo({ url: `/pages/order/detail?id=${encodeURIComponent(item.orderId)}` });
      return;
    }
    if (item.complaintId) {
      Taro.navigateTo({ url: "/pages/complaint/index" });
    }
  };

  return (
    <View className="notifications-page">
      <View className="notifications-header">
        <Text className="notifications-unread">未读 {unreadCount}</Text>
        <Text className="notifications-read-all" onClick={handleReadAll}>
          全部已读
        </Text>
      </View>

      <ScrollView scrollY className="notifications-list">
        {list.length === 0 ? (
          <View className="notifications-empty">{loading ? "加载中..." : "暂无消息"}</View>
        ) : (
          list.map((item) => (
            <View key={item.id} className={`notification-card ${item.readAt ? "" : "unread"}`}>
              <View className="notification-title-row">
                <Text className="notification-title">{item.title || "消息通知"}</Text>
                <Text className="notification-time">{formatTime(item.createdAt)}</Text>
              </View>
              <View className="notification-content">{item.content || ""}</View>
              <View className="notification-actions">
                {!item.readAt ? (
                  <View className="notification-btn" onClick={() => handleRead(item)}>
                    标记已读
                  </View>
                ) : null}
                {(item.orderId || item.complaintId) ? (
                  <View className="notification-btn primary" onClick={() => handleJump(item)}>
                    查看详情
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api, PointHistoryItem } from "../../services/api";
import "./index.scss";

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function PointsPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PointHistoryItem[]>([]);

  const load = async () => {
    if (!api.auth.isLoggedIn()) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const list = await api.points.history();
      setRows(Array.isArray(list) ? list : []);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "积分加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    load();
  });

  return (
    <View className="points-page">
      <ScrollView scrollY className="points-scroll">
        <View className="points-body">
          <View className="points-card">
            <Text className="points-title">积分流水</Text>
            {rows.length === 0 ? (
              <View className="points-empty">{loading ? "加载中..." : "暂无积分流水"}</View>
            ) : (
              <View className="points-list">
                {rows.map((item) => (
                  <View key={item.id} className="points-item">
                    <View className="points-top">
                      <Text className="points-desc">{item.description || item.type}</Text>
                      <Text className={`points-amount ${item.amount >= 0 ? "plus" : "minus"}`}>
                        {item.amount >= 0 ? `+${item.amount}` : item.amount}
                      </Text>
                    </View>
                    <Text className="points-time">{formatDate(item.createdAt)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View className="points-footer">
        <View className="points-btn" onClick={() => Taro.navigateTo({ url: "/pages/promotion/index" })}>
          前往提现与推广中心
        </View>
      </View>
    </View>
  );
}


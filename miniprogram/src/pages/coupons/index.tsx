import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { api, CouponTemplate, UserCoupon } from "../../services/api";
import "./index.scss";

type TabKey = "mine" | "center";

function formatDate(ts: number) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderDiscount(item: CouponTemplate) {
  if (item.discountType === "percent") {
    return `${item.discountValue}折`;
  }
  return `¥${item.discountValue.toFixed(2)}`;
}

export default function CouponsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("mine");
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<UserCoupon[]>([]);
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [mineRows, templateRows] = await Promise.all([api.coupons.mine(), api.coupons.templates()]);
      setMine(Array.isArray(mineRows) ? mineRows : []);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "优惠券加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    load();
  });

  const claimedTemplateIds = useMemo(() => new Set(mine.map((item) => item.templateId)), [mine]);

  const claimCoupon = async (templateId: string) => {
    try {
      await api.coupons.claim(templateId);
      Taro.showToast({ title: "领取成功", icon: "success" });
      load();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "领取失败", icon: "none" });
    }
  };

  return (
    <View className="coupons-page">
      <View className="coupons-tabs">
        <View className={`coupons-tab ${activeTab === "mine" ? "active" : ""}`} onClick={() => setActiveTab("mine")}>
          我的优惠券
        </View>
        <View className={`coupons-tab ${activeTab === "center" ? "active" : ""}`} onClick={() => setActiveTab("center")}>
          领券中心
        </View>
      </View>

      <ScrollView scrollY className="coupons-scroll">
        {activeTab === "mine" ? (
          <View className="coupons-list">
            {mine.length === 0 ? (
              <View className="coupons-empty">{loading ? "加载中..." : "暂无可用优惠券"}</View>
            ) : (
              mine.map((item) => (
                <View key={item.id} className="coupon-card">
                  <View className="coupon-left">
                    <Text className="coupon-discount">{renderDiscount(item.template)}</Text>
                    <Text className="coupon-limit">满 ¥{item.template.minAmount.toFixed(2)} 可用</Text>
                  </View>
                  <View className="coupon-right">
                    <Text className="coupon-name">{item.template.name}</Text>
                    <Text className="coupon-desc">{item.template.description || "下单可抵扣"}</Text>
                    <Text className="coupon-time">
                      {formatDate(item.template.startAt)} - {formatDate(item.template.endAt)}
                    </Text>
                    <Text className={`coupon-status ${item.status}`}>{item.status}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="coupons-list">
            {templates.length === 0 ? (
              <View className="coupons-empty">{loading ? "加载中..." : "暂无可领取优惠券"}</View>
            ) : (
              templates.map((item) => {
                const claimed = claimedTemplateIds.has(item.id);
                return (
                  <View key={item.id} className="coupon-card">
                    <View className="coupon-left">
                      <Text className="coupon-discount">{renderDiscount(item)}</Text>
                      <Text className="coupon-limit">满 ¥{item.minAmount.toFixed(2)} 可用</Text>
                    </View>
                    <View className="coupon-right">
                      <Text className="coupon-name">{item.name}</Text>
                      <Text className="coupon-desc">{item.description || "下单可抵扣"}</Text>
                      <Text className="coupon-time">
                        {formatDate(item.startAt)} - {formatDate(item.endAt)}
                      </Text>
                      <View className={`coupon-claim-btn ${claimed ? "disabled" : ""}`} onClick={() => (claimed ? undefined : claimCoupon(item.id))}>
                        {claimed ? "已领取" : "立即领取"}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}


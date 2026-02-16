import { Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import "./result.scss";

export default function OrderResultPage() {
  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState<"success" | "fail">("success");

  useLoad((params) => {
    setOrderId(typeof params?.id === "string" ? params.id : "");
    setStatus(params?.status === "fail" ? "fail" : "success");
  });

  return (
    <View className="order-result-page">
      <View className="order-result-card">
        <Text className="order-result-title">{status === "success" ? "订单处理成功" : "订单处理失败"}</Text>
        <Text className="order-result-desc">
          {status === "success" ? "订单已创建，请在订单详情查看物流与状态。" : "请返回重试，或联系商家客服处理。"}
        </Text>
        {orderId ? <Text className="order-result-id">订单ID：{orderId}</Text> : null}
        <View
          className="order-result-btn"
          onClick={() => {
            if (orderId) {
              Taro.navigateTo({ url: `/pages/order/detail?id=${encodeURIComponent(orderId)}` });
            } else {
              Taro.navigateTo({ url: "/pages/orders/index" });
            }
          }}
        >
          查看订单
        </View>
      </View>
    </View>
  );
}


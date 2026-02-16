import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api } from "../../services/api";
import "./index.scss";

interface FaqItem {
  question: string;
  answer: string;
}

interface SupportConfig {
  wechat: string;
  phone: string;
  serviceHours: string;
  faq: FaqItem[];
}

const DEFAULT_SUPPORT: SupportConfig = {
  wechat: "",
  phone: "",
  serviceHours: "09:00-21:00",
  faq: [
    {
      question: "下单后多久发货？",
      answer: "通常1-3天内完成制作并发货，节假日可能顺延。"
    },
    {
      question: "可以修改订单地址吗？",
      answer: "未发货前可联系客服修改，已发货需签收后处理。"
    }
  ]
};

function normalizeSupport(raw: unknown): SupportConfig {
  const source = (raw || {}) as Record<string, unknown>;
  const faqRaw = Array.isArray(source.faq) ? source.faq : [];
  const faq = faqRaw
    .map((item) => {
      const row = (item || {}) as Record<string, unknown>;
      const question = String(row.question || "").trim();
      const answer = String(row.answer || "").trim();
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((item): item is FaqItem => Boolean(item));

  return {
    wechat: String(source.wechat || DEFAULT_SUPPORT.wechat),
    phone: String(source.phone || DEFAULT_SUPPORT.phone),
    serviceHours: String(source.serviceHours || DEFAULT_SUPPORT.serviceHours),
    faq: faq.length > 0 ? faq : DEFAULT_SUPPORT.faq
  };
}

export default function HelpPage() {
  const [support, setSupport] = useState<SupportConfig>(DEFAULT_SUPPORT);

  const loadConfig = async () => {
    try {
      const config = await api.config.get();
      setSupport(normalizeSupport((config as any)?.support));
    } catch (_error) {
      setSupport(DEFAULT_SUPPORT);
    }
  };

  useDidShow(() => {
    loadConfig();
  });

  const handleCopyWechat = async () => {
    if (!support.wechat) {
      Taro.showToast({ title: "商家暂未配置客服微信", icon: "none" });
      return;
    }
    await Taro.setClipboardData({ data: support.wechat });
    Taro.showToast({ title: "客服微信已复制", icon: "success" });
  };

  const handlePhoneCall = () => {
    if (!support.phone) {
      Taro.showToast({ title: "商家暂未配置客服电话", icon: "none" });
      return;
    }
    Taro.makePhoneCall({
      phoneNumber: support.phone,
      fail: () => {
        Taro.showToast({ title: "当前环境无法拨号", icon: "none" });
      }
    });
  };

  return (
    <View className="help-page">
      <ScrollView scrollY className="help-scroll">
        <View className="help-body">
          <View className="help-card">
            <Text className="help-title">客服支持</Text>
            <Text className="help-desc">服务时间：{support.serviceHours}。订单、物流、售后、投诉均可处理。</Text>
            <View className="help-action-group">
              <View className="help-action-btn primary" onClick={handleCopyWechat}>
                复制客服微信
              </View>
              <View className="help-action-btn" onClick={handlePhoneCall}>
                电话联系
              </View>
            </View>
          </View>

          <View className="help-card">
            <Text className="help-title">常见问题</Text>
            {support.faq.map((item) => (
              <View key={item.question} className="help-row">
                <Text className="help-row-title">{item.question}</Text>
                <Text className="help-row-text">{item.answer}</Text>
              </View>
            ))}
          </View>

          <View className="help-card">
            <Text className="help-title">协议与规则</Text>
            <View className="help-row" onClick={() => Taro.navigateTo({ url: "/pages/agreement/index?type=user" })}>
              <Text className="help-row-title">用户协议</Text>
              <Text className="help-row-text">查看平台使用条款与订单规则</Text>
            </View>
            <View className="help-row" onClick={() => Taro.navigateTo({ url: "/pages/agreement/index?type=privacy" })}>
              <Text className="help-row-title">隐私政策</Text>
              <Text className="help-row-text">查看隐私与数据使用说明</Text>
            </View>
            <View className="help-row" onClick={() => Taro.navigateTo({ url: "/pages/agreement/index?type=distribution" })}>
              <Text className="help-row-title">分销规则</Text>
              <Text className="help-row-text">查看佣金、积分、提现相关规则</Text>
            </View>
          </View>

          <View className="help-card">
            <Text className="help-title">进度追踪</Text>
            <Text className="help-desc">如已提交投诉/申诉，可前往工单页面查看处理状态与回复。</Text>
            <View className="help-action-group">
              <View className="help-action-btn primary" onClick={() => Taro.navigateTo({ url: "/pages/complaint/index" })}>
                前往投诉与申诉
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}


import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { api } from "../../services/api";
import "./index.scss";

type AgreementType = "user" | "privacy" | "distribution";

const TITLE_MAP: Record<AgreementType, string> = {
  user: "用户协议",
  privacy: "隐私政策",
  distribution: "分销规则"
};

const FALLBACK_TEXT: Record<AgreementType, string> = {
  user: "欢迎使用本小程序。您在使用过程中应遵守平台规范与相关法律法规。",
  privacy: "我们仅在提供订单与售后服务所必需的范围内收集和处理您的信息。",
  distribution: "分销收益、结算与提现规则以平台实时公告与后台配置为准。"
};

export default function AgreementPage() {
  const [type, setType] = useState<AgreementType>("user");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useLoad((params) => {
    const t = typeof params?.type === "string" ? params.type : "user";
    if (t === "privacy" || t === "distribution" || t === "user") {
      setType(t);
    } else {
      setType("user");
    }
  });

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: TITLE_MAP[type] });
  });

  useDidShow(() => {
    const load = async () => {
      setLoading(true);
      try {
        const cfg: any = await api.config.get();
        const agreements = cfg?.agreements || {};
        setContent(String(agreements?.[type] || FALLBACK_TEXT[type]));
      } catch (_error) {
        setContent(FALLBACK_TEXT[type]);
      } finally {
        setLoading(false);
      }
    };
    load();
  });

  const title = useMemo(() => TITLE_MAP[type], [type]);

  return (
    <View className="agreement-page">
      <ScrollView scrollY className="agreement-scroll">
        <View className="agreement-body">
          <View className="agreement-card">
            <Text className="agreement-title">{title}</Text>
            <Text className="agreement-content">{loading ? "加载中..." : content}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}


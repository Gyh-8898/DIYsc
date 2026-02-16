import { Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { ChevronRight, Hexagon, Info, Sparkle } from "../../components/Icons";
import { api } from "../../services/api";
import "./index.scss";

type DraftGate = {
  visible: boolean;
  targetType: "bazi" | "liuyao";
  draft: null | { id: string; type: "bazi" | "liuyao"; updatedAt: number };
};

function fmtTime(ts?: number) {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return "-";
  }
}

export default function CommunityPage() {
  const [gate, setGate] = useState<DraftGate>({ visible: false, targetType: "bazi", draft: null });

  const safeTop = useMemo(() => {
    try {
      const info = Taro.getSystemInfoSync();
      return Math.max(0, Number(info.statusBarHeight || 0));
    } catch {
      return 0;
    }
  }, []);

  const draftLabel = useMemo(() => {
    const t = gate.draft?.type;
    if (t === "bazi") return "八字灵感";
    if (t === "liuyao") return "六爻参考";
    return "-";
  }, [gate.draft?.type]);

  const ensureLogin = async () => {
    if (api.auth.isLoggedIn()) return true;
    const modal = await Taro.showModal({
      title: "请先登录",
      content: "登录后才能使用社区分析功能，是否现在登录？"
    });
    if (!modal.confirm) return false;
    try {
      await api.auth.login();
      return true;
    } catch {
      return false;
    }
  };

  const openStart = async (targetType: "bazi" | "liuyao") => {
    const ok = await ensureLogin();
    if (!ok) return;

    try {
      const latest = await api.community.drafts.latest();
      if (latest && latest.id) {
        setGate({
          visible: true,
          targetType,
          draft: { id: latest.id, type: latest.type, updatedAt: latest.updatedAt }
        });
        return;
      }
    } catch (_error) {
      // ignore, fall back to direct start
    }

    Taro.navigateTo({ url: `/pages/community/${targetType}/index` });
  };

  useDidShow(() => {
    // Ensure sessionId created early, so reports stay isolated per user/session.
    void api.community.getSessionId();
  });

  return (
    <View className="comm-home">
      <View className="comm-safe-top" style={{ height: `${safeTop}px` }} />

      <View className="comm-header">
        <Text className="comm-title">社区</Text>
        <Text className="comm-subtitle">AI智能命理分析</Text>
      </View>

      <View className="comm-notice">
        <View className="comm-notice-icon">
          <Info size={18} color="#e17100" />
        </View>
        <Text className="comm-notice-text">
          我们的AI命理分析系统基于传统命理学知识，结合现代AI技术，为您提供个性化的分析和建议。请理性看待分析结果，仅供参考。
        </Text>
      </View>

      <View className="comm-cards">
        <View className="comm-card" onClick={() => openStart("bazi")}>
          <View className="comm-card-top">
            <View className="comm-card-icon comm-card-icon--bazi">
              <Sparkle size={28} color="#ffffff" />
            </View>

            <View className="comm-card-main">
              <Text className="comm-card-title">八字分析</Text>
              <Text className="comm-card-desc">根据您的生辰八字，分析命理格局、五行喜忌、流年运势</Text>

              <View className="comm-tag-row">
                <View className="comm-tag tag-work">
                  <Text className="comm-tag-text">事业运</Text>
                </View>
                <View className="comm-tag tag-wealth">
                  <Text className="comm-tag-text">财运</Text>
                </View>
                <View className="comm-tag tag-love">
                  <Text className="comm-tag-text">感情运</Text>
                </View>
                <View className="comm-tag tag-health">
                  <Text className="comm-tag-text">健康运</Text>
                </View>
              </View>
            </View>

            <View className="comm-card-chevron">
              <ChevronRight size={18} color="#101828" />
            </View>
          </View>

          <View className="comm-card-divider" />

          <View className="comm-feature-row">
            <View className="comm-feature">
              <Text className="comm-feature-title">四柱</Text>
              <Text className="comm-feature-sub">详细排盘</Text>
            </View>
            <View className="comm-feature">
              <Text className="comm-feature-title">五行</Text>
              <Text className="comm-feature-sub">喜忌分析</Text>
            </View>
            <View className="comm-feature">
              <Text className="comm-feature-title">流年</Text>
              <Text className="comm-feature-sub">运势预测</Text>
            </View>
          </View>
        </View>

        <View className="comm-card" onClick={() => openStart("liuyao")}>
          <View className="comm-card-top">
            <View className="comm-card-icon comm-card-icon--liuyao">
              <Hexagon size={28} color="#ffffff" />
            </View>

            <View className="comm-card-main">
              <Text className="comm-card-title">六爻占卜</Text>
              <Text className="comm-card-desc">通过起卦解卦，预测事件发展趋势，指导决策方向</Text>

              <View className="comm-tag-row">
                <View className="comm-tag tag-job">
                  <Text className="comm-tag-text">求职创业</Text>
                </View>
                <View className="comm-tag tag-marriage">
                  <Text className="comm-tag-text">感情婚姻</Text>
                </View>
                <View className="comm-tag tag-invest">
                  <Text className="comm-tag-text">投资理财</Text>
                </View>
                <View className="comm-tag tag-peace">
                  <Text className="comm-tag-text">健康平安</Text>
                </View>
              </View>
            </View>

            <View className="comm-card-chevron">
              <ChevronRight size={18} color="#101828" />
            </View>
          </View>

          <View className="comm-card-divider" />

          <View className="comm-feature-row">
            <View className="comm-feature">
              <Text className="comm-feature-title">起卦</Text>
              <Text className="comm-feature-sub">智能推荐</Text>
            </View>
            <View className="comm-feature">
              <Text className="comm-feature-title">解卦</Text>
              <Text className="comm-feature-sub">详细分析</Text>
            </View>
            <View className="comm-feature">
              <Text className="comm-feature-title">指引</Text>
              <Text className="comm-feature-sub">决策建议</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="comm-stats">
        <View className="comm-stat">
          <Text className="comm-stat-num">12,580</Text>
          <Text className="comm-stat-label">分析次数</Text>
        </View>
        <View className="comm-stat">
          <Text className="comm-stat-num">98.5%</Text>
          <Text className="comm-stat-label">满意度</Text>
        </View>
        <View className="comm-stat">
          <Text className="comm-stat-num">24/7</Text>
          <Text className="comm-stat-label">在线服务</Text>
        </View>
      </View>

      {gate.visible ? (
        <View className="gate-overlay" onClick={() => setGate((prev) => ({ ...prev, visible: false }))}>
          <View className="gate-panel" onClick={(e) => e.stopPropagation()}>
            <View className="gate-title">发现上次未完成的分析</View>
            <View className="gate-sub">
              类型：{draftLabel}，更新时间：{fmtTime(gate.draft?.updatedAt)}
            </View>

            <View className="gate-actions">
              <View
                className="gate-btn primary"
                onClick={() => {
                  const nextType = gate.draft?.type || gate.targetType;
                  setGate((prev) => ({ ...prev, visible: false }));
                  Taro.navigateTo({ url: `/pages/community/${nextType}/index?continue=1` });
                }}
              >
                继续上次
              </View>
              <View
                className="gate-btn"
                onClick={() => {
                  setGate((prev) => ({ ...prev, visible: false }));
                  Taro.navigateTo({ url: `/pages/community/${gate.targetType}/index?new=1` });
                }}
              >
                新建分析
              </View>
              <View
                className="gate-btn"
                onClick={() => {
                  setGate((prev) => ({ ...prev, visible: false }));
                  Taro.navigateTo({ url: "/pages/community/archive/index" });
                }}
              >
                查看存档
              </View>
              <View className="gate-btn cancel" onClick={() => setGate((prev) => ({ ...prev, visible: false }))}>
                取消
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

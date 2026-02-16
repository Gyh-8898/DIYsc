import { Input, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { api, CommunityAnalysisResponse, CommunityAnalysisResult } from "../../../services/api";
import "../shared.scss";
import "./index.scss";

function typeLabel(t: string) {
  return t === "liuyao" ? "六爻参考" : "八字灵感";
}

function safeDateYmd(ts: number) {
  try {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

export default function CommunityResultPage() {
  const [traceId, setTraceId] = useState("");
  const [resp, setResp] = useState<CommunityAnalysisResponse | null>(null);
  const [input, setInput] = useState<Record<string, unknown> | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");

  useLoad((options) => {
    setTraceId(String(options?.traceId || ""));
  });

  useEffect(() => {
    const stored = Taro.getStorageSync("community_latest_result") as any;
    const r = stored?.response as CommunityAnalysisResponse | undefined;
    const inp = stored?.input as any;
    if (!r || !r.traceId) {
      Taro.showToast({ title: "未找到分析结果", icon: "none" });
      return;
    }
    if (traceId && r.traceId !== traceId) {
      // When traceId mismatches, still allow display but warn.
      Taro.showToast({ title: "结果已更新为最近一次", icon: "none" });
    }
    setResp(r);
    setInput(inp || null);

    const now = safeDateYmd(Date.now());
    const t = typeLabel(r.result?.type || "");
    setTitle(`${t}-${now}`);
  }, [traceId]);

  const result: CommunityAnalysisResult | null = resp?.result || null;

  const saveReport = async () => {
    if (!resp?.traceId) return;
    if (savedId) {
      Taro.showToast({ title: "已保存过", icon: "none" });
      return;
    }
    setSaving(true);
    try {
      const saved = await api.community.reports.save(resp.traceId, title.trim() || undefined);
      setSavedId(saved.id);
      Taro.showToast({ title: "已保存到存档", icon: "success" });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  };

  const goDesigner = async (tag: string) => {
    const safeTag = String(tag || "").trim();
    if (!safeTag) return;
    try {
      await api.community.events.track("community_tag_click", {
        tag: safeTag,
        traceId: resp?.traceId || ""
      } as any);
      await api.community.events.track("community_goto_designer", {
        tag: safeTag,
        traceId: resp?.traceId || ""
      } as any);
    } catch (_error) {
      // ignore
    }
    Taro.navigateTo({ url: `/pages/designer/index?communityTag=${encodeURIComponent(safeTag)}` });
  };

  const headerTitle = useMemo(() => typeLabel(result?.type || ""), [result?.type]);

  if (!result) {
    return (
      <View className="community-page">
        <View className="community-page-header">
          <View className="community-page-title">分析结果</View>
          <Text className="community-page-sub">加载中...</Text>
        </View>
        <View className="community-card">
          <Text className="empty">暂无数据，请返回重新分析</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="community-page has-floating-actions">
      <View className="community-page-header">
        <View className="community-page-title">{headerTitle}</View>
        <Text className="community-page-sub">结构化结果与珠子属性推荐</Text>
      </View>

      <View className="community-card">
        <View className="form-row">
          <Text className="label">报告标题（保存到存档用）</Text>
          <Input className="input" value={title} onInput={(e) => setTitle(e.detail.value)} placeholder="例如：八字灵感-2026-02-14" />
        </View>

        <View className="block highlight">
          <View className="block-title">结论</View>
          <Text className="block-text">{result.summary}</Text>
        </View>

        <View className="block">
          <View className="block-title">推荐标签</View>
          <View className="rec-list">
            {(result.recommendedTags || []).map((rt, idx) => (
              <View key={`${rt.tag}_${idx}`} className="rec-item">
                <View className="rec-top">
                  <View className="rec-tag">{rt.tag}</View>
                  <View className="rec-btn" onClick={() => goDesigner(rt.tag)}>去工作台筛选</View>
                </View>
                <Text className="rec-reason">{rt.reason}</Text>
              </View>
            ))}
            {(!result.recommendedTags || result.recommendedTags.length === 0) ? (
              <Text className="muted">暂无推荐标签</Text>
            ) : null}
          </View>
        </View>

        <View className="block">
          <View className="block-title">解读要点</View>
          <View className="insights">
            {(result.insights || []).map((it, idx) => (
              <View key={idx} className="insight">
                <View className="insight-title">{it.title}</View>
                <Text className="insight-text">{it.content}</Text>
              </View>
            ))}
            {(!result.insights || result.insights.length === 0) ? <Text className="muted">暂无要点</Text> : null}
          </View>
        </View>

        <View className="block">
          <View className="block-title">标签（原始）</View>
          <View className="pill-row">
            {(result.tags || []).map((t) => (
              <View key={t} className="pill" onClick={() => goDesigner(t)}>{t}</View>
            ))}
            {(!result.tags || result.tags.length === 0) ? <Text className="muted">无</Text> : null}
          </View>
          <Text className="tip">点击标签可直接跳转工作台并自动筛选相关珠子</Text>
        </View>

        <View className="block danger">
          <View className="block-title">免责声明</View>
          <Text className="block-text">{result.disclaimer || "仅供文化交流与娱乐参考，不构成任何承诺或保证。"}</Text>
        </View>
      </View>

      <View className="community-actions floating">
        <View className="btn outline" onClick={() => Taro.navigateTo({ url: "/pages/community/archive/index" })}>
          查看存档
        </View>
        <View className="btn primary" onClick={saveReport} style={{ opacity: saving ? 0.6 : 1 }}>
          {savedId ? "已保存" : "保存到存档"}
        </View>
      </View>
    </View>
  );
}

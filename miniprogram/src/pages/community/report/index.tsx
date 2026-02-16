import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { api, CommunityReportDetail } from "../../../services/api";
import "../shared.scss";
import "./index.scss";

function typeLabel(t: string) {
  return t === "liuyao" ? "六爻参考" : "八字灵感";
}

function fmtTime(ts?: number) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

export default function CommunityReportPage() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CommunityReportDetail | null>(null);

  useLoad((options) => {
    setId(String(options?.id || ""));
  });

  const ensureLogin = async () => {
    if (api.auth.isLoggedIn()) return true;
    const modal = await Taro.showModal({
      title: "请先登录",
      content: "登录后才能查看报告详情，是否现在登录？"
    });
    if (!modal.confirm) return false;
    try {
      await api.auth.login();
      return true;
    } catch {
      return false;
    }
  };

  const load = async (rid = id) => {
    if (!rid) return;
    const ok = await ensureLogin();
    if (!ok) return;

    setLoading(true);
    try {
      const data = await api.community.reports.get(rid);
      setReport(data);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载失败", icon: "none" });
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const goDesigner = async (tag: string) => {
    const safeTag = String(tag || "").trim();
    if (!safeTag) return;
    try {
      await api.community.events.track("community_tag_click", {
        tag: safeTag,
        reportId: report?.id || ""
      } as any);
      await api.community.events.track("community_goto_designer", {
        tag: safeTag,
        reportId: report?.id || ""
      } as any);
    } catch (_error) {
      // ignore
    }
    Taro.navigateTo({ url: `/pages/designer/index?communityTag=${encodeURIComponent(safeTag)}` });
  };

  const rerun = async () => {
    if (!report) return;
    setLoading(true);
    Taro.showLoading({ title: "重跑中..." });
    try {
      const input = report.input || {};
      const resp =
        report.type === "liuyao"
          ? await api.community.analysis.liuyao(input as any)
          : await api.community.analysis.bazi(input as any);
      Taro.setStorageSync("community_latest_result", {
        response: resp,
        input,
        createdAt: Date.now()
      });
      Taro.hideLoading();
      Taro.navigateTo({ url: `/pages/community/result/index?traceId=${encodeURIComponent(resp.traceId)}&type=${encodeURIComponent(resp.result.type)}` });
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || "重跑失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!report) return;
    const modal = await Taro.showModal({
      title: "确认删除",
      content: "删除后可在后台审计日志中追溯，但用户侧将不可见。是否继续？"
    });
    if (!modal.confirm) return;
    setLoading(true);
    try {
      await api.community.reports.delete(report.id);
      Taro.showToast({ title: "已删除", icon: "success" });
      setTimeout(() => {
        Taro.navigateBack();
      }, 300);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "删除失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  const output = report?.output as any;
  const summary = String(output?.summary || "");
  const recommendedTags: Array<{ tag: string; reason: string }> = Array.isArray(output?.recommendedTags) ? output.recommendedTags : [];
  const insights: Array<{ title: string; content: string }> = Array.isArray(output?.insights) ? output.insights : [];
  const tags: string[] = Array.isArray(report?.tags) ? report!.tags : [];

  const subtitle = useMemo(() => (report ? `${typeLabel(report.type)} · ${fmtTime(report.createdAt)}` : ""), [report]);

  if (!report) {
    return (
      <View className="community-page">
        <View className="community-page-header">
          <View className="community-page-title">报告详情</View>
          <Text className="community-page-sub">{loading ? "加载中..." : "暂无数据"}</Text>
        </View>
        <View className="community-card">
          <Text className="empty">{loading ? "加载中..." : "报告不存在或已删除"}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="community-page community-page-full">
      <View className="community-page-header">
        <View className="community-page-title">{report.title || "未命名报告"}</View>
        <Text className="community-page-sub">{subtitle}</Text>
      </View>

      <ScrollView scrollY className="report-scroll">
        <View className="community-card">
          <View className="meta">
            <Text className="meta-item">供应商：{report.provider || "-"}</Text>
            <Text className="meta-item">模型：{report.modelId || "-"}</Text>
            <Text className="meta-item">版本：{report.version || "-"}</Text>
          </View>

          <View className="block highlight">
            <View className="block-title">结论</View>
            <Text className="block-text">{summary || "无"}</Text>
          </View>

          <View className="block">
            <View className="block-title">推荐标签</View>
            <View className="rec-list">
              {recommendedTags.map((rt, idx) => (
                <View key={`${rt.tag}_${idx}`} className="rec-item">
                  <View className="rec-top">
                    <View className="rec-tag">{rt.tag}</View>
                    <View className="rec-btn" onClick={() => goDesigner(rt.tag)}>去工作台筛选</View>
                  </View>
                  <Text className="rec-reason">{rt.reason}</Text>
                </View>
              ))}
              {recommendedTags.length === 0 ? <Text className="muted">无</Text> : null}
            </View>
          </View>

          <View className="block">
            <View className="block-title">解读要点</View>
            <View className="insights">
              {insights.map((it, idx) => (
                <View key={idx} className="insight">
                  <View className="insight-title">{it.title}</View>
                  <Text className="insight-text">{it.content}</Text>
                </View>
              ))}
              {insights.length === 0 ? <Text className="muted">无</Text> : null}
            </View>
          </View>

          <View className="block">
            <View className="block-title">标签</View>
            <View className="pill-row">
              {tags.map((t) => (
                <View key={t} className="pill" onClick={() => goDesigner(t)}>{t}</View>
              ))}
              {tags.length === 0 ? <Text className="muted">无</Text> : null}
            </View>
          </View>

          <View className="block danger">
            <View className="block-title">免责声明</View>
            <Text className="block-text">{output?.disclaimer || "仅供文化交流与娱乐参考，不构成任何承诺或保证。"}</Text>
          </View>
        </View>

        <View className="community-actions">
          <View className="btn outline" onClick={remove} style={{ opacity: loading ? 0.6 : 1 }}>删除</View>
          <View className="btn primary" onClick={rerun} style={{ opacity: loading ? 0.6 : 1 }}>重跑</View>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

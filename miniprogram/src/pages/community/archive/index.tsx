import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { api, CommunityReportListItem } from "../../../services/api";
import "../shared.scss";
import "./index.scss";

type Tab = "all" | "bazi" | "liuyao";

function typeLabel(t: string) {
  return t === "liuyao" ? "六爻" : "八字";
}

function fmtTime(ts?: number) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

export default function CommunityArchivePage() {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<CommunityReportListItem[]>([]);

  const ensureLogin = async () => {
    if (api.auth.isLoggedIn()) return true;
    const modal = await Taro.showModal({
      title: "请先登录",
      content: "登录后才能查看存档，是否现在登录？"
    });
    if (!modal.confirm) return false;
    try {
      await api.auth.login();
      return true;
    } catch {
      return false;
    }
  };

  const load = async () => {
    const ok = await ensureLogin();
    if (!ok) return;
    setLoading(true);
    try {
      const list = await api.community.reports.list();
      setRows(Array.isArray(list) ? list : []);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载失败", icon: "none" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    load();
  });

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.type === tab);
  }, [rows, tab]);

  return (
    <View className="community-page community-page-full">
      <View className="community-page-header">
        <View className="community-page-title">我的存档</View>
        <Text className="community-page-sub">可查看、删除、重跑历史报告</Text>
      </View>

      <View className="archive-tabs">
        {[
          { key: "all" as const, label: "全部" },
          { key: "bazi" as const, label: "八字" },
          { key: "liuyao" as const, label: "六爻" }
        ].map((t) => (
          <View key={t.key} className={`archive-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </View>
        ))}
      </View>

      <ScrollView scrollY className="archive-list">
        {filtered.map((r) => (
          <View key={r.id} className="archive-item" onClick={() => Taro.navigateTo({ url: `/pages/community/report/index?id=${encodeURIComponent(r.id)}` })}>
            <View className="archive-top">
              <View className="archive-title">{r.title || "未命名报告"}</View>
              <View className={`archive-badge ${r.type}`}>{typeLabel(r.type)}</View>
            </View>
            <Text className="archive-time">{fmtTime(r.createdAt)}</Text>
            <View className="archive-tags">
              {(r.tags || []).slice(0, 8).map((t) => (
                <View key={t} className="archive-tag">{t}</View>
              ))}
              {(r.tags || []).length === 0 ? <Text className="archive-empty-tag">无标签</Text> : null}
            </View>
          </View>
        ))}

        {filtered.length === 0 ? (
          <View className="archive-empty">
            <Text className="archive-empty-text">{loading ? "加载中..." : "暂无存档，先去社区分析生成报告吧"}</Text>
          </View>
        ) : null}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

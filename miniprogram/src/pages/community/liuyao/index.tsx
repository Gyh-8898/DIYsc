import { Input, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { Gem, X } from "../../../components/Icons";
import { api, CommunityDraft } from "../../../services/api";
import "./index.scss";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeDraftPayload(draft: CommunityDraft | null, type: "liuyao") {
  if (!draft || draft.type !== type) return null;
  return draft.payload || {};
}

function safeSystemInfo() {
  try {
    return Taro.getSystemInfoSync();
  } catch {
    return null;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtHm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtMonthDay(ymd: string) {
  const parts = String(ymd || "").split("-");
  if (parts.length < 3) return "";
  const mm = Number(parts[1] || 0);
  const dd = Number(parts[2] || 0);
  if (!mm || !dd) return "";
  return `${mm}月${dd}日`;
}

function normalizeCoinChar(raw: string) {
  const s = toStr(raw);
  const upper = s.toUpperCase();
  if (s === "正" || upper === "H") return "正";
  if (s === "反" || upper === "T") return "反";
  return "";
}

export default function CommunityLiuyaoPage() {
  const [loading, setLoading] = useState(false);
  const [continueMode, setContinueMode] = useState(false);

  const [question, setQuestion] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [coinGrid, setCoinGrid] = useState<string[][]>(() =>
    Array.from({ length: 6 }, () => Array.from({ length: 3 }, () => ""))
  );

  const sys = useMemo(() => safeSystemInfo(), []);
  const safeTop = Math.max(0, Number(sys?.statusBarHeight || 0));
  const windowHeight = Math.max(0, Number(sys?.windowHeight || 0));
  const spacerHeight = safeTop + 40;
  const bodyHeight = Math.max(360, windowHeight ? windowHeight - spacerHeight - 61 - 90 : 560);

  useLoad((options) => {
    setContinueMode(String(options?.continue || "") === "1");
  });

  useEffect(() => {
    if (continueMode) return;
    if (date || time) return;
    const now = new Date();
    setDate(fmtYmd(now));
    setTime(fmtHm(now));
  }, [continueMode, date, time]);

  const datetime = useMemo(() => {
    const d = toStr(date);
    const t = toStr(time);
    if (d && t) return `${d} ${t}`;
    return d || t || "";
  }, [date, time]);

  const coinsTouched = useMemo(() => {
    return coinGrid.some((row) => row.some((v) => toStr(v)));
  }, [coinGrid]);

  const coinsNormalized = useMemo(() => {
    return coinGrid.map((row) => row.map((v) => (normalizeCoinChar(v) === "反" ? "反" : "正")).join(""));
  }, [coinGrid]);

  const payload = useMemo(() => {
    const base: Record<string, unknown> = {
      question: toStr(question),
      datetime: toStr(datetime)
    };
    if (coinsTouched) {
      base.coins = coinsNormalized;
    }
    return base;
  }, [coinsNormalized, coinsTouched, datetime, question]);

  const close = () => {
    const pages = Taro.getCurrentPages();
    if (pages && pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: "/pages/community/index" });
  };

  const toggleCoin = (rowIdx: number, colIdx: number) => {
    setCoinGrid((prev) =>
      prev.map((row, r) => {
        if (r !== rowIdx) return row;
        return row.map((v, c) => {
          if (c !== colIdx) return v;
          const cur = normalizeCoinChar(v);
          if (!cur) return "反"; // default display is 正; first click flips to 反
          return cur === "反" ? "正" : "反";
        });
      })
    );
  };

  const updateNow = () => {
    const now = new Date();
    setDate(fmtYmd(now));
    setTime(fmtHm(now));
  };

  const loadDraftIfNeeded = async () => {
    if (!continueMode) return;
    setLoading(true);
    try {
      const draft = await api.community.drafts.latest().catch(() => null);
      const p = safeDraftPayload(draft, "liuyao");
      if (!p) {
        Taro.showToast({ title: "没有可继续的草稿", icon: "none" });
        return;
      }

      setQuestion(toStr((p as any).question || ""));
      const dt = toStr((p as any).datetime || "");
      if (dt.includes(" ")) {
        const [d, t] = dt.split(" ");
        setDate(toStr(d));
        setTime(toStr(t));
      } else {
        setDate(dt);
      }

      const arr = Array.isArray((p as any).coins) ? (p as any).coins : [];
      const nextGrid = Array.from({ length: 6 }, (_, ri) => {
        const s = toStr(arr[ri] || "");
        const chars = s.split("");
        return Array.from({ length: 3 }, (_, ci) => normalizeCoinChar(chars[ci] || ""));
      });
      setCoinGrid(nextGrid);

      Taro.showToast({ title: "已载入草稿", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDraftIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueMode]);

  const saveDraft = async () => {
    setLoading(true);
    try {
      await api.community.drafts.save("liuyao", payload as any);
      Taro.showToast({ title: "草稿已保存", icon: "success" });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "保存失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!toStr((payload as any).question)) {
      Taro.showToast({ title: "请输入要问的问题", icon: "none" });
      return;
    }

    setLoading(true);
    Taro.showLoading({ title: "分析中..." });
    try {
      const resp = await api.community.analysis.liuyao(payload as any);
      Taro.setStorageSync("community_latest_result", {
        response: resp,
        input: payload,
        createdAt: Date.now()
      });
      Taro.hideLoading();
      Taro.navigateTo({ url: `/pages/community/result/index?traceId=${encodeURIComponent(resp.traceId)}&type=liuyao` });
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || "分析失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  const displayDatetime = useMemo(() => {
    const md = fmtMonthDay(toStr(date));
    const hm = toStr(time);
    if (md && hm) return `${md} ${hm}`;
    if (md) return md;
    if (hm) return hm;
    return "";
  }, [date, time]);

  return (
    <View className="comm-modal" onClick={close}>
      <View className="comm-modal-spacer" style={{ height: `${spacerHeight}px` }} />

      <View className="comm-sheet" onClick={(e) => e.stopPropagation()}>
        <View className="comm-sheet-header">
          <Text className="comm-sheet-title">六爻占卜</Text>

          <View className="comm-sheet-header-right">
            <Text className="comm-sheet-save" onClick={saveDraft} style={{ opacity: loading ? 0.6 : 1 }}>
              保存
            </Text>
            <View className="comm-sheet-close" onClick={close}>
              <X size={18} color="#101828" />
            </View>
          </View>
        </View>

        <ScrollView className="comm-sheet-body" scrollY style={{ height: `${bodyHeight}px` }} showScrollbar={false}>
          <View className="comm-brief">
            <View className="comm-brief-icon">
              <Gem size={18} color="#7c3aed" />
            </View>
            <View className="comm-brief-main">
              <Text className="comm-brief-title">什么是六爻？</Text>
              <Text className="comm-brief-desc">
                六爻是中国古代占卜方法，通过投掷硬币六次，形成六个爻(yáo)，构成一个卦象，用以预测吉凶。
              </Text>
            </View>
          </View>

          <View className="comm-field">
            <Text className="comm-label">您想问什么？</Text>
            <Input
              className="comm-input"
              placeholder="例如：近期工作会有调动吗？"
              value={question}
              onInput={(e) => setQuestion(e.detail.value)}
            />
          </View>

          <View className="comm-field">
            <Text className="comm-label">投掷时间</Text>
            <View className="comm-time-bar">
              <Text className={`comm-time-value ${displayDatetime ? "" : "placeholder"}`}>
                {displayDatetime || "未设置"}
              </Text>
              <View className="comm-time-btn" onClick={updateNow}>
                更新时间
              </View>
            </View>
          </View>

          <View className="comm-field">
            <Text className="comm-label">投掷硬币（点击切换正反面）</Text>
            <View className="comm-coin-rows">
              {coinGrid.map((row, ri) => (
                <View key={ri} className="comm-coin-row">
                  <Text className="comm-coin-row-label">{`第${ri + 1}次`}</Text>
                  <View className="comm-coin-row-grid">
                    {row.map((v, ci) => {
                      const cur = normalizeCoinChar(v);
                      const isYin = cur === "反";
                      return (
                        <View
                          key={ci}
                          className={`comm-coin-btn ${isYin ? "yin" : ""}`}
                          onClick={() => toggleCoin(ri, ci)}
                        >
                          <Text className="comm-coin-btn-text">{isYin ? "反" : "正"}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View className="comm-sheet-footer">
          <View className="comm-primary-btn" onClick={runAnalysis} style={{ opacity: loading ? 0.6 : 1 }}>
            开始占卜
          </View>
        </View>
      </View>
    </View>
  );
}

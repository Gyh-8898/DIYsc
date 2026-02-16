import { Input, Picker, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { X } from "../../../components/Icons";
import { api, CommunityDraft } from "../../../services/api";
import "./index.scss";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeDraftPayload(draft: CommunityDraft | null, type: "bazi") {
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

export default function CommunityBaziPage() {
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [question, setQuestion] = useState("");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [continueMode, setContinueMode] = useState(false);

  const sys = useMemo(() => safeSystemInfo(), []);
  const safeTop = Math.max(0, Number(sys?.statusBarHeight || 0));
  const windowHeight = Math.max(0, Number(sys?.windowHeight || 0));
  const spacerHeight = safeTop + 40;
  const bodyHeight = Math.max(320, windowHeight ? windowHeight - spacerHeight - 61 - 90 : 520);

  useLoad((options) => {
    setContinueMode(String(options?.continue || "") === "1");
  });

  const payload = useMemo(() => {
    return {
      name: toStr(name),
      gender,
      birthDate: toStr(birthDate),
      birthTime: toStr(birthTime),
      birthCity: toStr(birthCity),
      question: toStr(question)
    };
  }, [birthCity, birthDate, birthTime, gender, name, question]);

  const ymd = useMemo(() => {
    const raw = toStr(birthDate);
    if (!raw || !raw.includes("-")) return { y: "", m: "", d: "" };
    const [y, m, d] = raw.split("-");
    return { y: toStr(y), m: toStr(m), d: toStr(d) };
  }, [birthDate]);

  const close = () => {
    const pages = Taro.getCurrentPages();
    if (pages && pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: "/pages/community/index" });
  };

  const loadDraftIfNeeded = async () => {
    if (!continueMode) return;
    setLoading(true);
    try {
      const draft = await api.community.drafts.latest().catch(() => null);
      const p = safeDraftPayload(draft, "bazi");
      if (!p) {
        Taro.showToast({ title: "没有可继续的草稿", icon: "none" });
        return;
      }

      setName(toStr((p as any).name || ""));
      setGender((p as any).gender === "female" ? "female" : "male");
      setBirthDate(toStr((p as any).birthDate || ""));
      setBirthTime(toStr((p as any).birthTime || ""));
      setBirthCity(toStr((p as any).birthCity || ""));
      setQuestion(toStr((p as any).question || ""));
      setCalendar((p as any).calendar === "lunar" ? "lunar" : "solar");

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
    if (!payload.birthDate) {
      Taro.showToast({ title: "请选择出生日期", icon: "none" });
      return;
    }
    setLoading(true);
    try {
      await api.community.drafts.save("bazi", { ...payload, calendar } as any);
      Taro.showToast({ title: "草稿已保存", icon: "success" });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "保存失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!payload.birthDate) {
      Taro.showToast({ title: "请选择出生日期", icon: "none" });
      return;
    }

    setLoading(true);
    Taro.showLoading({ title: "分析中..." });
    try {
      const resp = await api.community.analysis.bazi(payload as any);
      Taro.setStorageSync("community_latest_result", {
        response: resp,
        input: payload,
        createdAt: Date.now()
      });
      Taro.hideLoading();
      Taro.navigateTo({ url: `/pages/community/result/index?traceId=${encodeURIComponent(resp.traceId)}&type=bazi` });
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || "分析失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="comm-modal" onClick={close}>
      <View className="comm-modal-spacer" style={{ height: `${spacerHeight}px` }} />

      <View className="comm-sheet" onClick={(e) => e.stopPropagation()}>
        <View className="comm-sheet-header">
          <Text className="comm-sheet-title">八字分析</Text>

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
          <View className="comm-field">
            <Text className="comm-label">您想要分析什么？</Text>
            <Input
              className="comm-input"
              placeholder="例如：2026年财运怎么样？"
              value={question}
              onInput={(e) => setQuestion(e.detail.value)}
            />
          </View>

          <View className="comm-field">
            <Text className="comm-label">姓名</Text>
            <Input
              className="comm-input"
              placeholder="请输入您的姓名"
              value={name}
              onInput={(e) => setName(e.detail.value)}
            />
          </View>

          <View className="comm-field">
            <Text className="comm-label">性别</Text>
            <View className="comm-seg">
              <View className={`comm-seg-btn ${gender === "male" ? "active" : ""}`} onClick={() => setGender("male")}>
                男
              </View>
              <View
                className={`comm-seg-btn ${gender === "female" ? "active" : ""}`}
                onClick={() => setGender("female")}
              >
                女
              </View>
            </View>
          </View>

          <View className="comm-field">
            <Text className="comm-label">历法</Text>
            <View className="comm-seg">
              <View
                className={`comm-seg-btn ${calendar === "solar" ? "active" : ""}`}
                onClick={() => setCalendar("solar")}
              >
                公历
              </View>
              <View
                className={`comm-seg-btn ${calendar === "lunar" ? "active" : ""}`}
                onClick={() => setCalendar("lunar")}
              >
                农历
              </View>
            </View>
          </View>

          <View className="comm-field">
            <Text className="comm-label">出生日期</Text>
            <Picker mode="date" value={birthDate} onChange={(e) => setBirthDate(e.detail.value)}>
              <View className="comm-date-row">
                <View className={`comm-date-box ${ymd.y ? "" : "placeholder"}`}>{ymd.y || "年"}</View>
                <View className={`comm-date-box ${ymd.m ? "" : "placeholder"}`}>{ymd.m || "月"}</View>
                <View className={`comm-date-box ${ymd.d ? "" : "placeholder"}`}>{ymd.d || "日"}</View>
              </View>
            </Picker>
          </View>

          <View className="comm-field">
            <Text className="comm-label">出生时辰</Text>
            <Picker mode="time" value={birthTime} onChange={(e) => setBirthTime(e.detail.value)}>
              <View className={`comm-input comm-picker ${birthTime ? "" : "placeholder"}`}>
                {birthTime || "请选择出生时辰"}
              </View>
            </Picker>
          </View>

          <View className="comm-field">
            <Text className="comm-label">出生城市（可选）</Text>
            <Input
              className="comm-input"
              placeholder="例如：上海"
              value={birthCity}
              onInput={(e) => setBirthCity(e.detail.value)}
            />
          </View>

          <View className="comm-tip">
            <Text className="comm-tip-text">
              温馨提示：我们的AI命理分析基于传统命理学理论。请准确填写您的出生信息，这将影响八字分析的准确性。公历日期即身份证上的出生日期。
            </Text>
          </View>
        </ScrollView>

        <View className="comm-sheet-footer">
          <View className="comm-primary-btn" onClick={runAnalysis} style={{ opacity: loading ? 0.6 : 1 }}>
            开始分析
          </View>
        </View>
      </View>
    </View>
  );
}

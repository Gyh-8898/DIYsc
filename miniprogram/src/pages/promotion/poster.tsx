import { Canvas, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import "./poster.scss";

export default function PromotionPosterPage() {
  const [code, setCode] = useState("");

  useLoad((params) => {
    setCode(typeof params?.code === "string" ? params.code : "");
  });

  const drawPoster = () => {
    const ctx = Taro.createCanvasContext("promoPoster");
    ctx.setFillStyle("#111827");
    ctx.fillRect(0, 0, 600, 960);

    ctx.setFillStyle("#ffffff");
    ctx.setFontSize(44);
    ctx.fillText("晶奥之境", 56, 120);

    ctx.setFontSize(26);
    ctx.fillText("手串定制 · 广场同款 · 积分返利", 56, 168);

    ctx.setFillStyle("#10b981");
    ctx.fillRect(56, 240, 488, 2);

    ctx.setFillStyle("#f3f4f6");
    ctx.setFontSize(34);
    ctx.fillText("我的邀请码", 56, 320);
    ctx.setFillStyle("#ffffff");
    ctx.setFontSize(56);
    ctx.fillText(code || "未设置", 56, 400);

    ctx.setFillStyle("#9ca3af");
    ctx.setFontSize(24);
    ctx.fillText("长按识别小程序码立即下单", 56, 470);
    ctx.fillText("来自你的好友邀请", 56, 520);

    ctx.setStrokeStyle("#ffffff");
    ctx.strokeRect(380, 640, 160, 160);
    ctx.setFillStyle("#d1d5db");
    ctx.setFontSize(20);
    ctx.fillText("小程序码", 420, 730);

    ctx.draw();
  };

  useDidShow(() => {
    drawPoster();
  });

  const savePoster = () => {
    Taro.canvasToTempFilePath({
      canvasId: "promoPoster",
      success: async (res) => {
        try {
          await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath });
          Taro.showToast({ title: "已保存到相册", icon: "success" });
        } catch (_error) {
          Taro.showToast({ title: "保存失败，请检查相册权限", icon: "none" });
        }
      },
      fail: () => {
        Taro.showToast({ title: "海报生成失败", icon: "none" });
      }
    });
  };

  return (
    <View className="poster-page">
      <View className="poster-wrap">
        <Canvas canvasId="promoPoster" className="poster-canvas" />
      </View>
      <Text className="poster-hint">邀请码：{code || "未设置"}</Text>
      <View className="poster-save-btn" onClick={savePoster}>
        保存海报
      </View>
    </View>
  );
}


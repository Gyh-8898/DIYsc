import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useLoad, useShareAppMessage } from "@tarojs/taro";
import { useState } from "react";
import { Design } from "../../constants";
import { api } from "../../services/api";
import "./detail.scss";

interface GroupedBead {
  key: string;
  name: string;
  sizeMm: number;
  color: string;
  count: number;
  price: number;
}

function formatDate(ts: number) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function groupBeads(design: Design): GroupedBead[] {
  const list = Array.isArray(design.beads) ? design.beads : [];
  const map = new Map<string, GroupedBead>();

  for (const bead of list) {
    const key = `${bead.name}_${bead.sizeMm}_${bead.price}_${bead.color}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    map.set(key, {
      key,
      name: bead.name || "珠子",
      sizeMm: Number(bead.sizeMm || 0),
      color: bead.color || "#b4bbc5",
      count: 1,
      price: Number(bead.price || 0)
    });
  }

  return [...map.values()];
}

function getPreviewLayout(beads: Array<any>) {
  const total = Math.max(beads.length, 1);
  const maxSizeMm = beads.reduce((max, bead) => Math.max(max, Number(bead?.sizeMm || 8)), 8);
  const beadDiameter = Math.max(20, Math.min(46, maxSizeMm * 2.8));
  const radiusByCount = (total * beadDiameter * 1.08) / (2 * Math.PI);
  const radius = Math.max(72, Math.min(116, radiusByCount));

  return {
    center: 150,
    beadDiameter,
    radius
  };
}

export default function PortfolioDetailPage() {
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);

  const buildSharePath = (id: string) => `/pages/portfolio/detail?id=${encodeURIComponent(id || "")}`;

  useShareAppMessage(() => {
    if (!design) {
      return {
        title: "DIY 手串设计",
        path: "/pages/index/index"
      };
    }
    return {
      title: design.name || "我的手串设计",
      path: buildSharePath(design.id),
      imageUrl: design.imageUrl || ""
    };
  });

  useLoad(async (params) => {
    const designId = typeof params?.id === "string" ? params.id : "";
    if (!designId) {
      Taro.showToast({ title: "缺少作品ID", icon: "none" });
      setLoading(false);
      return;
    }

    try {
      const detail = await api.designs.get(designId);
      setDesign(detail);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  });

  const handleEdit = () => {
    if (!design) return;
    Taro.setStorageSync("temp_design_copy", design);
    Taro.navigateTo({ url: "/pages/designer/index" });
  };

  const handlePublish = async () => {
    if (!design) return;
    try {
      await api.designs.publish(design.id);
      Taro.showToast({ title: "已发布到广场", icon: "success" });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "发布失败", icon: "none" });
    }
  };

  const handleShare = async () => {
    if (!design) return;
    try {
      const res = await Taro.showActionSheet({
        itemList: ["发布到广场", "复制作品链接", "分享给微信好友"]
      });

      if (res.tapIndex === 0) {
        await handlePublish();
        return;
      }

      if (res.tapIndex === 1) {
        await Taro.setClipboardData({ data: buildSharePath(design.id) });
        Taro.showToast({ title: "作品路径已复制", icon: "success" });
        return;
      }

      try {
        await (Taro as any).showShareMenu({
          withShareTicket: true,
          menus: ["shareAppMessage", "shareTimeline"]
        });
      } catch (_error) {
        // ignore
      }
      Taro.showToast({ title: "请点击右上角进行转发", icon: "none" });
    } catch (_error) {
      // user cancelled
    }
  };

  const handleDelete = async () => {
    if (!design) return;
    const confirm = await Taro.showModal({
      title: "确认删除",
      content: "删除后无法恢复，是否继续？",
      confirmColor: "#ef4444"
    });
    if (!confirm.confirm) return;

    try {
      await api.designs.delete(design.id);
      Taro.showToast({ title: "已删除", icon: "success" });
      setTimeout(() => {
        Taro.navigateBack();
      }, 500);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "删除失败", icon: "none" });
    }
  };

  if (loading || !design) {
    return <View className="portfolio-detail-loading">加载中...</View>;
  }

  const beads = Array.isArray(design.beads) ? design.beads : [];
  const grouped = groupBeads(design);
  const beadCount = Math.max(beads.length, 1);
  const layout = getPreviewLayout(beads);
  const totalWeight = beads.reduce((sum, bead) => sum + Math.pow(Number(bead.sizeMm || 0), 3) * 0.0015, 0);

  return (
    <View className="portfolio-detail-page">
      <ScrollView scrollY className="portfolio-detail-scroll">
        <View className="portfolio-detail-body">
          <View className="portfolio-detail-card">
            <View className="portfolio-detail-preview">
              <View className="portfolio-detail-preview-canvas">
                {beads.map((bead, index) => {
                  const angle = (index * 360) / beadCount;
                  const x = layout.center + layout.radius * Math.cos(((angle - 90) * Math.PI) / 180);
                  const y = layout.center + layout.radius * Math.sin(((angle - 90) * Math.PI) / 180);

                  return (
                    <View
                      key={`${design.id}_${index}`}
                      className="portfolio-detail-bead"
                      style={{
                        background: bead.color || "#b4bbc5",
                        width: `${layout.beadDiameter}rpx`,
                        height: `${layout.beadDiameter}rpx`,
                        left: `${x}rpx`,
                        top: `${y}rpx`,
                        transform: "translate(-50%, -50%)"
                      }}
                    />
                  );
                })}
              </View>
            </View>
            <Text className="portfolio-detail-title">{design.name || "未命名作品"}</Text>
            <Text className="portfolio-detail-subtitle">创建时间：{formatDate(design.createdAt)}</Text>
          </View>

          <View className="portfolio-detail-card">
            <View className="portfolio-detail-metrics-grid">
              <View className="portfolio-detail-metric">
                <Text className="portfolio-detail-metric-label">手围</Text>
                <Text className="portfolio-detail-metric-value">{design.wristSize}cm</Text>
              </View>
              <View className="portfolio-detail-metric">
                <Text className="portfolio-detail-metric-label">珠子数量</Text>
                <Text className="portfolio-detail-metric-value">{beads.length}颗</Text>
              </View>
              <View className="portfolio-detail-metric">
                <Text className="portfolio-detail-metric-label">预估重量</Text>
                <Text className="portfolio-detail-metric-value">{totalWeight.toFixed(1)}g</Text>
              </View>
              <View className="portfolio-detail-metric">
                <Text className="portfolio-detail-metric-label">价格</Text>
                <Text className="portfolio-detail-metric-value">¥{design.totalPrice.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View className="portfolio-detail-card">
            <Text className="portfolio-detail-section-title">材质明细</Text>
            <View className="portfolio-detail-bead-list">
              {grouped.map((item) => (
                <View key={item.key} className="portfolio-detail-bead-row">
                  <View className="portfolio-detail-bead-left">
                    <View className="portfolio-detail-bead-dot" style={{ background: item.color }} />
                    <Text className="portfolio-detail-bead-name">
                      {item.name} · {item.sizeMm}mm
                    </Text>
                  </View>
                  <Text className="portfolio-detail-bead-right">
                    x{item.count} · ¥{item.price.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="portfolio-detail-footer">
        <View className="portfolio-detail-btn dark" onClick={handleEdit}>
          编辑
        </View>
        <View className="portfolio-detail-btn light" onClick={handleShare}>
          分享
        </View>
        <View className="portfolio-detail-btn light" onClick={handleDelete}>
          删除
        </View>
      </View>
    </View>
  );
}

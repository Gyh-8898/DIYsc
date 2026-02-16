import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useShareAppMessage } from "@tarojs/taro";
import { useState } from "react";
import { Design } from "../../constants";
import { Edit, Share2, Trash2 } from "../../components/Icons";
import { api } from "../../services/api";
import "./index.scss";

function formatDate(ts: number) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function safeBeads(design: Design) {
  return Array.isArray(design.beads) ? design.beads : [];
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

export default function PortfolioPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharingDesign, setSharingDesign] = useState<Design | null>(null);
  const [referralCode, setReferralCode] = useState("");

  const buildSharePath = (design: Design) => {
    const base = `/pages/portfolio/detail?id=${encodeURIComponent(design.id || "")}`;
    if (!referralCode) return base;
    return `${base}&ref=${encodeURIComponent(referralCode)}`;
  };

  useShareAppMessage(() => {
    const design = sharingDesign || designs[0];
    if (!design) {
      return {
        title: "DIY 手串设计",
        path: "/pages/index/index"
      };
    }
    return {
      title: design.name || "我的手串设计",
      path: buildSharePath(design),
      imageUrl: design.imageUrl || ""
    };
  });

  const loadDesigns = async () => {
    if (!api.auth.isLoggedIn()) {
      setDesigns([]);
      setReferralCode("");
      return;
    }

    setLoading(true);
    try {
      const [rows, currentUser] = await Promise.all([api.designs.list(), api.auth.getCurrentUser()]);
      setDesigns(Array.isArray(rows) ? rows : []);
      setReferralCode(String(currentUser?.referralCode || ""));
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载失败", icon: "none" });
      setDesigns([]);
      setReferralCode("");
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadDesigns();
  });

  const handleGoDesign = () => {
    Taro.navigateTo({ url: "/pages/designer/index" });
  };

  const handleOpenDetail = (designId: string) => {
    Taro.navigateTo({ url: `/pages/portfolio/detail?id=${encodeURIComponent(designId)}` });
  };

  const handleEdit = (design: Design) => {
    Taro.setStorageSync("temp_design_copy", design);
    Taro.navigateTo({ url: "/pages/designer/index" });
  };

  const handleDelete = async (id: string) => {
    const confirm = await Taro.showModal({
      title: "确认删除",
      content: "删除后无法恢复，确定继续吗？",
      confirmColor: "#ef4444"
    });

    if (!confirm.confirm) {
      return;
    }

    try {
      await api.designs.delete(id);
      Taro.showToast({ title: "已删除", icon: "success" });
      loadDesigns();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "删除失败", icon: "none" });
    }
  };

  const handlePublish = async (id: string) => {
    await api.designs.publish(id);
  };

  const handleShare = async (design: Design) => {
    try {
      const res = await Taro.showActionSheet({
        itemList: ["发布到广场", "复制作品链接", "分享给微信好友"]
      });

      if (res.tapIndex === 0) {
        try {
          await handlePublish(design.id);
          Taro.showToast({ title: "已发布到广场", icon: "success" });
        } catch (error: any) {
          Taro.showToast({ title: error?.message || "发布失败", icon: "none" });
        }
        return;
      }

      if (res.tapIndex === 1) {
        await Taro.setClipboardData({ data: buildSharePath(design) });
        Taro.showToast({ title: "作品路径已复制", icon: "success" });
        return;
      }

      setSharingDesign(design);
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

  if (!api.auth.isLoggedIn()) {
    return (
      <View className="portfolio-page">
        <View className="portfolio-empty">
          <View className="portfolio-empty-card">
            <Text className="portfolio-empty-title">登录后查看作品集</Text>
            <Text className="portfolio-empty-desc">保存你的作品，随时编辑与分享</Text>
            <View className="portfolio-empty-btn" onClick={() => Taro.navigateBack()}>
              返回个人中心登录
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!loading && designs.length === 0) {
    return (
      <View className="portfolio-page">
        <View className="portfolio-empty">
          <View className="portfolio-empty-card">
            <Text className="portfolio-empty-title">你还没有保存作品</Text>
            <Text className="portfolio-empty-desc">去工作台设计你的第一条手串</Text>
            <View className="portfolio-empty-btn" onClick={handleGoDesign}>
              去设计
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="portfolio-page">
      <ScrollView scrollY className="portfolio-scroll">
        <View className="portfolio-list">
          {designs.map((design) => {
            const beads = safeBeads(design);
            const beadCount = Math.max(beads.length, 1);
            const layout = getPreviewLayout(beads);
            return (
              <View key={design.id} className="portfolio-card" onClick={() => handleOpenDetail(design.id)}>
                <View className="portfolio-preview">
                  <View className="portfolio-preview-canvas">
                    {beads.map((bead, index) => {
                      const angle = (index * 360) / beadCount;
                      const x = layout.center + layout.radius * Math.cos(((angle - 90) * Math.PI) / 180);
                      const y = layout.center + layout.radius * Math.sin(((angle - 90) * Math.PI) / 180);

                      return (
                        <View
                          key={`${design.id}_${index}`}
                          className="portfolio-bead"
                          style={{
                            background: bead.color || "#b0b7c3",
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

                <View className="portfolio-info">
                  <Text className="portfolio-name">{design.name || "未命名作品"}</Text>
                  <Text className="portfolio-meta">
                    {formatDate(design.createdAt)} · {beads.length}颗珠子 · ¥{design.totalPrice.toFixed(2)}
                  </Text>
                </View>

                <View className="portfolio-actions">
                  <View
                    className="portfolio-action-btn dark"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEdit(design);
                    }}
                  >
                    <Edit size={14} color="#ffffff" />
                    <Text>编辑</Text>
                  </View>
                  <View
                    className="portfolio-action-btn light"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShare(design);
                    }}
                  >
                    <Share2 size={14} color="#374151" />
                    <Text>分享</Text>
                  </View>
                  <View
                    className="portfolio-action-btn light"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(design.id);
                    }}
                  >
                    <Trash2 size={14} color="#374151" />
                    <Text>删除</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

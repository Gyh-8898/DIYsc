import { View, Image, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { Gem, CircleDashed, HelpCircle, ChevronRight, ArrowRight } from "../../components/Icons";
import localImageFallback from "../../assets/tab-home-active.png";
import "./index.scss";

interface BeadPreview {
  id?: string;
  color?: string;
  price?: number;
}

interface DesignCard {
  id: string;
  name: string;
  beads: BeadPreview[];
  totalPrice: number;
  createdAt: number;
  imageUrl?: string;
}

interface Banner {
  id: number;
  imageUrl: string;
  title?: string;
  subtitle?: string;
}

interface SafeImageProps {
  src?: string;
  className?: string;
  style?: Record<string, string | number>;
  mode?:
    | "scaleToFill"
    | "aspectFit"
    | "aspectFill"
    | "widthFix"
    | "heightFix"
    | "top"
    | "bottom"
    | "center"
    | "left"
    | "right"
    | "top left"
    | "top right"
    | "bottom left"
    | "bottom right";
}

function SafeImage({ src, className, style, mode = "aspectFill" }: SafeImageProps) {
  const [safeSrc, setSafeSrc] = useState<string>(src || localImageFallback);

  useEffect(() => {
    setSafeSrc(src || localImageFallback);
  }, [src]);

  return (
    <Image
      src={safeSrc}
      className={className}
      style={style}
      mode={mode}
      onError={() => {
        if (safeSrc !== localImageFallback) {
          setSafeSrc(localImageFallback);
        }
      }}
    />
  );
}

function parseBeads(raw: any): BeadPreview[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeDesigns(rows: any[]): DesignCard[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, idx) => ({
    id: String(row?.id ?? `D-${idx}`),
    name: String(row?.name ?? "未命名作品"),
    beads: parseBeads(row?.beads ?? row?.beadsData),
    totalPrice: Number(row?.totalPrice ?? 0),
    createdAt: Number(row?.createdAt ?? Date.now()),
    imageUrl: typeof row?.imageUrl === "string" ? row.imageUrl : undefined
  }));
}

export default function IndexPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userDesigns, setUserDesigns] = useState<DesignCard[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  const config = {
    appUI: {
      homeBanner: {
        title: "定制你的专属",
        subtitle: "每一颗珠子都承载着美好的祝愿"
      }
    }
  };

  const loadData = async () => {
    try {
      const res = await api.banners.list();
      setBanners(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("加载首页数据失败", err);
      setBanners([]);
    }
  };

  const loadUser = async () => {
    if (!api.auth.isLoggedIn()) {
      setUser(null);
      setUserDesigns([]);
      return;
    }
    try {
      const currentUser = await api.auth.getCurrentUser();
      setUser(currentUser);

      const allDesigns = await api.designs.list();
      setUserDesigns(normalizeDesigns(allDesigns as any[]));
    } catch (err) {
      console.error("加载用户信息失败", err);
      setUser(null);
      setUserDesigns([]);
    }
  };

  useEffect(() => {
    loadData();
    loadUser();
  }, []);

  useDidShow(() => {
    loadUser();
  });

  const onOpenWorkbench = () => {
    Taro.navigateTo({ url: "/pages/designer/index" });
  };

  const onNavigateToPlaza = () => {
    Taro.switchTab({ url: "/pages/plaza/index" });
  };

  const onNavigateToProfile = () => {
    Taro.switchTab({ url: "/pages/profile/index" });
  };

  const onOpenPortfolioDetail = (d: DesignCard) => {
    Taro.navigateTo({ url: `/pages/designer/index?designId=${d.id}&readonly=true` });
  };

  const bannerImg = banners[0]?.imageUrl || localImageFallback;
  const bannerTitle = config.appUI.homeBanner.title;
  const bannerSubtitle = config.appUI.homeBanner.subtitle;
  const isGuest = !user;

  return (
    <View className="home-container">
      <View className="banner-wrapper">
        <SafeImage src={bannerImg} className="banner-image" mode="aspectFill" />
        <View className="banner-overlay">
          <View>
            <View className="banner-title">{bannerTitle}</View>
            <View className="banner-subtitle">{bannerSubtitle}</View>
          </View>
        </View>
      </View>

      <View className="tools-grid">
        <View className="tool-card" onClick={onOpenWorkbench}>
          <View className="icon-wrapper">
            <CircleDashed size={24} />
            <View className="icon-dot" />
          </View>
          <View className="tool-text">
            <View className="tool-title">设计</View>
            <View className="tool-desc">定制你的专属手串</View>
          </View>
        </View>

        <View className="tool-card" onClick={onNavigateToPlaza}>
          <View className="tool-icon-alt">
            <Gem size={24} />
          </View>
          <View className="tool-text">
            <View className="tool-title">推荐</View>
            <View className="tool-desc">寻找灵感与精选搭配</View>
          </View>
        </View>
      </View>

      <View className="guide-entry" onClick={() => setShowGuide(true)}>
        <View className="guide-left">
          <View className="guide-icon">
            <HelpCircle size={20} />
          </View>
          <View>
            <View className="guide-title">手围估算助手</View>
            <View className="guide-desc">不知道手围？点我查看对照表</View>
          </View>
        </View>
        <ChevronRight size={16} color="#d1d5db" />
      </View>

      <View className="portfolio-section">
        <View className="section-header">
          <View className="section-title">我的作品集</View>
          {!isGuest && userDesigns.length > 0 && (
            <View className="view-all" onClick={onNavigateToProfile}>
              查看全部 <ArrowRight size={12} />
            </View>
          )}
        </View>

        {isGuest || userDesigns.length === 0 ? (
          <View className="empty-state">
            <View className="empty-icon">
              <Image
                src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' fill='none'%3E%3Ccircle cx='50' cy='50' r='35' stroke='%23f0f0f0' stroke-width='2' stroke-dasharray='6 6'/%3E%3Cpath d='M50 15C50 15 60 25 60 35C60 45 40 45 40 35C40 25 50 15 50 15Z' fill='%23333'/%3E%3Cpath d='M85 50C85 50 75 60 65 60C55 60 55 40 65 40C75 40 85 50 85 50Z' fill='%23d4bba3'/%3E%3Cpath d='M50 85C50 85 40 75 40 65C40 55 60 55 60 65C60 75 50 85 50 85Z' fill='%23333'/%3E%3Cpath d='M15 50C15 50 25 40 35 40C45 40 45 60 35 60C25 60 15 50 15 50Z' fill='%23e5e5e5'/%3E%3C/svg%3E"
                style={{ width: 100, height: 100 }}
              />
            </View>
            <View className="empty-title">Gem Oratopia</View>
            <View className="empty-desc">开始制作您的第一个手串吧</View>
            <View className="start-btn" onClick={onOpenWorkbench}>
              立即开始
            </View>
          </View>
        ) : (
          <View className="designs-grid">
            {userDesigns.slice(0, 4).map((d) => {
              const beads = Array.isArray(d.beads) ? d.beads : [];
              return (
                <View key={d.id} className="design-card" onClick={() => onOpenPortfolioDetail(d)}>
                  <View className="design-preview">
                    <View className="preview-container">
                      {beads.map((b, i) => {
                        const total = Math.max(beads.length, 1);
                        const angle = (i * 360) / total;
                        const radius = 35;
                        const x = 50 + radius * Math.cos(((angle - 90) * Math.PI) / 180);
                        const y = 50 + radius * Math.sin(((angle - 90) * Math.PI) / 180);
                        return (
                          <View
                            key={`${d.id}-${i}`}
                            className="bead-absolute"
                            style={{
                              backgroundColor: b?.color || "#bbb",
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: "translate(-50%, -50%)"
                            }}
                          />
                        );
                      })}
                      {beads.length === 0 && d.imageUrl && (
                        <SafeImage src={d.imageUrl} style={{ width: "100%", height: "100%" }} mode="aspectFill" />
                      )}
                    </View>
                  </View>
                  <View className="design-info">
                    <View className="design-name">{d.name || "未命名作品"}</View>
                    <View className="design-meta">
                      <Text className="design-date">{new Date(d.createdAt).toLocaleDateString()}</Text>
                      <Text className="design-price">¥{d.totalPrice.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showGuide && (
        <View
          className="guide-modal"
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={() => setShowGuide(false)}
        >
          <View
            style={{ background: "#fff", padding: "24px", borderRadius: "12px", minWidth: "220px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <View>手围测量指南（示意）</View>
            <View style={{ marginTop: "18px" }} onClick={() => setShowGuide(false)}>
              关闭
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

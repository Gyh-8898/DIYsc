import { Image, Input, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api } from "../../services/api";
import { ArrowLeft, Heart, Search, Share2 } from "../../components/Icons";
import "./index.scss";

interface PlazaDesign {
  id: string;
  name: string;
  imageUrl?: string;
  plazaCategoryId?: string;
  likes: number;
  totalPrice: number;
  author: string;
  authorAvatar: string;
  description?: string;
  beads?: any[];
}

export default function PlazaPage() {
  const [designs, setDesigns] = useState<PlazaDesign[]>([]);
  const [detailDesign, setDetailDesign] = useState<PlazaDesign | null>(null);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"hot" | "new">("hot");
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

  const loadDesigns = async (params?: { query?: string }) => {
    setLoading(true);
    try {
      const rows = await api.plaza.list({
        q: params?.query ?? searchText,
        sort: activeTab === "hot" ? "hot" : "new"
      } as any);
      setDesigns((rows || []) as any[]);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "广场加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadDesigns();
  });

  const handleSearch = () => {
    loadDesigns({ query: searchText.trim() });
  };

  const handleUseDesign = (d: PlazaDesign) => {
    const maybeBeads = (d as any)?.beads;
    if (Array.isArray(maybeBeads) && maybeBeads.length > 0) {
      Taro.setStorageSync("temp_design_copy", d);
    } else {
      Taro.removeStorageSync("temp_design_copy");
    }
    Taro.navigateTo({ url: "/pages/designer/index" });
  };

  const toggleLike = async (design: PlazaDesign) => {
    if (!api.auth.isLoggedIn()) {
      const modal = await Taro.showModal({
        title: "请先登录",
        content: "登录后才能点赞作品，是否现在登录？"
      });
      if (!modal.confirm) return;
      try {
        await api.auth.login();
      } catch (_error) {
        return;
      }
    }

    const isLiked = Boolean(likedIds[design.id]);
    try {
      const result = await api.plaza.like(design.id, isLiked ? "unlike" : "like");
      setLikedIds((prev) => ({ ...prev, [design.id]: result.liked }));
      setDesigns((prev) =>
        prev.map((item) => (item.id === design.id ? { ...item, likes: Number(result.likes || item.likes) } : item))
      );
      if (detailDesign && detailDesign.id === design.id) {
        setDetailDesign({ ...detailDesign, likes: Number(result.likes || detailDesign.likes) });
      }
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "点赞失败", icon: "none" });
    }
  };

  if (detailDesign) {
    return (
      <View className="detail-overlay">
        <View className="detail-image-area">
          {detailDesign.imageUrl ? (
            <Image src={detailDesign.imageUrl} className="detail-image" mode="aspectFill" />
          ) : (
            <View className="detail-bead-fallback">
              {Array.isArray(detailDesign.beads) && detailDesign.beads.length > 0 ? (
                (() => {
                  const beads = detailDesign.beads!;
                  const total = beads.length;
                  const canvasSize = 280;
                  const center = canvasSize / 2;
                  const maxSizeMm = beads.reduce((max, b: any) => Math.max(max, Number(b.sizeMm || 8)), 8);
                  const beadDiameter = Math.max(18, Math.min(40, maxSizeMm * 2.5));
                  const radiusByCount = (total * beadDiameter * 1.08) / (2 * Math.PI);
                  const radius = Math.max(60, Math.min(120, radiusByCount));
                  return (
                    <View style={{ width: `${canvasSize}px`, height: `${canvasSize}px`, position: 'relative' }}>
                      {beads.map((b: any, i: number) => {
                        const angle = -Math.PI / 2 + (2 * Math.PI * i) / total;
                        const x = center + radius * Math.cos(angle) - beadDiameter / 2;
                        const y = center + radius * Math.sin(angle) - beadDiameter / 2;
                        return (
                          <View
                            key={i}
                            style={{
                              position: 'absolute',
                              left: `${x}px`, top: `${y}px`,
                              width: `${beadDiameter}px`, height: `${beadDiameter}px`,
                              borderRadius: '50%',
                              background: b.color || '#ccc',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                          />
                        );
                      })}
                    </View>
                  );
                })()
              ) : (
                <Text style={{ color: '#999', fontSize: '14px' }}>暂无预览</Text>
              )}
            </View>
          )}
          <View className="nav-btn nav-back" onClick={() => setDetailDesign(null)}>
            <ArrowLeft size={18} />
          </View>
          <View className="nav-btn nav-share">
            <Share2 size={18} />
          </View>
        </View>

        <View className="detail-content">
          <View className="detail-header">
            <View>
              <View className="detail-title">{detailDesign.name}</View>
            </View>
            <View className="detail-price">¥{detailDesign.totalPrice}</View>
          </View>

          <Text className="detail-desc">
            {detailDesign.description || "精选广场设计，可直接一键复用到工作台继续编辑。"}
          </Text>

          <View className="detail-actions">
            <View className="action-btn" onClick={() => handleUseDesign(detailDesign)}>
              使用此款设计
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="plaza-container">
      <View className="plaza-header">
        <View className="header-title">手串广场</View>

        <View className="search-row">
          <View className="search-bar">
            <View className="search-icon">
              <Search size={16} color="#999" />
            </View>
            <Input
              className="search-input"
              placeholder="输入作品编号或关键词搜索"
              placeholderClass="placeholder-text"
              value={searchText}
              onInput={(e) => setSearchText(e.detail.value)}
              confirmType="search"
              onConfirm={handleSearch}
            />
            <View className="search-btn" onClick={handleSearch}>
              搜索
            </View>
          </View>

          <View className="filter-btn" onClick={() => loadDesigns({ query: searchText.trim() })}>
            <View className="filter-icon">
              <View className="line-1"></View>
              <View className="line-2"></View>
              <View className="line-3"></View>
            </View>
            <Text>{activeTab === "hot" ? "热度" : "最新"}</Text>
          </View>
        </View>

        <View className="tabs-container">
          <View className="tabs-wrapper">
            <View
              className={`tab-item ${activeTab === "hot" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("hot");
                setTimeout(() => loadDesigns({ query: searchText.trim() }), 0);
              }}
            >
              最热
            </View>
            <View
              className={`tab-item ${activeTab === "new" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("new");
                setTimeout(() => loadDesigns({ query: searchText.trim() }), 0);
              }}
            >
              最新
            </View>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="plaza-content">
        <View className="plaza-grid">
          {designs.map((d) => (
            <View key={d.id} className="plaza-card" onClick={() => setDetailDesign(d)}>
              <View className="card-image-wrapper">
                {d.imageUrl ? (
                  <Image src={d.imageUrl} className="card-image" mode="aspectFill" lazyLoad />
                ) : Array.isArray(d.beads) && d.beads.length > 0 ? (
                  <View className="card-bead-fallback">
                    {(() => {
                      const beads = d.beads!;
                      const total = beads.length;
                      const size = 120;
                      const c = size / 2;
                      const bd = Math.max(8, Math.min(18, 8 * 1.8));
                      const r = Math.max(30, Math.min(50, (total * bd * 1.08) / (2 * Math.PI)));
                      return beads.map((b: any, i: number) => {
                        const a = -Math.PI / 2 + (2 * Math.PI * i) / total;
                        return (
                          <View key={i} style={{
                            position: 'absolute',
                            left: `${c + r * Math.cos(a) - bd / 2}px`,
                            top: `${c + r * Math.sin(a) - bd / 2}px`,
                            width: `${bd}px`, height: `${bd}px`,
                            borderRadius: '50%',
                            background: b.color || '#ccc',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.18)'
                          }} />
                        );
                      });
                    })()}
                  </View>
                ) : null}
                <View
                  className="likes-overlay"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(d);
                  }}
                >
                  <Heart size={10} color="#fff" fill={likedIds[d.id] ? "#fff" : "transparent"} />
                  <Text className="likes-text">{d.likes}</Text>
                </View>
              </View>

              <View className="card-info">
                <View className="card-id">{d.id || "N/A"}</View>
                <View className="card-author-row">
                  <View className="author-avatar-sm">
                    {d.authorAvatar ? <Image src={d.authorAvatar} className="avatar-img" /> : null}
                  </View>
                  <Text className="author-name-sm">{d.author}</Text>
                </View>
              </View>
            </View>
          ))}
          {designs.length === 0 && (
            <View className="empty-tip">{loading ? "加载中..." : "暂无匹配作品，换个关键词试试"}</View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}


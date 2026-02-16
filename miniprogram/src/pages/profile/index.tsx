import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { ChevronRight, Gift, HelpCircle, MapPin, MessageSquare, Settings, ShoppingBag, Gem } from "../../components/Icons";
import { api, User } from "../../services/api";
import "./index.scss";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  const loadUser = async () => {
    if (!api.auth.isLoggedIn()) {
      setUser(null);
      return;
    }
    try {
      const u = await api.auth.getCurrentUser();
      setUser(u);
    } catch (_error) {
      setUser(null);
    }
  };

  useDidShow(() => {
    loadUser();
  });

  const requireLogin = async (): Promise<boolean> => {
    if (api.auth.isLoggedIn()) return true;
    try {
      await api.auth.login();
      await loadUser();
      return true;
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "登录失败", icon: "none" });
      return false;
    }
  };

  const handleNavigate = async (url: string, needLogin = true) => {
    if (needLogin) {
      const ok = await requireLogin();
      if (!ok) return;
    }
    Taro.navigateTo({ url });
  };

  const handleLogin = async () => {
    if (user) return;
    await requireLogin();
  };

  const displayName = user ? user.nickname : "点击登录";
  const displayLevel = user ? user.levelName : "未登录";

  const displayAvatar = user && user.avatarUrl ? (
    <Image src={user.avatarUrl} className="avatar-img" mode="aspectFill" />
  ) : (
    <View className="user-avatar-placeholder">?</View>
  );

  return (
    <View className="profile-container">
      <View className="profile-header">
        <View className="user-card" onClick={handleLogin}>
          <View className="user-info">
            <View className="user-avatar">{displayAvatar}</View>
            <View className="user-text">
              <Text className="user-name">{displayName}</Text>
              <Text className="user-level">★ {displayLevel}</Text>
            </View>
          </View>
          {user ? (
            <View
              className="btn-edit"
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate("/pages/profile/edit/index");
              }}
            >
              <Text>编辑资料</Text> <ChevronRight size={12} color="rgba(255,255,255,0.8)" />
            </View>
          ) : null}
        </View>

        <View className="stats-card">
          <Text className="stats-title">我的积分</Text>
          <View className="stats-value-row">
            <Text className="stats-value">{user?.points || 0}</Text>
            <Text className="stats-unit">分</Text>
          </View>
          <View className="stats-actions">
            <View className="stats-btn" onClick={() => handleNavigate("/pages/points/index")}>
              积分明细
            </View>
            <View className="stats-btn" onClick={() => handleNavigate("/pages/promotion/index")}>
              积分提现
            </View>
          </View>
        </View>
      </View>

      <View className="menu-list">
        <View className="menu-group">
          <View className="menu-item" onClick={() => handleNavigate("/pages/promotion/index")}>
            <View className="menu-left">
              <Gift size={20} className="icon-gift" />
              <Text className="menu-label">推广有礼</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="menu-item" onClick={() => handleNavigate("/pages/portfolio/index")}>
            <View className="menu-left">
              <Gem size={20} color="#111827" />
              <Text className="menu-label">我的作品集</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="menu-item" onClick={() => handleNavigate("/pages/orders/index")}>
            <View className="menu-left">
              <ShoppingBag size={20} className="icon-bag" />
              <Text className="menu-label">我的订单</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </View>

        <View className="menu-group">
          <View className="menu-item" onClick={() => handleNavigate("/pages/address/index")}>
            <View className="menu-left">
              <MapPin size={20} className="icon-pin" />
              <Text className="menu-label">我的地址</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="menu-item" onClick={() => handleNavigate("/pages/notifications/index")}>
            <View className="menu-left">
              <MessageSquare size={20} className="icon-msg" />
              <Text className="menu-label">消息通知</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="menu-item" onClick={() => handleNavigate("/pages/coupons/index")}>
            <View className="menu-left">
              <Gift size={20} className="icon-gift" />
              <Text className="menu-label">我的优惠券</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="menu-item" onClick={() => handleNavigate("/pages/complaint/index")}>
            <View className="menu-left">
              <MessageSquare size={20} className="icon-msg" />
              <Text className="menu-label">投诉与申诉</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="menu-item" onClick={() => Taro.navigateTo({ url: "/pages/help/index" })}>
            <View className="menu-left">
              <HelpCircle size={20} className="icon-help" />
              <Text className="menu-label">帮助与客服</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </View>

        <View className="menu-group">
          <View className="menu-item" onClick={() => Taro.navigateTo({ url: "/pages/agreement/index?type=user" })}>
            <View className="menu-left">
              <Settings size={20} color="#4b5563" />
              <Text className="menu-label">服务协议</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View
            className="menu-item"
            onClick={() => {
              Taro.showModal({
                title: "商家后台管理",
                content: "请在电脑浏览器打开后台 H5 进行运营管理。"
              });
            }}
          >
            <View className="menu-left">
              <Settings size={20} color="#4b5563" />
              <Text className="menu-label">商家后台管理</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </View>
      </View>
    </View>
  );
}

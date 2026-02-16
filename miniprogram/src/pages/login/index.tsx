import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { api } from "../../services/api";
import "./index.scss";

export default function LoginPage() {
  const handleLogin = async () => {
    try {
      await api.auth.login();
      Taro.showToast({ title: "登录成功", icon: "success" });
      setTimeout(() => {
        Taro.navigateBack();
      }, 500);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "登录失败", icon: "none" });
    }
  };

  return (
    <View className="login-page">
      <View className="login-card">
        <Text className="login-title">欢迎来到晶奥之境</Text>
        <Text className="login-desc">登录后可保存作品、下单购买、查看订单与积分。</Text>
        <View className="login-btn" onClick={handleLogin}>
          微信登录
        </View>
      </View>
    </View>
  );
}


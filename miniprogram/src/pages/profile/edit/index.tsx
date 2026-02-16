import { Input, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api } from "../../../services/api";
import "./index.scss";

export default function ProfileEditPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const user = await api.auth.getCurrentUser();
      setName(user.nickname || "");
      setPhone(user.phone || "");
      setAvatar(user.avatarUrl || "");
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "资料加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    load();
  });

  const save = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: "昵称不能为空", icon: "none" });
      return;
    }

    setSaving(true);
    try {
      await api.user.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        avatar: avatar.trim()
      });
      Taro.showToast({ title: "保存成功", icon: "success" });
      setTimeout(() => {
        Taro.navigateBack();
      }, 600);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="profile-edit-page">
      <View className="profile-edit-card">
        <Text className="profile-edit-title">编辑资料</Text>
        <View className="profile-edit-group">
          <Text className="profile-edit-label">昵称</Text>
          <Input className="profile-edit-input" value={name} onInput={(e) => setName(e.detail.value)} placeholder="请输入昵称" />
        </View>
        <View className="profile-edit-group">
          <Text className="profile-edit-label">手机号</Text>
          <Input
            className="profile-edit-input"
            type="number"
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
            placeholder="请输入手机号"
          />
        </View>
        <View className="profile-edit-group">
          <Text className="profile-edit-label">头像地址</Text>
          <Input
            className="profile-edit-input"
            value={avatar}
            onInput={(e) => setAvatar(e.detail.value)}
            placeholder="请输入头像 URL"
          />
        </View>
        <View className="profile-edit-hint">如需上传头像，可先上传到图床后粘贴 URL。</View>
      </View>

      <View className="profile-edit-footer">
        <View className={`profile-edit-btn ${loading || saving ? "disabled" : ""}`} onClick={loading || saving ? undefined : save}>
          {saving ? "保存中..." : "保存资料"}
        </View>
      </View>
    </View>
  );
}


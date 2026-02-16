import { Input, Switch, Text, Textarea, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { Edit } from "../../components/Icons";
import { api, Address } from "../../services/api";
import "./index.scss";

const DEFAULT_FORM: Address = {
  id: "",
  name: "",
  phone: "",
  region: null,
  detail: "",
  tag: "家",
  isDefault: false
};

export default function AddressPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Address>(DEFAULT_FORM);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const items = await api.addresses.list();
      setAddresses(items || []);
    } catch (_err) {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadAddresses();
  });

  const handleEdit = (addr: Address) => {
    setForm({ ...addr });
    setIsEditing(true);
  };

  const handleAdd = () => {
    setForm({ ...DEFAULT_FORM });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.detail.trim()) {
      Taro.showToast({ title: "请填写完整地址", icon: "none" });
      return;
    }

    try {
      Taro.showLoading({ title: "保存中..." });

      if (form.id) {
        await api.addresses.update(form.id, {
          name: form.name,
          phone: form.phone,
          region: form.region,
          detail: form.detail,
          tag: form.tag,
          isDefault: form.isDefault
        });
      } else {
        await api.addresses.create({
          name: form.name,
          phone: form.phone,
          region: form.region,
          detail: form.detail,
          tag: form.tag,
          isDefault: form.isDefault
        });
      }

      Taro.hideLoading();
      Taro.showToast({ title: "保存成功", icon: "success" });
      setIsEditing(false);
      loadAddresses();
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: e.message || "保存失败", icon: "none" });
    }
  };

  const handleDelete = async (id: string) => {
    const confirm = await Taro.showModal({
      title: "提示",
      content: "确定删除此地址吗？"
    });
    if (!confirm.confirm) return;

    try {
      await api.addresses.delete(id);
      Taro.showToast({ title: "删除成功", icon: "success" });
      loadAddresses();
    } catch (e: any) {
      Taro.showToast({ title: e.message || "删除失败", icon: "none" });
    }
  };

  if (isEditing) {
    return (
      <View className="address-form">
        <View
          style={{
            padding: 16,
            borderBottom: "1px solid #eee",
            background: "white",
            display: "flex",
            alignItems: "center"
          }}
        >
          <Text onClick={() => setIsEditing(false)} style={{ fontSize: 14 }}>
            取消
          </Text>
          <Text style={{ flex: 1, textAlign: "center", fontWeight: "bold" }}>{form.id ? "编辑地址" : "新增地址"}</Text>
          <Text onClick={handleSave} style={{ fontSize: 14, fontWeight: "bold" }}>
            保存
          </Text>
        </View>

        <View className="form-body">
          <View className="form-group">
            <View className="form-item">
              <Text className="form-label">收货人</Text>
              <Input className="form-input" placeholder="名字" value={form.name} onInput={(e) => setForm({ ...form, name: e.detail.value })} />
            </View>
            <View className="form-item">
              <Text className="form-label">手机号码</Text>
              <Input
                className="form-input"
                placeholder="手机号"
                type="number"
                value={form.phone}
                onInput={(e) => setForm({ ...form, phone: e.detail.value })}
              />
            </View>
            <View className="form-item">
              <Text className="form-label">所在地区</Text>
              <Input
                className="form-input"
                placeholder="省市区县、乡镇等"
                value={form.region || ""}
                onInput={(e) => setForm({ ...form, region: e.detail.value || null })}
              />
            </View>
            <View className="form-item">
              <Text className="form-label">详细地址</Text>
              <Textarea
                className="form-textarea"
                placeholder="街道、楼牌号等"
                value={form.detail}
                onInput={(e) => setForm({ ...form, detail: e.detail.value })}
              />
            </View>
          </View>

          <View className="form-group">
            <View className="form-item">
              <Text className="form-label">标签</Text>
              <View className="tags-row">
                {["家", "公司", "学校", "其他"].map((t) => (
                  <View key={t} className={`tag-option ${form.tag === t ? "active" : ""}`} onClick={() => setForm({ ...form, tag: t })}>
                    {t}
                  </View>
                ))}
              </View>
            </View>
            <View className="switch-row">
              <Text>设为默认地址</Text>
              <Switch checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.detail.value })} color="black" />
            </View>
          </View>

          {form.id ? (
            <View className="btn-delete" onClick={() => handleDelete(form.id)}>
              删除地址
            </View>
          ) : null}

          <View className="btn-save" onClick={handleSave}>
            保存
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="address-container">
      <View className="address-list">
        {addresses.map((addr) => (
          <View key={addr.id} className="address-card">
            <View className="address-info" onClick={() => handleEdit(addr)}>
              <View className="info-row">
                <Text className="user-name">{addr.name}</Text>
                <Text className="user-phone">{addr.phone}</Text>
                {addr.isDefault ? <Text className="tag tag-default">默认</Text> : null}
                <Text className="tag tag-label">{addr.tag}</Text>
              </View>
              <Text className="address-detail">
                {addr.region} {addr.detail}
              </Text>
            </View>
            <View className="edit-btn" onClick={() => handleEdit(addr)}>
              <Edit size={16} />
            </View>
          </View>
        ))}
        {addresses.length === 0 && !loading ? <View style={{ textAlign: "center", marginTop: 40, color: "#ccc" }}>暂无地址</View> : null}
      </View>

      <View className="add-btn-wrapper">
        <View className="btn-add" onClick={handleAdd}>
          + 新增收货地址
        </View>
      </View>
    </View>
  );
}


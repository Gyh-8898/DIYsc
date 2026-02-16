import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingBag, Trash2 } from "../../components/Icons";
import { Design } from "../../constants";
import { api, CartItem as ApiCartItem } from "../../services/api";
import { saveCheckoutPayload } from "../../services/checkout";
import "./index.scss";

// Offline fallback cart key for unauthenticated users
const OFFLINE_CART_KEY = "mock_cart";

interface CartItem extends Design {
  itemId: string;
  selected: boolean;
  quantity: number;
}

function normalizeLocalItem(raw: any): CartItem | null {
  if (!raw) return null;
  const beads = Array.isArray(raw?.beads) ? raw.beads : [];
  const itemId = String(raw?.itemId || raw?.id || `local_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`);
  return {
    id: String(raw?.id || ""),
    itemId,
    name: String(raw?.name || "定制手串"),
    wristSize: Number(raw?.wristSize || 15),
    beads: beads,
    totalPrice: Number(raw?.totalPrice || 0),
    createdAt: Number(raw?.createdAt || Date.now()),
    likes: Number(raw?.likes || 0),
    author: String(raw?.author || ""),
    authorAvatar: String(raw?.authorAvatar || ""),
    imageUrl: typeof raw?.imageUrl === "string" ? raw.imageUrl : "",
    description: typeof raw?.description === "string" ? raw.description : "",
    plazaCategoryId: typeof raw?.plazaCategoryId === "string" ? raw.plazaCategoryId : "",
    selected: Boolean(raw?.selected ?? true),
    quantity: Math.max(1, Number(raw?.quantity || 1))
  };
}

function fromApiCartItem(item: ApiCartItem): CartItem {
  const design = item.design || ({} as any);
  return {
    id: String(design.id || ""),
    itemId: item.id,
    name: String(design.name || "定制手串"),
    wristSize: Number(design.wristSize || 15),
    beads: Array.isArray(design.beads) ? design.beads : [],
    totalPrice: Number(design.totalPrice || 0),
    createdAt: Number(item.createdAt || Date.now()),
    likes: 0,
    author: "",
    authorAvatar: "",
    imageUrl: typeof design.imageUrl === "string" ? design.imageUrl : "",
    description: "",
    plazaCategoryId: "",
    selected: Boolean(item.selected ?? true),
    quantity: Math.max(1, Number(item.quantity || 1))
  };
}

function toApiCartPayload(items: CartItem[]) {
  return items.map((item) => ({
    id: item.itemId,
    quantity: Math.max(1, Number(item.quantity || 1)),
    selected: Boolean(item.selected),
    design: {
      id: item.id,
      name: item.name,
      wristSize: Number(item.wristSize || 15),
      totalPrice: Number(item.totalPrice || 0),
      imageUrl: item.imageUrl || "",
      beads: Array.isArray(item.beads) ? item.beads : []
    }
  }));
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadCart = async () => {
    try {
      if (api.auth.isLoggedIn()) {
        const list = await api.cart.list();
        setCartItems((list || []).map(fromApiCartItem));
        return;
      }

      const localCart = Taro.getStorageSync(OFFLINE_CART_KEY);
      const list = Array.isArray(localCart) ? localCart.map(normalizeLocalItem).filter(Boolean) : [];
      setCartItems(list as CartItem[]);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "购物车加载失败", icon: "none" });
    }
  };

  useDidShow(() => {
    loadCart();
  });

  const saveCart = async (items: CartItem[]) => {
    setCartItems(items);
    if (!api.auth.isLoggedIn()) {
      Taro.setStorageSync(OFFLINE_CART_KEY, items);
      return;
    }

    setSyncing(true);
    try {
      const rows = await api.cart.replace(toApiCartPayload(items));
      setCartItems((rows || []).map(fromApiCartItem));
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "购物车同步失败", icon: "none" });
    } finally {
      setSyncing(false);
    }
  };

  const toggleItem = (index: number) => {
    const list = [...cartItems];
    list[index].selected = !list[index].selected;
    saveCart(list);
  };

  const toggleAll = () => {
    const allSelected = cartItems.every((item) => item.selected);
    const list = cartItems.map((item) => ({ ...item, selected: !allSelected }));
    saveCart(list);
  };

  const deleteSelected = () => {
    const list = cartItems.filter((item) => !item.selected);
    saveCart(list);
    Taro.showToast({ title: "已删除", icon: "none" });
  };

  const updateQuantity = (index: number, delta: number) => {
    const list = [...cartItems];
    const nextQty = list[index].quantity + delta;
    if (nextQty < 1) return;
    list[index].quantity = nextQty;
    saveCart(list);
  };

  const selectedItems = useMemo(() => cartItems.filter((item) => item.selected), [cartItems]);
  const totalAmount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0) * Number(item.quantity || 1), 0),
    [selectedItems]
  );
  const isAllSelected = cartItems.length > 0 && selectedItems.length === cartItems.length;

  const handleCheckout = async () => {
    if (selectedItems.length === 0) return;

    try {
      Taro.showLoading({ title: "跳转结算..." });
      if (!api.auth.isLoggedIn()) {
        await api.auth.login();
      }

      const designsPayload = selectedItems.map((item) => ({
        id: item.id,
        name: item.name,
        wristSize: item.wristSize,
        totalPrice: item.totalPrice,
        beads: Array.isArray(item.beads) ? item.beads : [],
        imageUrl: item.imageUrl || ""
      }));

      saveCheckoutPayload({
        source: "cart",
        designs: designsPayload,
        cartItemIds: selectedItems.map((item) => item.itemId)
      });

      Taro.hideLoading();
      Taro.showToast({ title: "请确认订单", icon: "none" });
      setTimeout(() => {
        Taro.navigateTo({ url: "/pages/order/confirm" });
      }, 1000);
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || "下单失败", icon: "none" });
    }
  };

  return (
    <View className="cart-container">
      <View className="cart-header">
        <Text className="cart-title">购物车 ({cartItems.length})</Text>
        {selectedItems.length > 0 ? (
          <View className="btn-delete-selected" onClick={deleteSelected}>
            <Trash2 size={14} color="#ef4444" />
            <Text>删除({selectedItems.length})</Text>
          </View>
        ) : null}
      </View>

      <ScrollView scrollY className="cart-list">
        {cartItems.length > 0 ? (
          cartItems.map((item, index) => (
            <View key={item.itemId} className="cart-item">
              <View className="checkbox-area" onClick={() => toggleItem(index)}>
                <View className={`checkbox ${item.selected ? "checked" : ""}`}>
                  {item.selected ? <Check size={12} color="white" /> : null}
                </View>
              </View>

              <View className="item-preview">
                <View className="preview-scale">
                  {Array.isArray(item.beads) &&
                    item.beads.map((bead, beadIndex) => {
                      const angle = (beadIndex * 360) / Math.max(item.beads.length, 1);
                      const radius = 35;
                      const x = 50 + radius * Math.cos(((angle - 90) * Math.PI) / 180);
                      const y = 50 + radius * Math.sin(((angle - 90) * Math.PI) / 180);

                      return (
                        <View
                          key={`${item.itemId}_${beadIndex}`}
                          className="bead-mini"
                          style={{
                            backgroundColor: (bead as any)?.color || "#a3a3a3",
                            left: `${x}%`,
                            top: `${y}%`
                          }}
                        />
                      );
                    })}
                </View>
              </View>

              <View className="item-info">
                <Text className="item-name">{item.name}</Text>
                <Text className="item-desc">
                  {item.wristSize}cm | {item.beads?.length || 0}颗珠
                </Text>

                <View className="item-footer">
                  <Text className="item-price">¥{Number(item.totalPrice || 0).toFixed(2)}</Text>
                  <View className="qty-control">
                    <View className="qty-btn" onClick={() => updateQuantity(index, -1)}>
                      <Minus size={12} />
                    </View>
                    <Text className="qty-val">{item.quantity}</Text>
                    <View className="qty-btn" onClick={() => updateQuantity(index, 1)}>
                      <Plus size={12} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className="empty-state">
            <ShoppingBag size={48} color="#e5e7eb" />
            <Text style={{ marginTop: 16, color: "#9ca3af", fontSize: 14 }}>购物车为空，快去挑选喜欢的作品</Text>
            <View className="btn-go-shopping" onClick={() => Taro.switchTab({ url: "/pages/plaza/index" })}>
              去广场逛逛
            </View>
          </View>
        )}
      </ScrollView>

      {cartItems.length > 0 ? (
        <View className="cart-footer">
          <View className="select-all" onClick={toggleAll}>
            <View className={`checkbox ${isAllSelected ? "checked" : ""}`}>
              {isAllSelected ? <Check size={12} color="white" /> : null}
            </View>
            <Text>全选</Text>
          </View>

          <View className="total-section">
            <View>
              <Text style={{ fontSize: 12, color: "#6b7280" }}>合计:</Text>
              <Text className="total-price">¥{totalAmount.toFixed(2)}</Text>
            </View>
            <View className={`btn-checkout ${selectedItems.length > 0 ? "active" : ""}`} onClick={handleCheckout}>
              {syncing ? "同步中..." : `结算(${selectedItems.length})`}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

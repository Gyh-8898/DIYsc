import { Image, ScrollView, Text, Textarea, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { AddOnProduct, Address, api, SystemConfig, UserCoupon } from "../../services/api";
import { CheckoutPayload, clearCheckoutPayload, readCheckoutPayload } from "../../services/checkout";
import "./confirm.scss";

export default function OrderConfirmPage() {
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addOns, setAddOns] = useState<AddOnProduct[]>([]);
  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});
  const [addOnRemarks, setAddOnRemarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<string>("");
  const [showCouponPicker, setShowCouponPicker] = useState(false);

  const loadData = async () => {
    const checkout = readCheckoutPayload();
    if (!checkout) {
      setPayload(null);
      return;
    }

    if (!api.auth.isLoggedIn()) {
      try {
        await api.auth.login();
      } catch (_error) {
        return;
      }
    }

    try {
      const [addressRows, addOnRows, sysConfig, couponRows] = await Promise.all([
        api.addresses.list(),
        api.addOns.list(),
        api.request<SystemConfig>("GET", "/system/config", undefined, { requireAuth: false }),
        api.coupons.mine().catch(() => [] as UserCoupon[])
      ]);
      const normalizedAddresses = Array.isArray(addressRows) ? addressRows : [];
      const defaultAddress = normalizedAddresses.find((item) => item.isDefault) || normalizedAddresses[0];

      setPayload(checkout);
      setAddresses(normalizedAddresses);
      setSelectedAddressId(defaultAddress?.id || "");
      // Filter visible add-ons
      setAddOns((Array.isArray(addOnRows) ? addOnRows : []).filter((item) => item.inStock && item.visible !== false));
      setAddOnQty({});
      setAddOnRemarks({});
      setConfig(sysConfig);
      // Filter usable coupons (status === "available" and within valid period)
      const now = Date.now();
      const usable = (Array.isArray(couponRows) ? couponRows : [])
        .filter(c => c.status === "available" && c.template.startAt <= now && c.template.endAt >= now);
      setCoupons(usable);
      setSelectedCouponId("");
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载结算信息失败", icon: "none" });
    }
  };

  useDidShow(() => {
    loadData();
  });

  const selectedAddOnItems = useMemo(() => {
    const result: Array<{ id: string; quantity: number }> = [];
    for (const item of addOns) {
      const quantity = Math.floor(Number(addOnQty[item.id] || 0));
      if (quantity > 0) {
        result.push({ id: item.id, quantity });
      }
    }
    return result;
  }, [addOns, addOnQty]);

  // Consolidate identical beads
  const consolidatedBeads = useMemo(() => {
    if (!payload?.designs[0]?.beads) return [];
    const beads = payload.designs[0].beads;
    const map = new Map<string, any>();

    beads.forEach(bead => {
      // Group by material identity (name + size + price + color), NOT by instance ID
      const key = `${bead.name}_${bead.sizeMm}_${bead.price}_${bead.color}`;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity += 1;
      } else {
        map.set(key, { ...bead, quantity: 1 });
      }
    });
    return Array.from(map.values());
  }, [payload]);

  // Pricing Logic
  const designAmount = useMemo(() => {
    if (!payload) return 0;
    return payload.designs.reduce((sum, design) => sum + Number(design.totalPrice || 0), 0);
  }, [payload]);

  const addOnAmount = useMemo(() => {
    return selectedAddOnItems.reduce((sum, row) => {
      const addOn = addOns.find((item) => item.id === row.id);
      if (!addOn) return sum;
      return sum + Number(addOn.price || 0) * row.quantity;
    }, 0);
  }, [selectedAddOnItems, addOns]);

  const handworkFee = config?.business?.handworkFee || 0;

  // Shipping Fee Logic
  const freeShippingThreshold = config?.business?.freeShippingThreshold || 99;
  const baseShippingFee = config?.business?.baseShippingFee || 0;

  const currentTotalForShipping = designAmount + addOnAmount;
  const isFreeShipping = currentTotalForShipping >= freeShippingThreshold;
  const shippingFee = isFreeShipping ? 0 : baseShippingFee;

  // Coupon discount calculation
  const selectedCoupon = coupons.find(c => c.id === selectedCouponId) || null;
  const couponDiscount = useMemo(() => {
    if (!selectedCoupon) return 0;
    const subtotal = designAmount + addOnAmount;
    if (subtotal < selectedCoupon.template.minAmount) return 0;
    if (selectedCoupon.template.discountType === "percent") {
      return Number((subtotal * (1 - selectedCoupon.template.discountValue / 10)).toFixed(2));
    }
    return Math.min(selectedCoupon.template.discountValue, subtotal);
  }, [selectedCoupon, designAmount, addOnAmount]);

  const estimateTotal = useMemo(() => {
    return Number(Math.max(0, designAmount + addOnAmount + handworkFee + shippingFee - couponDiscount).toFixed(2));
  }, [designAmount, addOnAmount, handworkFee, shippingFee, couponDiscount]);

  const updateAddOnQty = (addOnId: string, delta: number) => {
    setAddOnQty((prev) => {
      const current = Math.floor(Number(prev[addOnId] || 0));
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        [addOnId]: next
      };
    });
  };

  const cleanupCartAfterSubmit = async (checkout: CheckoutPayload) => {
    if (checkout.source !== "cart" || !Array.isArray(checkout.cartItemIds) || checkout.cartItemIds.length === 0) {
      return;
    }
    const current = await api.cart.list();
    const keep = (current || []).filter((item) => !checkout.cartItemIds!.includes(item.id));
    await api.cart.replace(
      keep.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        selected: item.selected,
        design: item.design
      }))
    );
  };

  const submitOrder = async () => {
    if (!payload) {
      Taro.showToast({ title: "缺少结算商品", icon: "none" });
      return;
    }

    if (!selectedAddressId) {
      const confirm = await Taro.showModal({
        title: "请先添加收货地址",
        content: "下单前需要先设置收货地址，是否现在去添加？"
      });
      if (confirm.confirm) {
        Taro.navigateTo({ url: "/pages/address/index" });
      }
      return;
    }

    setSubmitting(true);
    try {
      Taro.showLoading({ title: "提交订单..." });

      // Combine manual remarks with add-on specific remarks
      let finalRemarks = remarks.trim();
      const addOnNotes: string[] = [];

      selectedAddOnItems.forEach(item => {
        const note = addOnRemarks[item.id];
        if (note && note.trim()) {
          const product = addOns.find(p => p.id === item.id);
          addOnNotes.push(`${product?.name || '加购商品'}: ${note.trim()}`);
        }
      });

      if (addOnNotes.length > 0) {
        finalRemarks = finalRemarks
          ? `${finalRemarks}\n\n[加购备注]\n${addOnNotes.join('\n')}`
          : `[加购备注]\n${addOnNotes.join('\n')}`;
      }

      const result = await api.orders.create({
        designs: payload.designs,
        addressId: selectedAddressId,
        remarks: finalRemarks,
        addOnItems: selectedAddOnItems,
        couponId: selectedCouponId || undefined,
        pointsToUse: 0 // Future extension
      });

      await cleanupCartAfterSubmit(payload);
      clearCheckoutPayload();

      Taro.hideLoading();
      Taro.showToast({ title: "订单已创建", icon: "success" });

      // #9: Prompt user to subscribe for shipping notification
      try {
        if (config?.messageTemplates?.orderShipped) {
          await (Taro as any).requestSubscribeMessage({
            tmplIds: [String(config.messageTemplates.orderShipped)]
          });
        }
      } catch (_e) {
        // User declined or not supported — not blocking
      }

      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/order/detail?id=${encodeURIComponent(result.orderId)}` });
      }, 400);
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || "提交失败", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!payload) {
    return (
      <View className="order-confirm-page empty-state">
        <View className="empty-content">
          <Text className="empty-title">暂无待结算商品</Text>
          <Text className="empty-desc">请先在工作台或购物车选择商品后再结算</Text>
          <View className="btn-primary" onClick={() => Taro.switchTab({ url: "/pages/index/index" })}>
            返回首页
          </View>
        </View>
      </View>
    );
  }

  // Use the first design as the "cover" product for simple display
  const mainDesign = payload.designs[0];

  return (
    <View className="order-confirm-page">
      <ScrollView scrollY className="content-scroll">
        {/* 1. PREVIEW CARD - Bead circle preview (same as portfolio) */}
        <View className="section-card preview-card">
          <View className="preview-image-box">
            {mainDesign.imageUrl ? (
              <Image src={mainDesign.imageUrl} className="preview-img" mode="aspectFill" />
            ) : (
              <View className="css-preview-container">
                <View className="css-preview-canvas">
                  {(() => {
                    const beads = mainDesign.beads;
                    const total = Math.max(beads.length, 1);
                    const maxSizeMm = beads.reduce((max, b) => Math.max(max, Number(b.sizeMm || 8)), 8);
                    const beadDiameter = Math.max(28, Math.min(72, maxSizeMm * 4.2));
                    const radiusByCount = (total * beadDiameter * 1.08) / (2 * Math.PI);
                    const radius = Math.max(120, Math.min(210, radiusByCount));
                    const center = 260; // half of 520rpx canvas

                    return beads.map((bead, index) => {
                      const angle = (index * 360) / total;
                      const x = center + radius * Math.cos(((angle - 90) * Math.PI) / 180);
                      const y = center + radius * Math.sin(((angle - 90) * Math.PI) / 180);

                      return (
                        <View
                          key={index}
                          className="css-bead"
                          style={{
                            background: bead.color || '#b4bbc5',
                            width: `${beadDiameter}rpx`,
                            height: `${beadDiameter}rpx`,
                            left: `${x}rpx`,
                            top: `${y}rpx`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      );
                    });
                  })()}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 2. SPECS CARD - Parameters */}
        <View className="section-card specs-card">
          <View className="specs-grid">
            <View className="spec-item">
              <Text className="spec-label">商品名称</Text>
              <Text className="spec-val">{mainDesign.name || "定制手串"}</Text>
            </View>
            <View className="spec-item">
              <Text className="spec-label">手围</Text>
              <Text className="spec-val">{mainDesign.wristSize}cm</Text>
            </View>
            <View className="spec-item">
              <Text className="spec-label">预估克重</Text>
              <Text className="spec-val">约 {(payload.designs[0].beads.length * 2.5).toFixed(1)}g</Text>
            </View>
            <View className="spec-item">
              <Text className="spec-label">适合手围</Text>
              <Text className="spec-val">{mainDesign.wristSize - 0.5}-{mainDesign.wristSize + 0.5}cm</Text>
            </View>
          </View>
        </View>

        {/* 3. MATERIAL LIST - Consolidated */}
        <View className="section-card material-card">
          <View className="card-header">
            <Text className="icon-list">💎</Text>
            <Text className="card-title">珠子明细</Text>
          </View>
          <View className="material-list">
            {consolidatedBeads.map((bead, idx) => (
              <View key={`${bead.id}-${idx}`} className="material-item">
                <View className="item-main">
                  <View className="material-icon" style={{ backgroundColor: bead.color || '#eee' }} />
                  <View className="material-info">
                    <Text className="name">{bead.name}</Text>
                    <Text className="desc">{bead.sizeMm}mm</Text>
                  </View>
                </View>
                <View className="item-meta">
                  <Text className="qty">x{bead.quantity}</Text>
                  <Text className="price">¥{(bead.price * bead.quantity).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Add-ons Section - Controlled by SystemConfig */}
        {config?.features?.enableAddOns && (
          <View className="section-card addons-card">
            <View className="card-header">
              <Text className="icon-gift">🎁</Text>
              <Text className="card-title">精选加购</Text>
            </View>

            <View className="addon-list">
              {addOns.map(item => {
                const qty = addOnQty[item.id] || 0;
                return (
                  <View key={item.id} className="addon-item-wrapper">
                    <View className="addon-item">
                      <Image src={item.image} className="addon-img" mode="aspectFill" />
                      <View className="addon-content">
                        <View className="addon-info-top">
                          <Text className="addon-name">{item.name}</Text>
                          {item.note && <Text className="addon-note-hint">{item.note}</Text>}
                        </View>

                        <View className="addon-action-row">
                          <Text className="addon-price">¥{item.price}</Text>

                          <View className="qty-control">
                            <View className="btn-qty" onClick={() => updateAddOnQty(item.id, -1)}>-</View>
                            <Text className="qty-val">{qty}</Text>
                            <View className="btn-qty" onClick={() => updateAddOnQty(item.id, 1)}>+</View>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* User Remark Input for Add-on */}
                    {qty > 0 && (
                      <View className="addon-user-remark">
                        <Text className="remark-label">备注:</Text>
                        <input
                          className="remark-input"
                          placeholder="例如: 颜色/尺码需求"
                          value={(addOnRemarks || {})[item.id] || ''}
                          onInput={(e) => {
                            setAddOnRemarks(prev => ({ ...prev, [item.id]: e.detail.value }));
                          }}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
        {/* Coupon Selection */}
        {coupons.length > 0 && (
          <View className="section-card coupon-card" onClick={() => setShowCouponPicker(!showCouponPicker)}>
            <View className="coupon-row">
              <Text className="icon-coupon">🎫</Text>
              <Text className="card-title">优惠券</Text>
              <View style={{ flex: 1 }} />
              {selectedCoupon ? (
                <Text className="coupon-selected">-¥{couponDiscount.toFixed(2)}</Text>
              ) : (
                <Text className="coupon-available">{coupons.length}张可用</Text>
              )}
              <Text className="arrow">{">"}</Text>
            </View>
          </View>
        )}

        {/* Coupon Picker Modal */}
        {showCouponPicker && (
          <View className="section-card coupon-picker-list">
            <View
              className={`coupon-pick-item ${!selectedCouponId ? "active" : ""}`}
              onClick={() => { setSelectedCouponId(""); setShowCouponPicker(false); }}
            >
              <Text>不使用优惠券</Text>
            </View>
            {coupons.map(c => {
              const meetsMin = (designAmount + addOnAmount) >= c.template.minAmount;
              return (
                <View
                  key={c.id}
                  className={`coupon-pick-item ${selectedCouponId === c.id ? "active" : ""} ${!meetsMin ? "disabled" : ""}`}
                  onClick={() => {
                    if (!meetsMin) return;
                    setSelectedCouponId(c.id);
                    setShowCouponPicker(false);
                  }}
                >
                  <View className="coupon-pick-info">
                    <Text className="coupon-pick-name">{c.template.name}</Text>
                    <Text className="coupon-pick-desc">
                      {c.template.discountType === "percent"
                        ? `${c.template.discountValue}折`
                        : `减¥${c.template.discountValue}`}
                      {` · 满¥${c.template.minAmount}可用`}
                    </Text>
                  </View>
                  {selectedCouponId === c.id && <Text className="coupon-check">✓</Text>}
                  {!meetsMin && <Text className="coupon-ineligible">未满足</Text>}
                </View>
              );
            })}
          </View>
        )}

        {/* Address Selection - Independent Widget */}
        <View className="section-card address-card" onClick={() => Taro.navigateTo({ url: "/pages/address/index" })}>
          {selectedAddressId ? (
            <View className="address-display">
              <View className="addr-icon-box">
                <Text className="icon-loc">📍</Text>
              </View>
              <View className="addr-info">
                <View className="addr-user">
                  <Text className="name">{addresses.find(a => a.id === selectedAddressId)?.name}</Text>
                  <Text className="phone">{addresses.find(a => a.id === selectedAddressId)?.phone}</Text>
                </View>
                <Text className="addr-text">
                  {addresses.find(a => a.id === selectedAddressId)?.region} {addresses.find(a => a.id === selectedAddressId)?.detail}
                </Text>
              </View>
              <Text className="arrow">{">"}</Text>
            </View>
          ) : (
            <View className="address-placeholder">
              <View className="addr-icon-box placeholder">
                <Text className="icon-plus">+</Text>
              </View>
              <Text className="text">添加收货地址</Text>
              <Text className="arrow">{">"}</Text>
            </View>
          )}
        </View>

        {/* Price Summary */}
        <View className="section-card summary-card">

          <View className="trust-badges">
            <View className="badge-row"><Text>✔</Text><Text>严选材料、天然水晶、一物一图</Text></View>
            <View className="badge-row"><Text>✔</Text><Text>专业及工、匠心制作、追求品质</Text></View>
            <View className="badge-row"><Text>✔</Text><Text>品质安心、有求必应、售后无忧</Text></View>
          </View>
        </View>

        {/* Remarks */}
        <View className="section-card">
          <Text className="card-title">订单备注</Text>
          <Textarea
            className="remarks-input"
            placeholder="选填：颜色偏好、送礼需求、制作说明等"
            value={remarks}
            onInput={(e) => setRemarks(e.detail.value)}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="checkout-footer">
        <View className="footer-price-area">
          <Text className="total-label">合计</Text>
          <Text className="total-amount">¥{estimateTotal.toFixed(2)}</Text>
          {couponDiscount > 0 && <Text className="coupon-savings">已优惠 ¥{couponDiscount.toFixed(2)}</Text>}
        </View>
        <View className="submit-btn" onClick={submitOrder}>
          {submitting ? "提交中..." : "提交订单"}
        </View>
      </View>
    </View>
  );
}

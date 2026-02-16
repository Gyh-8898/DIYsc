import Taro from "@tarojs/taro";

export const CHECKOUT_PAYLOAD_KEY = "checkout_payload_v1";

export interface CheckoutDesignPayload {
  id?: string;
  name: string;
  wristSize: number;
  totalPrice: number;
  beads: any[];
  imageUrl?: string;
}

export interface CheckoutPayload {
  source: "designer" | "cart";
  designs: CheckoutDesignPayload[];
  cartItemIds?: string[];
}

export function saveCheckoutPayload(payload: CheckoutPayload) {
  Taro.setStorageSync(CHECKOUT_PAYLOAD_KEY, payload);
}

export function readCheckoutPayload(): CheckoutPayload | null {
  const raw = Taro.getStorageSync(CHECKOUT_PAYLOAD_KEY);
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw.source === "cart" ? "cart" : raw.source === "designer" ? "designer" : "";
  const designs = Array.isArray(raw.designs) ? raw.designs : [];
  if (!source || designs.length === 0) {
    return null;
  }

  const normalizedDesigns = designs.map((design) => ({
    id: typeof design?.id === "string" ? design.id : "",
    name: typeof design?.name === "string" && design.name.trim() ? design.name : "定制手串",
    wristSize: Number(design?.wristSize || 15),
    totalPrice: Number(design?.totalPrice || 0),
    beads: Array.isArray(design?.beads) ? design.beads : [],
    imageUrl: typeof design?.imageUrl === "string" ? design.imageUrl : ""
  }));

  return {
    source,
    designs: normalizedDesigns,
    cartItemIds: Array.isArray(raw.cartItemIds)
      ? raw.cartItemIds.filter((id: any) => typeof id === "string")
      : []
  };
}

export function clearCheckoutPayload() {
  Taro.removeStorageSync(CHECKOUT_PAYLOAD_KEY);
}

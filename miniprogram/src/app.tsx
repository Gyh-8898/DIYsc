import { PropsWithChildren, useEffect } from "react";
import Taro from "@tarojs/taro";
import "./app.scss";

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    const launch = Taro.getLaunchOptionsSync?.();
    const query = (launch && launch.query) || {};
    const referralCode = String((query as any).ref || (query as any).referralCode || "")
      .trim()
      .toUpperCase();
    if (referralCode) {
      Taro.setStorageSync("pending_referral_code", referralCode);
    }
  }, []);

  return children;
}

export default App;

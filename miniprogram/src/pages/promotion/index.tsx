import { Input, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";
import { Gift } from "../../components/Icons";
import { api, PointHistoryItem, User, WithdrawalItem } from "../../services/api";
import "./index.scss";

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatStatus(status: string) {
  if (status === "approved") return "已通过";
  if (status === "rejected") return "已驳回";
  return "审核中";
}

export default function PromotionPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [pointHistory, setPointHistory] = useState<PointHistoryItem[]>([]);
  const [pointsToMoneyRate, setPointsToMoneyRate] = useState(0.01);
  const [minWithdrawPoints, setMinWithdrawPoints] = useState(1000);
  const [orderShippedTplId, setOrderShippedTplId] = useState("");
  const [account, setAccount] = useState("");
  const [moneyAmount, setMoneyAmount] = useState("");

  const loadData = async () => {
    if (!api.auth.isLoggedIn()) {
      setUser(null);
      setWithdrawals([]);
      setPointHistory([]);
      return;
    }

    setLoading(true);
    try {
      const [currentUser, withdrawRows, pointRows, config] = await Promise.all([
        api.auth.getCurrentUser(),
        api.withdrawals.list(),
        api.points.history(),
        api.config.get()
      ]);

      const affiliateConfig = (config as any)?.affiliate || {};
      const templates = (config as any)?.messageTemplates || {};
      const rate = Number(affiliateConfig.pointsToMoneyRate || 0.01);
      const minPoints = Number(affiliateConfig.minWithdrawPoints || 1000);

      setUser(currentUser);
      setWithdrawals(Array.isArray(withdrawRows) ? withdrawRows : []);
      setPointHistory(Array.isArray(pointRows) ? pointRows : []);
      setPointsToMoneyRate(Number.isFinite(rate) && rate > 0 ? rate : 0.01);
      setMinWithdrawPoints(Number.isFinite(minPoints) && minPoints > 0 ? minPoints : 1000);
      setOrderShippedTplId(String(templates?.orderShipped || ""));

      api.analytics.track("promotion.page_view", { userId: currentUser.id }, "promotion");
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadData();
  });

  const availablePoints = Number(user?.points || 0);
  const frozenPoints = Number(user?.frozenPoints || 0);
  const availableMoney = useMemo(() => Number((availablePoints * pointsToMoneyRate).toFixed(2)), [availablePoints, pointsToMoneyRate]);

  const handleLogin = async () => {
    try {
      await api.auth.login();
      await loadData();
      Taro.showToast({ title: "登录成功", icon: "success" });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "登录失败", icon: "none" });
    }
  };

  const handleCopyCode = async () => {
    if (!user?.referralCode) {
      Taro.showToast({ title: "暂无邀请码", icon: "none" });
      return;
    }

    await Taro.setClipboardData({ data: user.referralCode });
    Taro.showToast({ title: "邀请码已复制", icon: "success" });
  };

  const handleGeneratePoster = () => {
    Taro.navigateTo({
      url: `/pages/promotion/poster?code=${encodeURIComponent(user?.referralCode || "")}`
    });
  };

  const handleSubscribe = async () => {
    if (!orderShippedTplId) {
      Taro.showToast({ title: "后台未配置发货订阅模板ID", icon: "none" });
      return;
    }

    try {
      await Taro.requestSubscribeMessage({ tmplIds: [orderShippedTplId] } as any);
      Taro.showToast({ title: "订阅请求已发送", icon: "success" });
    } catch (_error) {
      Taro.showToast({ title: "订阅失败或已取消", icon: "none" });
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(moneyAmount);
    if (!account.trim()) {
      Taro.showToast({ title: "请输入收款账号", icon: "none" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Taro.showToast({ title: "提现金额不合法", icon: "none" });
      return;
    }
    if (amount > availableMoney) {
      Taro.showToast({ title: "可提现金额不足", icon: "none" });
      return;
    }
    if (availablePoints < minWithdrawPoints) {
      Taro.showToast({ title: `最低提现积分：${minWithdrawPoints}`, icon: "none" });
      return;
    }

    setSubmitting(true);
    try {
      await api.withdrawals.create({ moneyAmount: amount, account: account.trim() });
      setMoneyAmount("");
      Taro.showToast({ title: "已提交提现申请", icon: "success" });
      await loadData();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "提交失败", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!api.auth.isLoggedIn()) {
    return (
      <View className="promotion-page">
        <View className="promotion-login">
          <View className="promotion-login-card">
            <Text className="promotion-login-title">登录后查看推广中心</Text>
            <Text className="promotion-login-desc">查看邀请码、积分流水与提现记录，并提交提现申请。</Text>
            <View className="promotion-login-btn" onClick={handleLogin}>
              微信登录
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="promotion-page">
      <ScrollView scrollY className="promotion-scroll">
        <View className="promotion-body">
          <View className="promotion-card promotion-main">
            <View className="promotion-main-top">
              <View>
                <Text className="promotion-main-name">{user?.nickname || "用户"}</Text>
                <Text className="promotion-main-level">会员等级：{user?.levelName || "普通会员"}</Text>
              </View>
              <Gift size={34} color="#ffffff" />
            </View>
            <View className="promotion-code-row">
              <View>
                <Text className="promotion-code-label">我的邀请码</Text>
                <Text className="promotion-code-value">{user?.referralCode || "暂无"}</Text>
              </View>
              <View className="promotion-copy-btn" onClick={handleCopyCode}>
                复制
              </View>
            </View>
            <View className="promotion-tools-row">
              <View className="promotion-tool-btn" onClick={handleSubscribe}>
                订阅发货通知
              </View>
              <View className="promotion-tool-btn" onClick={handleGeneratePoster}>
                生成分享海报
              </View>
            </View>
          </View>

          <View className="promotion-card">
            <Text className="promotion-title">积分与收益</Text>
            <View className="promotion-grid">
              <View className="promotion-grid-item">
                <Text className="promotion-grid-label">可用积分</Text>
                <Text className="promotion-grid-value">{availablePoints}</Text>
              </View>
              <View className="promotion-grid-item">
                <Text className="promotion-grid-label">冻结积分</Text>
                <Text className="promotion-grid-value">{frozenPoints}</Text>
              </View>
              <View className="promotion-grid-item">
                <Text className="promotion-grid-label">可提现金额</Text>
                <Text className="promotion-grid-value">¥{availableMoney.toFixed(2)}</Text>
                <Text className="promotion-grid-sub">按比例 {pointsToMoneyRate.toFixed(4)}</Text>
              </View>
              <View className="promotion-grid-item">
                <Text className="promotion-grid-label">累计订单</Text>
                <Text className="promotion-grid-value">{Number(user?.orderCount || 0)}</Text>
                <Text className="promotion-grid-sub">累计消费 ¥{Number(user?.totalSpend || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View className="promotion-card">
            <Text className="promotion-title">积分提现</Text>
            <Input
              className="promotion-input"
              placeholder="请输入收款账号（手机号/微信号）"
              value={account}
              onInput={(event) => setAccount(event.detail.value)}
            />
            <Input
              className="promotion-input"
              placeholder="请输入提现金额（元）"
              type="digit"
              value={moneyAmount}
              onInput={(event) => setMoneyAmount(event.detail.value)}
            />
            <Text className="promotion-hint">最低提现积分：{minWithdrawPoints}，可提现金额：¥{availableMoney.toFixed(2)}</Text>
            <View className="promotion-submit-btn" onClick={submitting ? undefined : handleWithdraw}>
              {submitting ? "提交中..." : "提交提现申请"}
            </View>
          </View>

          <View className="promotion-card">
            <Text className="promotion-title">提现记录</Text>
            {withdrawals.length === 0 ? (
              <View className="promotion-empty">{loading ? "加载中..." : "暂无提现记录"}</View>
            ) : (
              <View className="promotion-record-list">
                {withdrawals.map((item) => (
                  <View key={item.id} className="promotion-record-item">
                    <View className="promotion-record-top">
                      <Text className="promotion-record-title">{item.account}</Text>
                      <Text className={`promotion-tag ${item.status}`}>{formatStatus(item.status)}</Text>
                    </View>
                    <View className="promotion-record-top">
                      <Text className="promotion-record-meta">{formatDate(item.createdAt)}</Text>
                      <Text className="promotion-record-amount">¥{Number(item.moneyAmount).toFixed(2)}</Text>
                    </View>
                    <Text className="promotion-record-meta">冻结积分：{item.pointsAmount}</Text>
                    {item.rejectReason ? <Text className="promotion-record-meta">驳回原因：{item.rejectReason}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View className="promotion-card">
            <Text className="promotion-title">积分流水（最近10条）</Text>
            {pointHistory.length === 0 ? (
              <View className="promotion-empty">{loading ? "加载中..." : "暂无积分流水"}</View>
            ) : (
              <View className="promotion-record-list">
                {pointHistory.slice(0, 10).map((item) => (
                  <View key={item.id} className="promotion-points-item">
                    <View className="promotion-points-top">
                      <Text className="promotion-points-desc">{item.description || item.type}</Text>
                      <Text className={`promotion-points-value ${item.amount >= 0 ? "add" : "minus"}`}>
                        {item.amount >= 0 ? `+${item.amount}` : item.amount}
                      </Text>
                    </View>
                    <Text className="promotion-points-time">{formatDate(item.createdAt)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}


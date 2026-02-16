import { prisma } from '../lib/prisma';
import { getAppConfig } from './config.service';

type CheckStatus = 'ok' | 'warn' | 'error';

interface SelfCheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  message: string;
  detail?: string;
}

function countByStatus(items: SelfCheckItem[], status: CheckStatus) {
  return items.filter((item) => item.status === status).length;
}

export async function getAdminOpsSelfCheck() {
  const items: SelfCheckItem[] = [];
  const config = await getAppConfig();

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    items.push({
      key: 'database',
      label: '数据库连接',
      status: 'ok',
      message: '数据库连接正常'
    });
  } catch (error: any) {
    items.push({
      key: 'database',
      label: '数据库连接',
      status: 'error',
      message: '数据库连接失败',
      detail: String(error?.message || '')
    });
  }

  const payment = config.integrations?.payment;
  if (!payment?.enabled) {
    items.push({
      key: 'payment',
      label: '支付通道配置',
      status: 'warn',
      message: '支付通道未启用'
    });
  } else if (payment.provider === 'wechat') {
    const required = [payment.appId, payment.mchId, payment.mchKey, payment.notifyUrl];
    const ok = required.every((item) => String(item || '').trim().length > 0);
    items.push({
      key: 'payment',
      label: '支付通道配置',
      status: ok ? 'ok' : 'error',
      message: ok ? '微信支付配置完整' : '微信支付配置缺失',
      detail: ok ? '' : '需要 appId / mchId / mchKey / notifyUrl'
    });
  } else {
    items.push({
      key: 'payment',
      label: '支付通道配置',
      status: 'ok',
      message: `支付通道已启用：${payment.provider}`
    });
  }

  const qiniu = config.integrations?.qiniu;
  if (!qiniu?.enabled) {
    items.push({
      key: 'qiniu',
      label: '七牛云配置',
      status: 'warn',
      message: '七牛云未启用（将使用本地上传）'
    });
  } else {
    const required = [qiniu.accessKey, qiniu.secretKey, qiniu.bucket, qiniu.domain, qiniu.region];
    const ok = required.every((item) => String(item || '').trim().length > 0);
    items.push({
      key: 'qiniu',
      label: '七牛云配置',
      status: ok ? 'ok' : 'error',
      message: ok ? '七牛云配置完整' : '七牛云配置缺失',
      detail: ok ? '' : '需要 accessKey / secretKey / bucket / domain / region'
    });
  }

  const logistics = config.integrations?.logistics;
  if (!logistics?.enabled || logistics.provider === 'manual') {
    items.push({
      key: 'logistics',
      label: '物流接口配置',
      status: 'warn',
      message: '当前为手动物流模式'
    });
  } else if (logistics.provider === 'kdniao') {
    const ok = [logistics.companyId, logistics.apiKey].every((item) => String(item || '').trim().length > 0);
    items.push({
      key: 'logistics',
      label: '物流接口配置',
      status: ok ? 'ok' : 'error',
      message: ok ? '快递鸟配置完整' : '快递鸟配置缺失',
      detail: ok ? '' : '需要 companyId / apiKey'
    });
  } else {
    items.push({
      key: 'logistics',
      label: '物流接口配置',
      status: 'ok',
      message: `物流提供商已启用：${logistics.provider}`
    });
  }

  const templateCount = [config.messageTemplates?.orderPaid, config.messageTemplates?.orderShipped, config.messageTemplates?.promotion]
    .map((item) => String(item || '').trim())
    .filter(Boolean).length;
  items.push({
    key: 'messageTemplates',
    label: '消息模板配置',
    status: templateCount >= 2 ? 'ok' : 'warn',
    message: templateCount >= 2 ? '消息模板配置较完整' : '消息模板建议至少配置 2 项',
    detail: `当前已配置 ${templateCount} / 3`
  });

  const [totalUsers, totalOrders, todayNewUsers, todayOrders, pendingPaymentOrders, pendingWithdrawals] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    prisma.order.count({ where: { status: 'pending_payment' } }),
    prisma.withdrawalRequest.count({ where: { status: 'pending' } })
  ]);

  const summary = {
    total: items.length,
    ok: countByStatus(items, 'ok'),
    warn: countByStatus(items, 'warn'),
    error: countByStatus(items, 'error')
  };

  return {
    generatedAt: Date.now(),
    summary,
    items,
    snapshot: {
      totalUsers,
      totalOrders,
      todayNewUsers,
      todayOrders,
      pendingPaymentOrders,
      pendingWithdrawals
    }
  };
}

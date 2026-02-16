import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { createPaymentParams, markOrderPaid } from '../services/order.service';
import { getAppConfig } from '../services/config.service';

function verifyNotifySignature(
  payload: { orderNo?: string; transactionId?: string; sign?: string },
  mchKey: string,
  requireSign: boolean
): boolean {
  if (!payload.orderNo || !payload.transactionId) return false;
  if (!payload.sign) {
    return !requireSign;
  }
  if (!mchKey) return false;

  const raw = `${payload.orderNo}|${payload.transactionId}|${mchKey}`;
  const expected = createHash('sha256').update(raw).digest('hex');
  return expected === payload.sign;
}

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = String(req.body?.orderId || '');
    if (!orderId) {
      throw new AppError(52001, '订单ID不能为空', 400);
    }

    const data = await createPaymentParams(req.user!.userId, orderId);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const notifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = {
      orderId: typeof req.body?.orderId === 'string' ? req.body.orderId : undefined,
      orderNo: typeof req.body?.orderNo === 'string' ? req.body.orderNo : undefined,
      transactionId: typeof req.body?.transactionId === 'string' ? req.body.transactionId : undefined,
      paidAt: req.body?.paidAt,
      sign: typeof req.body?.sign === 'string' ? req.body.sign : undefined
    };

    if (!payload.orderId && !payload.orderNo) {
      throw new AppError(52002, '订单ID或订单号不能为空', 400);
    }

    const config = await getAppConfig();
    const mchKey = config.integrations?.payment?.mchKey || process.env.WECHAT_MCH_KEY || '';
    const provider = config.integrations?.payment?.provider || 'mock';

    const notifyToken = String(process.env.PAYMENT_NOTIFY_TOKEN || '').trim();
    const requestToken = String(req.get('x-notify-token') || '').trim();
    if (!notifyToken) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError(52004, 'PAYMENT_NOTIFY_TOKEN 未配置', 500);
      }
    } else if (notifyToken !== requestToken) {
      throw new AppError(52005, '回调 token 不正确', 401);
    }

    const requireSign = provider === 'wechat';
    if (requireSign && !mchKey) {
      throw new AppError(52006, '微信支付密钥未配置', 500);
    }

    if (!verifyNotifySignature(payload, mchKey, requireSign)) {
      throw new AppError(52003, '支付签名校验失败', 401);
    }

    const order = await markOrderPaid(payload);

    success(res, {
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

export const mockConfirmPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(52007, '生产环境禁止模拟确认支付', 403);
    }

    const orderId = String(req.body?.orderId || '');
    if (!orderId) {
      throw new AppError(52008, '订单ID不能为空', 400);
    }

    const config = await getAppConfig();
    const provider = config.integrations?.payment?.provider || 'mock';
    if (provider !== 'mock') {
      throw new AppError(52009, '模拟确认仅支持 mock 支付通道', 400);
    }

    const order = await markOrderPaid({
      orderId,
      transactionId: `mock_${Date.now()}`,
      paidAt: Date.now()
    });

    success(res, {
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};



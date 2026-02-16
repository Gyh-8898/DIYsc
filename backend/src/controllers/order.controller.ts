import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import {
  cancelOrderByUser,
  confirmOrderByUser,
  createOrder,
  getLogistics,
  getOrderById,
  getOrdersForUser
} from '../services/order.service';

export const createOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createOrder({
      userId: req.user!.userId,
      designs: Array.isArray(req.body?.designs) ? req.body.designs : [],
      addOns: Array.isArray(req.body?.addOns) ? req.body.addOns : [],
      addressId: typeof req.body?.addressId === 'string' ? req.body.addressId : undefined,
      shippingAddress: typeof req.body?.shippingAddress === 'string' ? req.body.shippingAddress : undefined,
      remarks: typeof req.body?.remarks === 'string' ? req.body.remarks : '',
      couponId: typeof req.body?.couponId === 'string' ? req.body.couponId : undefined,
      pointsToUse: Number(req.body?.pointsToUse || 0),
      clientAmount: Number(req.body?.clientAmount ?? req.body?.totalAmount),
      userIp: req.ip
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getOrdersForUser(req.user!.userId);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const getOrderByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await getOrderById(req.user!.userId, req.user!.role, req.params.id);
    success(res, order);
  } catch (error) {
    next(error);
  }
};

export const payOrder = async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    throw new AppError(50021, '直付接口已禁用，请使用 /payments/create + /payments/notify', 400);
  } catch (error) {
    next(error);
  }
};

export const confirmOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await confirmOrderByUser(req.user!.userId, req.params.id);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cancelOrderByUser(req.user!.userId, req.params.id);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getLogisticsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await getLogistics(req.params.id, req.user!.userId, req.user!.role);
    success(res, events);
  } catch (error) {
    next(error);
  }
};



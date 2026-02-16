import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';
import {
  addUserAddress,
  deleteUserAddress,
  getPointHistory,
  getUserAddresses,
  getUserDtoById,
  setDefaultAddress,
  updateUserAddress
} from '../services/user.service';
import { deleteUserDesign, getUserDesigns, saveUserDesign } from '../services/product.service';
import { claimCoupon, listCouponTemplates, listUserCoupons } from '../services/coupon.service';
import { createWithdrawal, listMyWithdrawals } from '../services/affiliate.service';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserDtoById(req.user!.userId);
    success(res, user);
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(30010, '用户不存在', 404);

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: typeof req.body?.name === 'string' ? req.body.name : user.name,
        avatar: typeof req.body?.avatar === 'string' ? req.body.avatar : user.avatar,
        phone: typeof req.body?.phone === 'string' ? req.body.phone : user.phone
      }
    });

    const dto = await getUserDtoById(userId);
    success(res, dto);
  } catch (error) {
    next(error);
  }
};

export const getDesigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getUserDesigns(req.user!.userId);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const saveDesign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const design = await saveUserDesign(req.user!.userId, req.body || {});
    success(res, design);
  } catch (error) {
    next(error);
  }
};

export const deleteDesign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteUserDesign(req.user!.userId, req.params.id);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getUserAddresses(req.user!.userId);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const addAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = await addUserAddress(req.user!.userId, {
      name: String(req.body?.name || ''),
      phone: String(req.body?.phone || ''),
      region: String(req.body?.region || ''),
      detail: String(req.body?.detail || ''),
      tag: String(req.body?.tag || 'home'),
      isDefault: Boolean(req.body?.isDefault)
    });
    success(res, address);
  } catch (error) {
    next(error);
  }
};

export const editAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = await updateUserAddress(req.user!.userId, req.params.id, {
      name: typeof req.body?.name === 'string' ? req.body.name : undefined,
      phone: typeof req.body?.phone === 'string' ? req.body.phone : undefined,
      region: typeof req.body?.region === 'string' ? req.body.region : undefined,
      detail: typeof req.body?.detail === 'string' ? req.body.detail : undefined,
      tag: typeof req.body?.tag === 'string' ? req.body.tag : undefined,
      isDefault: typeof req.body?.isDefault === 'boolean' ? req.body.isDefault : undefined
    });
    success(res, address);
  } catch (error) {
    next(error);
  }
};

export const removeAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteUserAddress(req.user!.userId, req.params.id);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const makeDefaultAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = await setDefaultAddress(req.user!.userId, req.params.id);
    success(res, address);
  } catch (error) {
    next(error);
  }
};

export const getPointsHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await getPointHistory(req.user!.userId);
    success(res, logs);
  } catch (error) {
    next(error);
  }
};

export const getMyCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await listUserCoupons(req.user!.userId);
    success(res, coupons);
  } catch (error) {
    next(error);
  }
};

export const getCouponTemplates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await listCouponTemplates(true);
    success(res, templates);
  } catch (error) {
    next(error);
  }
};

export const claimUserCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await claimCoupon(req.user!.userId, req.params.templateId);
    success(res, coupon);
  } catch (error) {
    next(error);
  }
};

export const getMyWithdrawals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await listMyWithdrawals(req.user!.userId);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const applyWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const amount = Number(req.body?.moneyAmount || req.body?.amount || 0);
    const account = String(req.body?.account || '').trim();
    const result = await createWithdrawal(req.user!.userId, amount, account);
    success(res, result);
  } catch (error) {
    next(error);
  }
};



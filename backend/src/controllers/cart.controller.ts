import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { addCartItem, deleteCartItem, getUserCart, replaceUserCart, updateCartItem } from '../services/cart.service';

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getUserCart(req.user!.userId);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const putCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await replaceUserCart(req.user!.userId, req.body);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const createCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await addCartItem(req.user!.userId, req.body);
    success(res, item);
  } catch (error) {
    next(error);
  }
};

export const patchCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await updateCartItem(req.user!.userId, req.params.id, {
      quantity: typeof req.body?.quantity === 'number' ? req.body.quantity : undefined,
      selected: typeof req.body?.selected === 'boolean' ? req.body.selected : undefined,
      design: typeof req.body?.design === 'object' ? req.body.design : undefined
    });
    success(res, item);
  } catch (error) {
    next(error);
  }
};

export const removeCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteCartItem(req.user!.userId, req.params.id);
    success(res, result);
  } catch (error) {
    next(error);
  }
};


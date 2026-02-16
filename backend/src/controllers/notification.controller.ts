import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { listMyNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notification.service';

export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query?.limit || 30);
    const offset = Number(req.query?.offset || 0);
    const data = await listMyNotifications(req.user!.userId, { limit, offset });
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const readNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await markNotificationRead(req.user!.userId, req.params.id);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const readAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await markAllNotificationsRead(req.user!.userId);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

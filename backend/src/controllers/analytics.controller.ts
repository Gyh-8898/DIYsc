import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { trackEvent } from '../services/analytics.service';

export const captureEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trackEvent({
      userId: req.user?.userId,
      eventType: String(req.body?.eventType || ''),
      page: typeof req.body?.page === 'string' ? req.body.page : '',
      data: typeof req.body?.payload === 'object' && req.body?.payload !== null ? req.body.payload : {},
      ip: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : ''
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};


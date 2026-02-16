
import { Response } from 'express';

export const success = (res: Response, data: any = null, message = 'success') => {
  res.status(200).json({
    code: 0,
    message,
    data,
    timestamp: Date.now(),
  });
};


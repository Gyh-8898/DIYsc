import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { createComplaint, listUserComplaints } from '../services/complaint.service';

export const getMyComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await listUserComplaints(req.user!.userId);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const createComplaintHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const complaint = await createComplaint(req.user!.userId, {
      type: req.body?.type === 'appeal' ? 'appeal' : 'complaint',
      title: String(req.body?.title || ''),
      content: String(req.body?.content || req.body?.description || ''),
      contact: typeof req.body?.contact === 'string' ? req.body.contact : '',
      images: Array.isArray(req.body?.images) ? req.body.images : []
    });
    success(res, complaint);
  } catch (error) {
    next(error);
  }
};


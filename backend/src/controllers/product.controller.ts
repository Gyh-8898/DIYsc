import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import {
  deletePlazaDesignByAdmin,
  getAddOnsForClient,
  getInventoryTreeForClient,
  listPlazaDesigns,
  pinPlazaDesignByAdmin,
  publishDesignToPlaza,
  togglePlazaLike
} from '../services/product.service';
import { saveAddOns } from '../services/config.service';
import { writeAdminAuditLog } from '../services/audit.service';

export const getInventoryTree = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await getInventoryTreeForClient();
    success(res, tree);
  } catch (error) {
    next(error);
  }
};

export const getAddOns = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const addOns = await getAddOnsForClient();
    success(res, addOns);
  } catch (error) {
    next(error);
  }
};

export const saveAddOnList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [];
    await saveAddOns(list);
    const addOns = await getAddOnsForClient();
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'addon.batch_save',
      targetType: 'add_on',
      targetId: 'batch',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: {
        submittedCount: list.length,
        activeCount: addOns.length
      }
    });
    success(res, addOns);
  } catch (error) {
    next(error);
  }
};

export const getPlazaDesigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const designs = await listPlazaDesigns({
      query: typeof req.query.q === 'string' ? req.query.q : undefined,
      categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
      sort: typeof req.query.sort === 'string' ? (req.query.sort as any) : undefined
    });
    success(res, designs);
  } catch (error) {
    next(error);
  }
};

export const publishDesign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const design = await publishDesignToPlaza(req.user!.userId, req.body || {});
    success(res, design);
  } catch (error) {
    next(error);
  }
};

export const deletePlazaDesign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deletePlazaDesignByAdmin(req.params.id);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'plaza.delete',
      targetType: 'design',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const likePlazaDesign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const action = typeof req.body?.action === 'string' ? req.body.action : undefined;
    const result = await togglePlazaLike(req.user!.userId, req.params.id, action === 'like' || action === 'unlike' ? action : undefined);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const pinPlazaDesign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pinned = req.body?.pinned !== false;
    const result = await pinPlazaDesignByAdmin(req.params.id, pinned);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: pinned ? 'plaza.pin' : 'plaza.unpin',
      targetType: 'design',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { pinned }
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};


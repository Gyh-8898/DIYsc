import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { getAppConfig, getPublicAppConfig, getPublicBanners, saveAppConfig } from '../services/config.service';
import { writeAdminAuditLog } from '../services/audit.service';

const ALLOWED_CONFIG_KEYS = new Set([
  'appUI',
  'wristValidation',
  'announcement',
  'features',
  'business',
  'affiliate',
  'support',
  'agreements',
  'messageTemplates',
  'plazaCategories',
  'plazaPinnedIds',
  'integrations',
  'inventoryTree',
  'mediaLibrary',
  'designerUI',
  'addOns'
]);

export const getSystemConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getPublicAppConfig();
    success(res, config);
  } catch (error) {
    next(error);
  }
};

export const getAdminSystemConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getAppConfig();
    success(res, config);
  } catch (error) {
    next(error);
  }
};

export const updateSystemConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
    if (!payload) {
      throw new AppError(400121, '配置数据必须为对象', 400);
    }

    const invalidKeys = Object.keys(payload).filter((key) => !ALLOWED_CONFIG_KEYS.has(key));
    if (invalidKeys.length > 0) {
      throw new AppError(400122, `Unsupported config keys: ${invalidKeys.join(', ')}`, 400);
    }

    const before = await getAppConfig();
    const updated = await saveAppConfig(payload);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'system.config.update',
      targetType: 'system_config',
      targetId: 'app',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      beforeData: {
        changedKeys: Object.keys(payload),
        previousFeatureFlags: before.features
      },
      afterData: {
        changedKeys: Object.keys(payload),
        plazaCategoryCount: Array.isArray(updated.plazaCategories) ? updated.plazaCategories.length : 0,
        inventoryMainCategoryCount: Array.isArray(updated.inventoryTree?.mainCategories)
          ? updated.inventoryTree?.mainCategories.length
          : 0
      }
    });
    success(res, updated);
  } catch (error) {
    next(error);
  }
};

export const getBanners = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await getPublicBanners();
    success(res, banners);
  } catch (error) {
    next(error);
  }
};



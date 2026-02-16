import { NextFunction, Request, Response } from 'express';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { isQiniuConfigured, generateUploadToken, uploadBuffer } from '../services/qiniu.service';
import { getAppConfig } from '../services/config.service';

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

function normalizeImagePayload(raw: string): { mime: string; base64: string } {
  const text = String(raw || '').trim();
  const dataUrlMatch = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mime: dataUrlMatch[1].toLowerCase(),
      base64: dataUrlMatch[2]
    };
  }

  return {
    mime: 'image/png',
    base64: text
  };
}

function mimeToExt(mime: string) {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'png';
}

/**
 * POST /api/uploads/image
 * Upload image via base64 payload.
 * storage strategy:
 * - auto(default): qiniu first if configured, local fallback
 * - qiniu: force qiniu
 * - local: force local
 */
export const uploadImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = normalizeImagePayload(String(req.body?.base64 || req.body?.data || ''));
    if (!payload.base64) {
      throw new AppError(73001, '缺少图片内容', 400);
    }

    const buffer = Buffer.from(payload.base64, 'base64');
    if (!buffer.length) {
      throw new AppError(73002, '图片内容不合法', 400);
    }
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new AppError(73003, '图片过大', 400);
    }

    const ext = mimeToExt(payload.mime);
    const fileName = `img_${Date.now()}_${Math.random().toString(16).slice(2, 8)}.${ext}`;
    const preferredStorage = String(req.body?.storage || req.query?.storage || 'auto').toLowerCase();

    // Sync qiniu runtime env from saved system config before checking availability.
    await getAppConfig();
    const canUseQiniu = isQiniuConfigured();

    if (preferredStorage === 'qiniu' && !canUseQiniu) {
      throw new AppError(73011, '七牛云未配置', 400);
    }

    if (preferredStorage !== 'local' && canUseQiniu) {
      const result = await uploadBuffer(buffer, fileName, payload.mime);
      return success(res, {
        fileName,
        url: result.url,
        key: result.key,
        storage: 'qiniu'
      });
    }

    const uploadDir = path.resolve(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const relativeUrl = `/uploads/${fileName}`;
    const host = req.get('host') || 'localhost:3001';
    const scheme = req.protocol || 'http';

    success(res, {
      fileName,
      url: `${scheme}://${host}${relativeUrl}`,
      path: relativeUrl,
      storage: 'local'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/uploads/token
 * Generate a Qiniu upload token for client-side direct upload.
 */
export const getUploadToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await getAppConfig();
    if (!isQiniuConfigured()) {
      throw new AppError(73010, '云存储未配置，请使用 POST /api/uploads/image', 400);
    }

    const prefix = (req.query.prefix as string) || 'uploads';
    const tokenData = generateUploadToken(prefix);

    success(res, tokenData);
  } catch (error) {
    next(error);
  }
};


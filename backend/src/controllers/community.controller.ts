import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { success } from '../utils/response';
import {
  analyzeCommunityBazi,
  analyzeCommunityLiuyao,
  deleteCommunityReport,
  getCommunityReportById,
  getLatestCommunityDraft,
  listCommunityReports,
  recommendCommunityBeadsByTags,
  saveCommunityDraft,
  saveCommunityReportFromTrace
} from '../services/community-ai.service';

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v || '').trim()).filter(Boolean);
  }
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const analyzeBazi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const data = await analyzeCommunityBazi(userId, sessionId, req.body || {});
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const analyzeLiuyao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const data = await analyzeCommunityLiuyao(userId, sessionId, req.body || {});
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const saveDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const type = String(req.body?.type || '').trim();
    if (!type) {
      throw new AppError(400220, '缺少草稿类型', 400);
    }
    const payload = req.body?.payload ?? {};
    const data = await saveCommunityDraft(userId, sessionId, type as any, payload);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const getLatestDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const data = await getLatestCommunityDraft(userId, sessionId);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const saveReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const traceId = String(req.body?.traceId || '').trim();
    if (!traceId) {
      throw new AppError(400221, '缺少 traceId', 400);
    }
    const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
    const data = await saveCommunityReportFromTrace(userId, sessionId, traceId, title);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const listReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const list = await listCommunityReports(userId, sessionId);
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const getReportById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const data = await getCommunityReportById(userId, sessionId, req.params.id);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const deleteReportById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const data = await deleteCommunityReport(userId, sessionId, req.params.id);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const recommendBeads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = parseTags((req.query as any)?.tags);
    const data = await recommendCommunityBeadsByTags(tags);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const captureEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.communitySessionId!;
    const eventType = String(req.body?.eventType || '').trim();
    if (!eventType) {
      throw new AppError(400222, '缺少 eventType', 400);
    }
    const payload = req.body?.payload ?? null;
    await prisma.eventFunnelLog.create({
      data: {
        userId,
        sessionId,
        eventType,
        payloadJson: payload ? JSON.stringify(payload) : null
      }
    });
    success(res, { ok: true });
  } catch (error) {
    next(error);
  }
};


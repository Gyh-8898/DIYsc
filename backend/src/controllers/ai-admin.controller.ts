import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import {
  createAiModel,
  createAiPromptTemplate,
  getAiDashboard,
  getAiRouterRule,
  listAiModels,
  listAiPolicyRules,
  listAiPromptTemplates,
  listAiProviders,
  listCommunityTagMappings,
  testAiProvider,
  updateAiModel,
  updateAiPromptTemplate,
  updateAiRouterRule,
  upsertAiPolicyRule,
  upsertAiProvider,
  upsertCommunityTagMapping
} from '../services/ai-admin.service';

export const getProviders = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAiProviders();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const putProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await upsertAiProvider(req.params.provider, req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const testProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await testAiProvider(req.params.provider);
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getModels = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAiModels();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const postModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await createAiModel(req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const putModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await updateAiModel(req.params.id, req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const getRouterRules = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await getAiRouterRule();
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const putRouterRules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await updateAiRouterRule(req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const getPrompts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskType = typeof (req.query as any)?.taskType === 'string' ? String((req.query as any).taskType) : undefined;
    const rows = await listAiPromptTemplates(taskType);
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const postPrompt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await createAiPromptTemplate(req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const putPrompt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await updateAiPromptTemplate(req.params.id, req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const getPolicies = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAiPolicyRules();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const putPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await upsertAiPolicyRule(req.params.key, req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const getTagMappings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listCommunityTagMappings();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const putTagMapping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await upsertCommunityTagMapping(req.params.tag, req.body || {});
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Number((req.query as any)?.days || 7);
    const data = await getAiDashboard(days);
    success(res, data);
  } catch (error) {
    next(error);
  }
};

import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

function hasCjk(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function localizeAppErrorMessage(err: AppError): string {
  const raw = String(err.message || '').trim();
  if (!raw) {
    return '请求失败';
  }

  // If already localized, keep it.
  if (hasCjk(raw)) {
    return raw;
  }

  // Code-based overrides for key flows.
  const byCode: Record<number, string> = {
    20001: '未登录或登录已失效',
    20002: '登录状态已失效，请重新登录',
    20003: '无权限访问',
    21001: '账号或密码错误',
    21002: '缺少登录参数',
    21003: '未登录或登录已失效',
    21004: '微信登录服务暂不可用，请稍后重试',
    404: '接口不存在',
    99001: '请求过于频繁，请稍后再试'
  };
  if (byCode[err.code]) {
    return byCode[err.code];
  }

  // Status-based fallback (ensures no English leaks to UI).
  switch (err.statusCode) {
    case 400:
      return '请求参数错误';
    case 401:
      return '未登录或登录已失效';
    case 403:
      return '无权限访问';
    case 404:
      return '资源不存在';
    case 429:
      return '请求过于频繁，请稍后再试';
    case 500:
      return '服务器内部错误';
    case 503:
      return '服务暂不可用，请稍后重试';
    default:
      return '请求失败';
  }
}

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[Error]', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: localizeAppErrorMessage(err),
      data: null,
      timestamp: Date.now()
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      code: 30001,
      message: '参数校验失败',
      data: err.errors,
      timestamp: Date.now()
    });
  }

  return res.status(500).json({
    code: 50001,
    message: '服务器内部错误',
    data: process.env.NODE_ENV === 'development' ? err?.message || String(err || '') : null,
    timestamp: Date.now()
  });
};

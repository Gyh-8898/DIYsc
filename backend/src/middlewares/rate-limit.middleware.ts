import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 60 * 1000;

function pruneExpiredBuckets(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;

  for (const [key, bucket] of store.entries()) {
    if (!bucket || bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

function getClientIp(req: Request) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

export function createRateLimiter(options: RateLimitOptions) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    pruneExpiredBuckets(now);

    const ip = getClientIp(req);
    const userId = req.user?.userId || 'guest';
    const key = `${options.keyPrefix}:${userId}:${ip}`;

    const bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      store.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      return next();
    }

    if (bucket.count >= options.max) {
      return next(new AppError(99001, 'Too many requests', 429));
    }

    bucket.count += 1;
    store.set(key, bucket);
    return next();
  };
}

export const defaultRateLimit = createRateLimiter({
  keyPrefix: 'default',
  windowMs: 60 * 1000,
  max: 240
});

export const loginRateLimit = createRateLimiter({
  keyPrefix: 'login',
  windowMs: 60 * 1000,
  max: 20
});

export const orderRateLimit = createRateLimiter({
  keyPrefix: 'order',
  windowMs: 60 * 1000,
  max: 20
});

export const paymentCreateRateLimit = createRateLimiter({
  keyPrefix: 'payment_create',
  windowMs: 60 * 1000,
  max: 12
});

export const paymentNotifyRateLimit = createRateLimiter({
  keyPrefix: 'payment_notify',
  windowMs: 60 * 1000,
  max: 120
});

export const paymentMockConfirmRateLimit = createRateLimiter({
  keyPrefix: 'payment_mock_confirm',
  windowMs: 60 * 1000,
  max: 20
});

export const communityAnalysisRateLimit = createRateLimiter({
  keyPrefix: 'community_analysis',
  windowMs: 60 * 1000,
  max: 10
});

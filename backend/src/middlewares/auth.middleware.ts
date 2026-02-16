import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';

function getJwtSecret(): string {
  // NOTE: Read env at call-time so dotenv ordering does not accidentally lock a fallback secret.
  const secret = String(process.env.JWT_SECRET || '').trim();
  return secret || 'dev_secret_key';
}

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: string };
    }
  }
}

function parseBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = parseBearerToken(req);

  if (!token) {
    return next(new AppError(20001, 'Unauthorized', 401));
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; role?: string };
    req.user = {
      userId: decoded.userId,
      role: decoded.role || 'user'
    };
    return next();
  } catch (_error) {
    return next(new AppError(20002, 'Token expired or invalid', 401));
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = parseBearerToken(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; role?: string };
    req.user = {
      userId: decoded.userId,
      role: decoded.role || 'user'
    };
  } catch (_error) {
    // best-effort only; unauthenticated requests remain allowed
  }

  return next();
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(20001, 'Unauthorized', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(20003, 'Forbidden', 403));
    }

    return next();
  };
};

export const signJwt = (payload: { userId: string; role: string }) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
};

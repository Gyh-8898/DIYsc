import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

declare global {
  namespace Express {
    interface Request {
      communitySessionId?: string;
    }
  }
}

function normalizeSessionId(raw: unknown) {
  const id = String(raw || "").trim();
  if (!id) return "";
  if (id.length > 64) return "";
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return "";
  return id;
}

export function requireCommunitySession(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers["x-community-session-id"] ?? req.headers["x-session-id"];
  const sessionId = normalizeSessionId(raw);
  if (!sessionId) {
    return next(new AppError(400201, "Missing or invalid sessionId", 400));
  }
  req.communitySessionId = sessionId;
  return next();
}

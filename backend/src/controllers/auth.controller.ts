import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';
import { signJwt } from '../middlewares/auth.middleware';
import { generateReferralCode, getUserDtoById, mapRole } from '../services/user.service';

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 24);
}

async function exchangeCodeForOpenId(code: string): Promise<string | null> {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;

  if (!appid || !secret) {
    return null;
  }

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { openid?: string; errcode?: number; errmsg?: string };
    if (!data.openid) {
      return null;
    }

    return data.openid;
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildUniqueReferralCode(seed: string): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const code = generateReferralCode(`${seed}${i}`);
    const exists = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  return generateReferralCode(`${seed}${Date.now()}`);
}

async function ensureAdminUser() {
  const adminOpenId = 'admin_openid';
  const existing = await prisma.user.findUnique({ where: { openid: adminOpenId } });
  if (existing) return existing;

  const referralCode = await buildUniqueReferralCode('ADMIN');

  return prisma.user.create({
    data: {
      openid: adminOpenId,
      name: '平台管理员',
      avatar: '',
      role: 'admin',
      levelName: '管理员',
      referralCode
    }
  });
}

export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username !== expectedUsername || password !== expectedPassword) {
      throw new AppError(21001, '账号或密码错误', 401);
    }

    const admin = await ensureAdminUser();

    await prisma.user.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date()
      }
    });

    const token = signJwt({
      userId: admin.id,
      role: mapRole(admin.role)
    });

    const user = await getUserDtoById(admin.id);
    success(res, { token, user });
  } catch (error) {
    next(error);
  }
};

export const wechatLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      code,
      devOpenId,
      referralCode,
      nickname,
      avatar
    } = req.body as {
      code?: string;
      devOpenId?: string;
      referralCode?: string;
      nickname?: string;
      avatar?: string;
    };

    if (!code && !devOpenId) {
      throw new AppError(21002, '缺少登录 code', 400);
    }

    let openid = '';
    if (code) {
      const officialOpenId = await exchangeCodeForOpenId(code);
      if (officialOpenId) {
        openid = officialOpenId;
      }
    }

    if (!openid) {
      if (devOpenId) {
        openid = `dev_${devOpenId}`;
      } else {
        if (process.env.NODE_ENV === 'production') {
          throw new AppError(21004, '微信登录配置缺失', 503);
        }
        openid = `dev_${hash(code || `guest_${Date.now()}`)}`;
      }
    }

    const normalizedReferralCode = String(referralCode || '').trim().toUpperCase();
    let referredUserId: string | undefined;
    if (normalizedReferralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: normalizedReferralCode },
        select: { id: true }
      });
      if (referrer) {
        referredUserId = referrer.id;
      }
    }

    let user = await prisma.user.findUnique({ where: { openid } });

    if (!user) {
      const seed = (nickname || openid).slice(0, 8);
      const generatedCode = await buildUniqueReferralCode(seed);

      user = await prisma.user.create({
        data: {
          openid,
          name: nickname || `User${Date.now().toString().slice(-4)}`,
          avatar: avatar || '',
          points: 100,
          referrerId: referredUserId,
          referralCode: generatedCode,
          role: 'user',
          lastLoginAt: new Date()
        }
      });

      await prisma.pointLog.create({
        data: {
          userId: user.id,
          amount: 100,
          type: 'bonus',
          reason: '新用户注册奖励'
        }
      });
    } else {
      const nextData: {
        name: string;
        avatar: string;
        lastLoginAt: Date;
        referrerId?: string;
      } = {
        name: nickname || user.name,
        avatar: avatar || user.avatar,
        lastLoginAt: new Date()
      };
      if (!user.referrerId && referredUserId && referredUserId !== user.id) {
        nextData.referrerId = referredUserId;
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: nextData
      });
    }

    const token = signJwt({
      userId: user.id,
      role: mapRole(user.role)
    });

    const userDto = await getUserDtoById(user.id);
    success(res, { token, user: userDto });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(21003, '未登录', 401);
    const user = await getUserDtoById(req.user.userId);
    success(res, user);
  } catch (error) {
    next(error);
  }
};



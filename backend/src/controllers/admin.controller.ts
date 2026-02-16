import { NextFunction, Request, Response } from 'express';
import { success } from '../utils/response';
import { getOrdersForAdmin, shipOrderByAdmin } from '../services/order.service';
import { getPointHistory, getUserAddresses, listUsersForAdmin } from '../services/user.service';
import { getAdminComplaintDetail, listAdminComplaints, updateComplaintStatus } from '../services/complaint.service';
import { approveWithdrawal, listAdminWithdrawals, rejectWithdrawal } from '../services/affiliate.service';
import {
  createCouponTemplate,
  getCouponIssueStats,
  issueCouponsToUsers,
  listCouponTemplates,
  updateCouponTemplate
} from '../services/coupon.service';
import { getAnalyticsOverview } from '../services/analytics.service';
import { prisma } from '../lib/prisma';
import { listAdminAuditLogs, writeAdminAuditLog } from '../services/audit.service';
import { getAdminOpsSelfCheck } from '../services/ops.service';
import {
  createAdminPointsGrant,
  getAdminPointsDashboard,
  listAdminPointsCampaigns,
  listAdminPointsGrantTasks,
  listAdminPointsLedger,
  listAdminPointsRiskRules,
  listAdminPointsRules,
  saveAdminPointsCampaign,
  saveAdminPointsRiskRule,
  saveAdminPointsRule,
  toggleAdminPointsCampaign,
  toggleAdminPointsRiskRule,
  toggleAdminPointsRule
} from '../services/points-admin.service';

export const getAdminOrders = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getOrdersForAdmin();
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const shipAdminOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const carrier = String(req.body?.carrier || '');
    const trackingNumber = String(req.body?.trackingNumber || '');
    const result = await shipOrderByAdmin(req.params.id, carrier, trackingNumber);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'order.ship',
      targetType: 'order',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { carrier, trackingNumber }
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getAdminUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await listUsersForAdmin();
    success(res, users);
  } catch (error) {
    next(error);
  }
};

export const getAdminUserPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const points = await getPointHistory(req.params.id);
    success(res, points);
  } catch (error) {
    next(error);
  }
};

export const getAdminUserAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const addresses = await getUserAddresses(req.params.id);
    success(res, addresses);
  } catch (error) {
    next(error);
  }
};

export const getAdminUserOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.order.findMany({
      where: { userId: req.params.id },
      include: {
        user: {
          select: {
            name: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const data = rows.map((order) => {
      let items: unknown[] = [];
      try {
        items = JSON.parse(order.items || '[]');
      } catch (_error) {
        items = [];
      }

      return {
        id: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
        userName: order.user?.name || '',
        userAvatar: order.user?.avatar || '',
        items,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        createdAt: new Date(order.createdAt).getTime(),
        shippingAddress: order.shippingAddress,
        trackingNumber: order.trackingNumber || '',
        carrier: order.carrier || '',
        shippedAt: order.shippedAt ? new Date(order.shippedAt).getTime() : undefined
      };
    });

    success(res, data);
  } catch (error) {
    next(error);
  }
};

export const getAdminComplaints = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const complaints = await listAdminComplaints();
    success(res, complaints);
  } catch (error) {
    next(error);
  }
};

export const getAdminComplaintById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const complaint = await getAdminComplaintDetail(req.params.id);
    success(res, complaint);
  } catch (error) {
    next(error);
  }
};

export const resolveAdminComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.body?.status || 'resolved';
    const reply = typeof req.body?.reply === 'string' ? req.body.reply : '';
    const updated = await updateComplaintStatus(req.params.id, {
      status,
      reply
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'complaint.update',
      targetType: 'complaint',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { status, hasReply: Boolean(reply) }
    });
    success(res, updated);
  } catch (error) {
    next(error);
  }
};

export const getAdminWithdrawals = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await listAdminWithdrawals();
    success(res, list);
  } catch (error) {
    next(error);
  }
};

export const approveAdminWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await approveWithdrawal(req.params.id);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'withdrawal.approve',
      targetType: 'withdrawal',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const rejectAdminWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Rejected by admin';
    const result = await rejectWithdrawal(req.params.id, reason);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'withdrawal.reject',
      targetType: 'withdrawal',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { reason }
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getAdminCouponTemplates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await listCouponTemplates(false);
    success(res, templates);
  } catch (error) {
    next(error);
  }
};

export const createAdminCouponTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await createCouponTemplate({
      name: String(req.body?.name || ''),
      description: String(req.body?.description || ''),
      discountType: req.body?.discountType === 'percent' ? 'percent' : 'fixed',
      discountValue: Number(req.body?.discountValue || 0),
      minAmount: Number(req.body?.minAmount || 0),
      totalCount: Number(req.body?.totalCount || 0),
      perUserLimit: Number(req.body?.perUserLimit || 1),
      status: Number(req.body?.status ?? 1),
      startAt: Number(req.body?.startAt || Date.now()),
      endAt: Number(req.body?.endAt || Date.now() + 7 * 24 * 3600 * 1000)
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'coupon.template.create',
      targetType: 'coupon_template',
      targetId: template.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { name: template.name, discountType: template.discountType, discountValue: template.discountValue }
    });
    success(res, template);
  } catch (error) {
    next(error);
  }
};

export const updateAdminCouponTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await updateCouponTemplate(req.params.id, {
      name: req.body?.name,
      description: req.body?.description,
      discountType: req.body?.discountType,
      discountValue: req.body?.discountValue,
      minAmount: req.body?.minAmount,
      totalCount: req.body?.totalCount,
      perUserLimit: req.body?.perUserLimit,
      status: req.body?.status,
      startAt: req.body?.startAt,
      endAt: req.body?.endAt
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'coupon.template.update',
      targetType: 'coupon_template',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: {
        name: template.name,
        discountType: template.discountType,
        discountValue: template.discountValue,
        status: template.status
      }
    });
    success(res, template);
  } catch (error) {
    next(error);
  }
};

export const getAdminAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Number((_req.query as any)?.days || 7);
    const overview = await getAnalyticsOverview({ days });
    success(res, overview);
  } catch (error) {
    next(error);
  }
};

export const issueAdminCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await issueCouponsToUsers({
      templateId: String(req.body?.templateId || ''),
      mode: req.body?.mode === 'all' || req.body?.mode === 'level' ? req.body.mode : 'specific',
      userIds: Array.isArray(req.body?.userIds) ? req.body.userIds : [],
      levelId: Number(req.body?.levelId || 0)
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'coupon.issue',
      targetType: 'coupon_template',
      targetId: String(req.body?.templateId || ''),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: {
        mode: req.body?.mode,
        levelId: Number(req.body?.levelId || 0),
        requestedUserCount: Array.isArray(req.body?.userIds) ? req.body.userIds.length : 0,
        result
      }
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getAdminCouponStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getCouponIssueStats();
    success(res, stats);
  } catch (error) {
    next(error);
  }
};

export const getAdminOpsCheck = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await getAdminOpsSelfCheck();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const getAdminAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query?.limit || 100);
    const rows = await listAdminAuditLogs(limit);
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const getAdminPointsRules = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAdminPointsRules();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const createAdminPointsRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await saveAdminPointsRule({
      name: String(req.body?.name || ''),
      eventType: String(req.body?.eventType || ''),
      rewardMode: req.body?.rewardMode === 'rate' ? 'rate' : 'fixed',
      rewardValue: Number(req.body?.rewardValue || 0),
      maxPerUserDay: Number(req.body?.maxPerUserDay || 0),
      maxPerUserTotal: Number(req.body?.maxPerUserTotal || 0),
      cooldownMinutes: Number(req.body?.cooldownMinutes || 0),
      stackMode: req.body?.stackMode === 'exclusive' ? 'exclusive' : 'stack',
      scopeType: req.body?.scopeType,
      scopeValue: String(req.body?.scopeValue || ''),
      minOrderAmount: Number(req.body?.minOrderAmount || 0),
      maxOrderAmount: Number(req.body?.maxOrderAmount || 0),
      minUserLevel: Number(req.body?.minUserLevel || 0),
      maxUserLevel: Number(req.body?.maxUserLevel || 0),
      newUserWithinDays: Number(req.body?.newUserWithinDays || 0),
      requireReferral: Boolean(req.body?.requireReferral),
      requireFirstOrder: Boolean(req.body?.requireFirstOrder),
      weekdays: String(req.body?.weekdays || ''),
      allowedChannels: String(req.body?.allowedChannels || ''),
      extraConditions: String(req.body?.extraConditions || ''),
      validStart: Number(req.body?.validStart || 0),
      validEnd: Number(req.body?.validEnd || 0),
      status: Number(req.body?.status ?? 1) === 1 ? 1 : 0,
      remark: String(req.body?.remark || '')
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.rule.create',
      targetType: 'points_rule',
      targetId: row.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: row
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const updateAdminPointsRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await saveAdminPointsRule({
      id: req.params.id,
      name: String(req.body?.name || ''),
      eventType: String(req.body?.eventType || ''),
      rewardMode: req.body?.rewardMode === 'rate' ? 'rate' : 'fixed',
      rewardValue: Number(req.body?.rewardValue || 0),
      maxPerUserDay: Number(req.body?.maxPerUserDay || 0),
      maxPerUserTotal: Number(req.body?.maxPerUserTotal || 0),
      cooldownMinutes: Number(req.body?.cooldownMinutes || 0),
      stackMode: req.body?.stackMode === 'exclusive' ? 'exclusive' : 'stack',
      scopeType: req.body?.scopeType,
      scopeValue: String(req.body?.scopeValue || ''),
      minOrderAmount: Number(req.body?.minOrderAmount || 0),
      maxOrderAmount: Number(req.body?.maxOrderAmount || 0),
      minUserLevel: Number(req.body?.minUserLevel || 0),
      maxUserLevel: Number(req.body?.maxUserLevel || 0),
      newUserWithinDays: Number(req.body?.newUserWithinDays || 0),
      requireReferral: Boolean(req.body?.requireReferral),
      requireFirstOrder: Boolean(req.body?.requireFirstOrder),
      weekdays: String(req.body?.weekdays || ''),
      allowedChannels: String(req.body?.allowedChannels || ''),
      extraConditions: String(req.body?.extraConditions || ''),
      validStart: Number(req.body?.validStart || 0),
      validEnd: Number(req.body?.validEnd || 0),
      status: Number(req.body?.status ?? 1) === 1 ? 1 : 0,
      remark: String(req.body?.remark || '')
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.rule.update',
      targetType: 'points_rule',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: row
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const togglePointsRuleStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const row = await toggleAdminPointsRule(req.params.id, enabled);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.rule.toggle',
      targetType: 'points_rule',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { enabled }
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const getAdminPointsCampaigns = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAdminPointsCampaigns();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const createAdminPointsCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await saveAdminPointsCampaign({
      name: String(req.body?.name || ''),
      campaignType: String(req.body?.campaignType || 'general'),
      ruleIds: Array.isArray(req.body?.ruleIds) ? req.body.ruleIds : [],
      budgetTotalPoints: Number(req.body?.budgetTotalPoints || 0),
      budgetDailyPoints: Number(req.body?.budgetDailyPoints || 0),
      userCapPoints: Number(req.body?.userCapPoints || 0),
      audienceType: req.body?.audienceType,
      audienceValue: String(req.body?.audienceValue || ''),
      status: Number(req.body?.status ?? 1) === 1 ? 1 : 0,
      startAt: Number(req.body?.startAt || 0),
      endAt: Number(req.body?.endAt || 0),
      spentPoints: Number(req.body?.spentPoints || 0)
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.campaign.create',
      targetType: 'points_campaign',
      targetId: row.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: row
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const updateAdminPointsCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await saveAdminPointsCampaign({
      id: req.params.id,
      name: String(req.body?.name || ''),
      campaignType: String(req.body?.campaignType || 'general'),
      ruleIds: Array.isArray(req.body?.ruleIds) ? req.body.ruleIds : [],
      budgetTotalPoints: Number(req.body?.budgetTotalPoints || 0),
      budgetDailyPoints: Number(req.body?.budgetDailyPoints || 0),
      userCapPoints: Number(req.body?.userCapPoints || 0),
      audienceType: req.body?.audienceType,
      audienceValue: String(req.body?.audienceValue || ''),
      status: Number(req.body?.status ?? 1) === 1 ? 1 : 0,
      startAt: Number(req.body?.startAt || 0),
      endAt: Number(req.body?.endAt || 0),
      spentPoints: Number(req.body?.spentPoints || 0)
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.campaign.update',
      targetType: 'points_campaign',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: row
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const togglePointsCampaignStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const row = await toggleAdminPointsCampaign(req.params.id, enabled);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.campaign.toggle',
      targetType: 'points_campaign',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { enabled }
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const getAdminPointsRiskRules = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAdminPointsRiskRules();
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const createAdminPointsRiskRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await saveAdminPointsRiskRule({
      name: String(req.body?.name || ''),
      eventType: String(req.body?.eventType || 'all'),
      freqLimit: Number(req.body?.freqLimit || 0),
      dailyLimit: Number(req.body?.dailyLimit || 0),
      deviceLimit: Number(req.body?.deviceLimit || 0),
      ipLimit: Number(req.body?.ipLimit || 0),
      blacklistEnabled: Boolean(req.body?.blacklistEnabled),
      hitAction: req.body?.hitAction,
      status: Number(req.body?.status ?? 1) === 1 ? 1 : 0,
      remark: String(req.body?.remark || '')
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.risk.create',
      targetType: 'points_risk_rule',
      targetId: row.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: row
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const updateAdminPointsRiskRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await saveAdminPointsRiskRule({
      id: req.params.id,
      name: String(req.body?.name || ''),
      eventType: String(req.body?.eventType || 'all'),
      freqLimit: Number(req.body?.freqLimit || 0),
      dailyLimit: Number(req.body?.dailyLimit || 0),
      deviceLimit: Number(req.body?.deviceLimit || 0),
      ipLimit: Number(req.body?.ipLimit || 0),
      blacklistEnabled: Boolean(req.body?.blacklistEnabled),
      hitAction: req.body?.hitAction,
      status: Number(req.body?.status ?? 1) === 1 ? 1 : 0,
      remark: String(req.body?.remark || '')
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.risk.update',
      targetType: 'points_risk_rule',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: row
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const togglePointsRiskRuleStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const row = await toggleAdminPointsRiskRule(req.params.id, enabled);
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.risk.toggle',
      targetType: 'points_risk_rule',
      targetId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: { enabled }
    });
    success(res, row);
  } catch (error) {
    next(error);
  }
};

export const createAdminPointsGrantTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createAdminPointsGrant({
      grantType: req.body?.grantType,
      targetType: req.body?.targetType,
      userIds: Array.isArray(req.body?.userIds) ? req.body.userIds : [],
      levelId: Number(req.body?.levelId || 0),
      points: Number(req.body?.points || 0),
      reasonCode: String(req.body?.reasonCode || ''),
      remark: String(req.body?.remark || ''),
      operatorUserId: req.user?.userId
    });
    await writeAdminAuditLog({
      actorUserId: req.user?.userId,
      action: 'points.grant.create',
      targetType: 'points_grant_task',
      targetId: result.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      afterData: result
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const getAdminPointsGrantTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query?.limit || 50);
    const rows = await listAdminPointsGrantTasks(limit);
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const getAdminPointsLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAdminPointsLedger({
      userId: typeof req.query?.userId === 'string' ? req.query.userId : '',
      type: typeof req.query?.type === 'string' ? req.query.type : '',
      dateFrom: Number(req.query?.dateFrom || 0),
      dateTo: Number(req.query?.dateTo || 0),
      limit: Number(req.query?.limit || 200)
    });
    success(res, rows);
  } catch (error) {
    next(error);
  }
};

export const getAdminPointsDashboardView = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Number(req.query?.days || 7);
    const data = await getAdminPointsDashboard(days);
    success(res, data);
  } catch (error) {
    next(error);
  }
};


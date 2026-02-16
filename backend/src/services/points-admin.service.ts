import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export type PointsRuleStatus = 0 | 1;
export type PointsCampaignStatus = 0 | 1;
export type PointsRiskRuleStatus = 0 | 1;

export interface AdminPointsRule {
  id: string;
  name: string;
  eventType: string;
  rewardMode: 'fixed' | 'rate';
  rewardValue: number;
  maxPerUserDay: number;
  maxPerUserTotal: number;
  cooldownMinutes: number;
  stackMode: 'stack' | 'exclusive';
  scopeType: 'all' | 'new_user' | 'level' | 'tag' | 'user';
  scopeValue: string;
  minOrderAmount: number;
  maxOrderAmount: number;
  minUserLevel: number;
  maxUserLevel: number;
  newUserWithinDays: number;
  requireReferral: boolean;
  requireFirstOrder: boolean;
  weekdays: string;
  allowedChannels: string;
  extraConditions: string;
  validStart: number;
  validEnd: number;
  status: PointsRuleStatus;
  remark: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminPointsCampaign {
  id: string;
  name: string;
  campaignType: string;
  ruleIds: string[];
  budgetTotalPoints: number;
  budgetDailyPoints: number;
  userCapPoints: number;
  audienceType: 'all' | 'level' | 'tag' | 'user';
  audienceValue: string;
  status: PointsCampaignStatus;
  startAt: number;
  endAt: number;
  spentPoints: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminPointsRiskRule {
  id: string;
  name: string;
  eventType: string;
  freqLimit: number;
  dailyLimit: number;
  deviceLimit: number;
  ipLimit: number;
  blacklistEnabled: boolean;
  hitAction: 'block' | 'downgrade' | 'review';
  status: PointsRiskRuleStatus;
  remark: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminPointsGrantTask {
  id: string;
  grantType: 'add' | 'deduct' | 'freeze' | 'unfreeze';
  targetType: 'user' | 'level' | 'all';
  targetCount: number;
  points: number;
  reasonCode: string;
  remark: string;
  status: 'completed' | 'partial' | 'failed';
  successCount: number;
  failureCount: number;
  resultSummary: string;
  createdAt: number;
  operatorUserId: string;
}

export interface AdminPointsLedgerRow {
  id: string;
  userId: string;
  userName: string;
  type: string;
  amount: number;
  reason: string;
  bizId: string;
  createdAt: number;
}

export interface AdminPointsDashboard {
  kpis: {
    issuedToday: number;
    redeemedToday: number;
    activeUsers7d: number;
    pointsPool: number;
    activeCampaigns: number;
    enabledRules: number;
  };
  trends: {
    labels: string[];
    issued: number[];
    redeemed: number[];
    activeUsers: number[];
  };
}

let tablesEnsured = false;

function nowTs() {
  return Date.now();
}

function startOfDayTs(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toNum(input: unknown, fallback = 0) {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(input: unknown) {
  if (typeof input === 'boolean') return input;
  const raw = String(input ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

async function ensureSqliteColumns(
  tableName: string,
  columns: Array<{ name: string; ddl: string }>
) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${tableName}")`);
  const existing = new Set(rows.map((row) => String(row.name)));
  for (const col of columns) {
    if (!existing.has(col.name)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN ${col.ddl}`);
    }
  }
}

function parseJsonArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || '')).filter((item) => Boolean(item));
  } catch (_error) {
    return [];
  }
}

async function ensurePointsAdminTables() {
  if (tablesEnsured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PointsRule" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "rewardMode" TEXT NOT NULL DEFAULT 'fixed',
      "rewardValue" REAL NOT NULL DEFAULT 0,
      "maxPerUserDay" INTEGER NOT NULL DEFAULT 0,
      "maxPerUserTotal" INTEGER NOT NULL DEFAULT 0,
      "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
      "stackMode" TEXT NOT NULL DEFAULT 'stack',
      "scopeType" TEXT NOT NULL DEFAULT 'all',
      "scopeValue" TEXT NOT NULL DEFAULT '',
      "minOrderAmount" REAL NOT NULL DEFAULT 0,
      "maxOrderAmount" REAL NOT NULL DEFAULT 0,
      "minUserLevel" INTEGER NOT NULL DEFAULT 0,
      "maxUserLevel" INTEGER NOT NULL DEFAULT 0,
      "newUserWithinDays" INTEGER NOT NULL DEFAULT 0,
      "requireReferral" INTEGER NOT NULL DEFAULT 0,
      "requireFirstOrder" INTEGER NOT NULL DEFAULT 0,
      "weekdays" TEXT NOT NULL DEFAULT '',
      "allowedChannels" TEXT NOT NULL DEFAULT '',
      "extraConditions" TEXT NOT NULL DEFAULT '',
      "validStart" INTEGER NOT NULL DEFAULT 0,
      "validEnd" INTEGER NOT NULL DEFAULT 0,
      "status" INTEGER NOT NULL DEFAULT 1,
      "remark" TEXT NOT NULL DEFAULT '',
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PointsRule_eventType_status_idx" ON "PointsRule"("eventType","status");`);
  await ensureSqliteColumns('PointsRule', [
    { name: 'cooldownMinutes', ddl: '"cooldownMinutes" INTEGER NOT NULL DEFAULT 0' },
    { name: 'minOrderAmount', ddl: '"minOrderAmount" REAL NOT NULL DEFAULT 0' },
    { name: 'maxOrderAmount', ddl: '"maxOrderAmount" REAL NOT NULL DEFAULT 0' },
    { name: 'minUserLevel', ddl: '"minUserLevel" INTEGER NOT NULL DEFAULT 0' },
    { name: 'maxUserLevel', ddl: '"maxUserLevel" INTEGER NOT NULL DEFAULT 0' },
    { name: 'newUserWithinDays', ddl: '"newUserWithinDays" INTEGER NOT NULL DEFAULT 0' },
    { name: 'requireReferral', ddl: '"requireReferral" INTEGER NOT NULL DEFAULT 0' },
    { name: 'requireFirstOrder', ddl: '"requireFirstOrder" INTEGER NOT NULL DEFAULT 0' },
    { name: 'weekdays', ddl: '"weekdays" TEXT NOT NULL DEFAULT \'\'' },
    { name: 'allowedChannels', ddl: '"allowedChannels" TEXT NOT NULL DEFAULT \'\'' },
    { name: 'extraConditions', ddl: '"extraConditions" TEXT NOT NULL DEFAULT \'\'' }
  ]);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PointsCampaign" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "campaignType" TEXT NOT NULL,
      "ruleIds" TEXT NOT NULL DEFAULT '[]',
      "budgetTotalPoints" INTEGER NOT NULL DEFAULT 0,
      "budgetDailyPoints" INTEGER NOT NULL DEFAULT 0,
      "userCapPoints" INTEGER NOT NULL DEFAULT 0,
      "audienceType" TEXT NOT NULL DEFAULT 'all',
      "audienceValue" TEXT NOT NULL DEFAULT '',
      "status" INTEGER NOT NULL DEFAULT 1,
      "startAt" INTEGER NOT NULL DEFAULT 0,
      "endAt" INTEGER NOT NULL DEFAULT 0,
      "spentPoints" INTEGER NOT NULL DEFAULT 0,
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PointsCampaign_status_time_idx" ON "PointsCampaign"("status","startAt","endAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PointsRiskRule" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "freqLimit" INTEGER NOT NULL DEFAULT 0,
      "dailyLimit" INTEGER NOT NULL DEFAULT 0,
      "deviceLimit" INTEGER NOT NULL DEFAULT 0,
      "ipLimit" INTEGER NOT NULL DEFAULT 0,
      "blacklistEnabled" INTEGER NOT NULL DEFAULT 0,
      "hitAction" TEXT NOT NULL DEFAULT 'review',
      "status" INTEGER NOT NULL DEFAULT 1,
      "remark" TEXT NOT NULL DEFAULT '',
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PointsRiskRule_eventType_status_idx" ON "PointsRiskRule"("eventType","status");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PointsGrantTask" (
      "id" TEXT PRIMARY KEY,
      "grantType" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetCount" INTEGER NOT NULL DEFAULT 0,
      "points" INTEGER NOT NULL DEFAULT 0,
      "reasonCode" TEXT NOT NULL DEFAULT '',
      "remark" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'completed',
      "successCount" INTEGER NOT NULL DEFAULT 0,
      "failureCount" INTEGER NOT NULL DEFAULT 0,
      "resultSummary" TEXT NOT NULL DEFAULT '',
      "createdAt" INTEGER NOT NULL,
      "operatorUserId" TEXT NOT NULL DEFAULT ''
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PointsGrantTask_createdAt_idx" ON "PointsGrantTask"("createdAt");`);

  tablesEnsured = true;
}

function mapRuleRow(row: any): AdminPointsRule {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    eventType: String(row.eventType || ''),
    rewardMode: String(row.rewardMode || 'fixed') === 'rate' ? 'rate' : 'fixed',
    rewardValue: toNum(row.rewardValue, 0),
    maxPerUserDay: toNum(row.maxPerUserDay, 0),
    maxPerUserTotal: toNum(row.maxPerUserTotal, 0),
    cooldownMinutes: toNum(row.cooldownMinutes, 0),
    stackMode: String(row.stackMode || 'stack') === 'exclusive' ? 'exclusive' : 'stack',
    scopeType: (['all', 'new_user', 'level', 'tag', 'user'].includes(String(row.scopeType || 'all'))
      ? String(row.scopeType || 'all')
      : 'all') as AdminPointsRule['scopeType'],
    scopeValue: String(row.scopeValue || ''),
    minOrderAmount: toNum(row.minOrderAmount, 0),
    maxOrderAmount: toNum(row.maxOrderAmount, 0),
    minUserLevel: toNum(row.minUserLevel, 0),
    maxUserLevel: toNum(row.maxUserLevel, 0),
    newUserWithinDays: toNum(row.newUserWithinDays, 0),
    requireReferral: Number(row.requireReferral || 0) === 1,
    requireFirstOrder: Number(row.requireFirstOrder || 0) === 1,
    weekdays: String(row.weekdays || ''),
    allowedChannels: String(row.allowedChannels || ''),
    extraConditions: String(row.extraConditions || ''),
    validStart: toNum(row.validStart, 0),
    validEnd: toNum(row.validEnd, 0),
    status: Number(row.status || 0) === 1 ? 1 : 0,
    remark: String(row.remark || ''),
    createdAt: toNum(row.createdAt, 0),
    updatedAt: toNum(row.updatedAt, 0)
  };
}

function mapCampaignRow(row: any): AdminPointsCampaign {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    campaignType: String(row.campaignType || 'general'),
    ruleIds: parseJsonArray(String(row.ruleIds || '[]')),
    budgetTotalPoints: toNum(row.budgetTotalPoints, 0),
    budgetDailyPoints: toNum(row.budgetDailyPoints, 0),
    userCapPoints: toNum(row.userCapPoints, 0),
    audienceType: (['all', 'level', 'tag', 'user'].includes(String(row.audienceType || 'all'))
      ? String(row.audienceType || 'all')
      : 'all') as AdminPointsCampaign['audienceType'],
    audienceValue: String(row.audienceValue || ''),
    status: Number(row.status || 0) === 1 ? 1 : 0,
    startAt: toNum(row.startAt, 0),
    endAt: toNum(row.endAt, 0),
    spentPoints: toNum(row.spentPoints, 0),
    createdAt: toNum(row.createdAt, 0),
    updatedAt: toNum(row.updatedAt, 0)
  };
}

function mapRiskRuleRow(row: any): AdminPointsRiskRule {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    eventType: String(row.eventType || 'all'),
    freqLimit: toNum(row.freqLimit, 0),
    dailyLimit: toNum(row.dailyLimit, 0),
    deviceLimit: toNum(row.deviceLimit, 0),
    ipLimit: toNum(row.ipLimit, 0),
    blacklistEnabled: Number(row.blacklistEnabled || 0) === 1,
    hitAction: (['block', 'downgrade', 'review'].includes(String(row.hitAction || 'review'))
      ? String(row.hitAction || 'review')
      : 'review') as AdminPointsRiskRule['hitAction'],
    status: Number(row.status || 0) === 1 ? 1 : 0,
    remark: String(row.remark || ''),
    createdAt: toNum(row.createdAt, 0),
    updatedAt: toNum(row.updatedAt, 0)
  };
}

export async function listAdminPointsRules(): Promise<AdminPointsRule[]> {
  await ensurePointsAdminTables();
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsRule" ORDER BY "updatedAt" DESC`;
  return rows.map(mapRuleRow);
}

export async function saveAdminPointsRule(
  payload: Partial<AdminPointsRule> & { id?: string; name: string; eventType: string }
): Promise<AdminPointsRule> {
  await ensurePointsAdminTables();
  const id = String(payload.id || randomUUID());
  const ts = nowTs();
  const status: PointsRuleStatus = Number(payload.status || 1) === 1 ? 1 : 0;
  const rewardMode = payload.rewardMode === 'rate' ? 'rate' : 'fixed';
  const stackMode = payload.stackMode === 'exclusive' ? 'exclusive' : 'stack';
  const scopeType = (['all', 'new_user', 'level', 'tag', 'user'].includes(String(payload.scopeType || 'all'))
    ? String(payload.scopeType || 'all')
    : 'all') as AdminPointsRule['scopeType'];
  const minOrderAmount = Math.max(0, toNum(payload.minOrderAmount, 0));
  const maxOrderAmount = Math.max(0, toNum(payload.maxOrderAmount, 0));
  const minUserLevel = Math.max(0, Math.floor(toNum(payload.minUserLevel, 0)));
  const maxUserLevel = Math.max(0, Math.floor(toNum(payload.maxUserLevel, 0)));
  const newUserWithinDays = Math.max(0, Math.floor(toNum(payload.newUserWithinDays, 0)));
  const cooldownMinutes = Math.max(0, Math.floor(toNum(payload.cooldownMinutes, 0)));
  const requireReferral = toBool(payload.requireReferral);
  const requireFirstOrder = toBool(payload.requireFirstOrder);
  const weekdays = String(payload.weekdays || '').trim();
  const allowedChannels = String(payload.allowedChannels || '').trim();
  const extraConditions = String(payload.extraConditions || '').trim();

  if (!String(payload.name || '').trim()) {
    throw new AppError(72001, '规则名称不能为空', 400);
  }

  if (!String(payload.eventType || '').trim()) {
    throw new AppError(72002, '事件类型不能为空', 400);
  }

  if (maxOrderAmount > 0 && maxOrderAmount < minOrderAmount) {
    throw new AppError(72004, '最大订单金额必须大于等于最小订单金额', 400);
  }
  if (maxUserLevel > 0 && maxUserLevel < minUserLevel) {
    throw new AppError(72005, '最大用户等级必须大于等于最小用户等级', 400);
  }
  if (toNum(payload.validStart, 0) > 0 && toNum(payload.validEnd, 0) > 0 && toNum(payload.validEnd, 0) < toNum(payload.validStart, 0)) {
    throw new AppError(72006, '结束时间必须大于等于开始时间', 400);
  }

  await prisma.$executeRaw`
    INSERT INTO "PointsRule"
    ("id","name","eventType","rewardMode","rewardValue","maxPerUserDay","maxPerUserTotal","cooldownMinutes","stackMode","scopeType","scopeValue","minOrderAmount","maxOrderAmount","minUserLevel","maxUserLevel","newUserWithinDays","requireReferral","requireFirstOrder","weekdays","allowedChannels","extraConditions","validStart","validEnd","status","remark","createdAt","updatedAt")
    VALUES
    (${id}, ${String(payload.name || '').trim()}, ${String(payload.eventType || '').trim()}, ${rewardMode}, ${toNum(payload.rewardValue, 0)}, ${toNum(payload.maxPerUserDay, 0)}, ${toNum(payload.maxPerUserTotal, 0)}, ${cooldownMinutes}, ${stackMode}, ${scopeType}, ${String(payload.scopeValue || '')}, ${minOrderAmount}, ${maxOrderAmount}, ${minUserLevel}, ${maxUserLevel}, ${newUserWithinDays}, ${requireReferral ? 1 : 0}, ${requireFirstOrder ? 1 : 0}, ${weekdays}, ${allowedChannels}, ${extraConditions}, ${toNum(payload.validStart, 0)}, ${toNum(payload.validEnd, 0)}, ${status}, ${String(payload.remark || '')}, ${ts}, ${ts})
    ON CONFLICT("id") DO UPDATE SET
      "name" = excluded."name",
      "eventType" = excluded."eventType",
      "rewardMode" = excluded."rewardMode",
      "rewardValue" = excluded."rewardValue",
      "maxPerUserDay" = excluded."maxPerUserDay",
      "maxPerUserTotal" = excluded."maxPerUserTotal",
      "cooldownMinutes" = excluded."cooldownMinutes",
      "stackMode" = excluded."stackMode",
      "scopeType" = excluded."scopeType",
      "scopeValue" = excluded."scopeValue",
      "minOrderAmount" = excluded."minOrderAmount",
      "maxOrderAmount" = excluded."maxOrderAmount",
      "minUserLevel" = excluded."minUserLevel",
      "maxUserLevel" = excluded."maxUserLevel",
      "newUserWithinDays" = excluded."newUserWithinDays",
      "requireReferral" = excluded."requireReferral",
      "requireFirstOrder" = excluded."requireFirstOrder",
      "weekdays" = excluded."weekdays",
      "allowedChannels" = excluded."allowedChannels",
      "extraConditions" = excluded."extraConditions",
      "validStart" = excluded."validStart",
      "validEnd" = excluded."validEnd",
      "status" = excluded."status",
      "remark" = excluded."remark",
      "updatedAt" = excluded."updatedAt"
  `;

  const row = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsRule" WHERE "id" = ${id} LIMIT 1`;
  return mapRuleRow(row[0]);
}

export async function toggleAdminPointsRule(id: string, enabled: boolean): Promise<AdminPointsRule> {
  await ensurePointsAdminTables();
  const ts = nowTs();
  await prisma.$executeRaw`UPDATE "PointsRule" SET "status" = ${enabled ? 1 : 0}, "updatedAt" = ${ts} WHERE "id" = ${id}`;
  const row = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsRule" WHERE "id" = ${id} LIMIT 1`;
  if (!row[0]) throw new AppError(72003, '规则不存在', 404);
  return mapRuleRow(row[0]);
}

export async function listAdminPointsCampaigns(): Promise<AdminPointsCampaign[]> {
  await ensurePointsAdminTables();
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsCampaign" ORDER BY "updatedAt" DESC`;
  return rows.map(mapCampaignRow);
}

export async function saveAdminPointsCampaign(
  payload: Partial<AdminPointsCampaign> & { id?: string; name: string; campaignType: string }
): Promise<AdminPointsCampaign> {
  await ensurePointsAdminTables();
  const id = String(payload.id || randomUUID());
  const ts = nowTs();
  const status: PointsCampaignStatus = Number(payload.status || 1) === 1 ? 1 : 0;
  const audienceType = (['all', 'level', 'tag', 'user'].includes(String(payload.audienceType || 'all'))
    ? String(payload.audienceType || 'all')
    : 'all') as AdminPointsCampaign['audienceType'];

  if (!String(payload.name || '').trim()) {
    throw new AppError(72011, '活动名称不能为空', 400);
  }

  await prisma.$executeRaw`
    INSERT INTO "PointsCampaign"
    ("id","name","campaignType","ruleIds","budgetTotalPoints","budgetDailyPoints","userCapPoints","audienceType","audienceValue","status","startAt","endAt","spentPoints","createdAt","updatedAt")
    VALUES
    (${id}, ${String(payload.name || '').trim()}, ${String(payload.campaignType || '').trim()}, ${JSON.stringify(Array.isArray(payload.ruleIds) ? payload.ruleIds : [])}, ${toNum(payload.budgetTotalPoints, 0)}, ${toNum(payload.budgetDailyPoints, 0)}, ${toNum(payload.userCapPoints, 0)}, ${audienceType}, ${String(payload.audienceValue || '')}, ${status}, ${toNum(payload.startAt, 0)}, ${toNum(payload.endAt, 0)}, ${toNum(payload.spentPoints, 0)}, ${ts}, ${ts})
    ON CONFLICT("id") DO UPDATE SET
      "name" = excluded."name",
      "campaignType" = excluded."campaignType",
      "ruleIds" = excluded."ruleIds",
      "budgetTotalPoints" = excluded."budgetTotalPoints",
      "budgetDailyPoints" = excluded."budgetDailyPoints",
      "userCapPoints" = excluded."userCapPoints",
      "audienceType" = excluded."audienceType",
      "audienceValue" = excluded."audienceValue",
      "status" = excluded."status",
      "startAt" = excluded."startAt",
      "endAt" = excluded."endAt",
      "updatedAt" = excluded."updatedAt"
  `;

  const row = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsCampaign" WHERE "id" = ${id} LIMIT 1`;
  return mapCampaignRow(row[0]);
}

export async function toggleAdminPointsCampaign(id: string, enabled: boolean): Promise<AdminPointsCampaign> {
  await ensurePointsAdminTables();
  const ts = nowTs();
  await prisma.$executeRaw`UPDATE "PointsCampaign" SET "status" = ${enabled ? 1 : 0}, "updatedAt" = ${ts} WHERE "id" = ${id}`;
  const row = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsCampaign" WHERE "id" = ${id} LIMIT 1`;
  if (!row[0]) throw new AppError(72012, '活动不存在', 404);
  return mapCampaignRow(row[0]);
}

export async function listAdminPointsRiskRules(): Promise<AdminPointsRiskRule[]> {
  await ensurePointsAdminTables();
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsRiskRule" ORDER BY "updatedAt" DESC`;
  return rows.map(mapRiskRuleRow);
}

export async function saveAdminPointsRiskRule(
  payload: Partial<AdminPointsRiskRule> & { id?: string; name: string; eventType: string }
): Promise<AdminPointsRiskRule> {
  await ensurePointsAdminTables();
  const id = String(payload.id || randomUUID());
  const ts = nowTs();
  const status: PointsRiskRuleStatus = Number(payload.status || 1) === 1 ? 1 : 0;
  const hitAction = (['block', 'downgrade', 'review'].includes(String(payload.hitAction || 'review'))
    ? String(payload.hitAction || 'review')
    : 'review') as AdminPointsRiskRule['hitAction'];

  if (!String(payload.name || '').trim()) {
    throw new AppError(72021, '风控规则名称不能为空', 400);
  }

  await prisma.$executeRaw`
    INSERT INTO "PointsRiskRule"
    ("id","name","eventType","freqLimit","dailyLimit","deviceLimit","ipLimit","blacklistEnabled","hitAction","status","remark","createdAt","updatedAt")
    VALUES
    (${id}, ${String(payload.name || '').trim()}, ${String(payload.eventType || '').trim()}, ${toNum(payload.freqLimit, 0)}, ${toNum(payload.dailyLimit, 0)}, ${toNum(payload.deviceLimit, 0)}, ${toNum(payload.ipLimit, 0)}, ${payload.blacklistEnabled ? 1 : 0}, ${hitAction}, ${status}, ${String(payload.remark || '')}, ${ts}, ${ts})
    ON CONFLICT("id") DO UPDATE SET
      "name" = excluded."name",
      "eventType" = excluded."eventType",
      "freqLimit" = excluded."freqLimit",
      "dailyLimit" = excluded."dailyLimit",
      "deviceLimit" = excluded."deviceLimit",
      "ipLimit" = excluded."ipLimit",
      "blacklistEnabled" = excluded."blacklistEnabled",
      "hitAction" = excluded."hitAction",
      "status" = excluded."status",
      "remark" = excluded."remark",
      "updatedAt" = excluded."updatedAt"
  `;

  const row = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsRiskRule" WHERE "id" = ${id} LIMIT 1`;
  return mapRiskRuleRow(row[0]);
}

export async function toggleAdminPointsRiskRule(id: string, enabled: boolean): Promise<AdminPointsRiskRule> {
  await ensurePointsAdminTables();
  const ts = nowTs();
  await prisma.$executeRaw`UPDATE "PointsRiskRule" SET "status" = ${enabled ? 1 : 0}, "updatedAt" = ${ts} WHERE "id" = ${id}`;
  const row = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsRiskRule" WHERE "id" = ${id} LIMIT 1`;
  if (!row[0]) throw new AppError(72022, '风控规则不存在', 404);
  return mapRiskRuleRow(row[0]);
}

export async function listAdminPointsLedger(input?: {
  userId?: string;
  type?: string;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
}): Promise<AdminPointsLedgerRow[]> {
  const limit = Math.max(20, Math.min(1000, Number(input?.limit || 200)));

  const where: any = {};
  if (input?.userId) where.userId = String(input.userId);
  if (input?.type) where.type = String(input.type);
  if (input?.dateFrom || input?.dateTo) {
    where.createdAt = {};
    if (input?.dateFrom) where.createdAt.gte = new Date(Math.floor(input.dateFrom));
    if (input?.dateTo) where.createdAt.lte = new Date(Math.floor(input.dateTo));
  }

  const rows = await prisma.pointLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { name: true } } }
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.user?.name || '',
    type: String((row as any).type || ''),
    amount: Number((row as any).amount || 0),
    reason: String((row as any).reason || ''),
    bizId: String((row as any).bizId || ''),
    createdAt: new Date((row as any).createdAt).getTime()
  }));
}

async function resolveGrantTargets(input: { targetType: 'user' | 'level' | 'all'; userIds?: string[]; levelId?: number }) {
  if (input.targetType === 'user') {
    const ids = Array.isArray(input.userIds) ? input.userIds.map((id) => String(id || '').trim()).filter((id) => Boolean(id)) : [];
    if (ids.length === 0) throw new AppError(72031, '未选择目标用户', 400);
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, points: true, frozenPoints: true }
    });
  }

  if (input.targetType === 'level') {
    const levelId = Number(input.levelId || 0);
    if (!levelId) throw new AppError(72032, '缺少等级ID', 400);
    return prisma.user.findMany({
      where: { levelId },
      select: { id: true, points: true, frozenPoints: true }
    });
  }

  return prisma.user.findMany({
    select: { id: true, points: true, frozenPoints: true }
  });
}

export async function createAdminPointsGrant(input: {
  grantType: 'add' | 'deduct' | 'freeze' | 'unfreeze';
  targetType: 'user' | 'level' | 'all';
  userIds?: string[];
  levelId?: number;
  points: number;
  reasonCode: string;
  remark?: string;
  operatorUserId?: string;
}) {
  await ensurePointsAdminTables();

  const points = Math.floor(Number(input.points || 0));
  if (points <= 0) throw new AppError(72033, '积分必须大于0', 400);
  if (!String(input.reasonCode || '').trim()) throw new AppError(72034, '原因代码不能为空', 400);

  const targets = await resolveGrantTargets({
    targetType: input.targetType,
    userIds: input.userIds,
    levelId: input.levelId
  });

  const taskId = randomUUID();
  let successCount = 0;
  let failureCount = 0;

  for (const user of targets) {
    try {
      await prisma.$transaction(async (tx) => {
        const latest = await tx.user.findUnique({
          where: { id: user.id },
          select: { id: true, points: true, frozenPoints: true }
        });
        if (!latest) throw new AppError(72035, '用户不存在', 404);

        if (input.grantType === 'deduct' && latest.points < points) {
          throw new AppError(72036, '用户积分不足', 400);
        }
        if (input.grantType === 'freeze' && latest.points < points) {
          throw new AppError(72037, '用户可用积分不足，无法冻结', 400);
        }
        if (input.grantType === 'unfreeze' && latest.frozenPoints < points) {
          throw new AppError(72038, '冻结积分不足', 400);
        }

        if (input.grantType === 'add') {
          await tx.user.update({
            where: { id: latest.id },
            data: { points: { increment: points } }
          });
          await tx.pointLog.create({
            data: {
              userId: latest.id,
              amount: points,
              type: 'bonus',
              reason: `ADMIN:${input.reasonCode}${input.remark ? ` - ${input.remark}` : ''}`,
              bizId: taskId
            }
          });
        } else if (input.grantType === 'deduct') {
          await tx.user.update({
            where: { id: latest.id },
            data: { points: { decrement: points } }
          });
          await tx.pointLog.create({
            data: {
              userId: latest.id,
              amount: -points,
              type: 'redeem',
              reason: `ADMIN:${input.reasonCode}${input.remark ? ` - ${input.remark}` : ''}`,
              bizId: taskId
            }
          });
        } else if (input.grantType === 'freeze') {
          await tx.user.update({
            where: { id: latest.id },
            data: {
              points: { decrement: points },
              frozenPoints: { increment: points }
            }
          });
          await tx.pointLog.create({
            data: {
              userId: latest.id,
              amount: -points,
              type: 'freeze',
              reason: `ADMIN:${input.reasonCode}${input.remark ? ` - ${input.remark}` : ''}`,
              bizId: taskId
            }
          });
        } else {
          await tx.user.update({
            where: { id: latest.id },
            data: {
              points: { increment: points },
              frozenPoints: { decrement: points }
            }
          });
          await tx.pointLog.create({
            data: {
              userId: latest.id,
              amount: points,
              type: 'unfreeze',
              reason: `ADMIN:${input.reasonCode}${input.remark ? ` - ${input.remark}` : ''}`,
              bizId: taskId
            }
          });
        }
      });

      successCount += 1;
    } catch (_error) {
      failureCount += 1;
    }
  }

  const status: AdminPointsGrantTask['status'] = successCount === 0 ? 'failed' : failureCount > 0 ? 'partial' : 'completed';
  const resultSummary = `success=${successCount}, failure=${failureCount}, target=${targets.length}`;
  const createdAt = nowTs();

  await prisma.$executeRaw`
    INSERT INTO "PointsGrantTask"
    ("id","grantType","targetType","targetCount","points","reasonCode","remark","status","successCount","failureCount","resultSummary","createdAt","operatorUserId")
    VALUES
    (${taskId}, ${input.grantType}, ${input.targetType}, ${targets.length}, ${points}, ${String(input.reasonCode || '')}, ${String(input.remark || '')}, ${status}, ${successCount}, ${failureCount}, ${resultSummary}, ${createdAt}, ${String(input.operatorUserId || '')})
  `;

  return {
    id: taskId,
    grantType: input.grantType,
    targetType: input.targetType,
    targetCount: targets.length,
    points,
    reasonCode: String(input.reasonCode || ''),
    remark: String(input.remark || ''),
    status,
    successCount,
    failureCount,
    resultSummary,
    createdAt,
    operatorUserId: String(input.operatorUserId || '')
  } as AdminPointsGrantTask;
}

export async function listAdminPointsGrantTasks(limit = 50): Promise<AdminPointsGrantTask[]> {
  await ensurePointsAdminTables();
  const finalLimit = Math.max(10, Math.min(200, Number(limit || 50)));
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "PointsGrantTask" ORDER BY "createdAt" DESC LIMIT ${finalLimit}`;
  return rows.map((row) => ({
    id: String(row.id),
    grantType: String(row.grantType || 'add') as AdminPointsGrantTask['grantType'],
    targetType: String(row.targetType || 'user') as AdminPointsGrantTask['targetType'],
    targetCount: toNum(row.targetCount, 0),
    points: toNum(row.points, 0),
    reasonCode: String(row.reasonCode || ''),
    remark: String(row.remark || ''),
    status: (['completed', 'partial', 'failed'].includes(String(row.status || 'completed'))
      ? String(row.status || 'completed')
      : 'completed') as AdminPointsGrantTask['status'],
    successCount: toNum(row.successCount, 0),
    failureCount: toNum(row.failureCount, 0),
    resultSummary: String(row.resultSummary || ''),
    createdAt: toNum(row.createdAt, 0),
    operatorUserId: String(row.operatorUserId || '')
  }));
}

export async function getAdminPointsDashboard(days = 7): Promise<AdminPointsDashboard> {
  await ensurePointsAdminTables();
  const safeDays = Math.max(1, Math.min(30, Number(days || 7)));
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = startOfDayTs();
  const rangeStart = todayStart - (safeDays - 1) * dayMs;

  const [todayRows, rangeRows, users, activeCampaignCount, enabledRuleCount] = await Promise.all([
    prisma.pointLog.findMany({
      where: { createdAt: { gte: new Date(todayStart) } },
      select: { amount: true }
    }),
    prisma.pointLog.findMany({
      where: { createdAt: { gte: new Date(rangeStart) } },
      select: { amount: true, userId: true, createdAt: true }
    }),
    prisma.user.findMany({
      select: { points: true, frozenPoints: true }
    }),
    prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) AS count FROM "PointsCampaign" WHERE "status" = 1 AND ("startAt" = 0 OR "startAt" <= ${nowTs()}) AND ("endAt" = 0 OR "endAt" >= ${nowTs()})`,
    prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) AS count FROM "PointsRule" WHERE "status" = 1`
  ]);



  const issuedToday = todayRows.reduce((sum, row) => (row.amount > 0 ? sum + row.amount : sum), 0);
  const redeemedToday = todayRows.reduce((sum, row) => (row.amount < 0 ? sum + Math.abs(row.amount) : sum), 0);
  const pointsPool = users.reduce((sum, row) => sum + Number(row.points || 0) + Number(row.frozenPoints || 0), 0);

  const last7Start = startOfDayTs() - 6 * dayMs;
  const activeUsers7d = new Set(
    rangeRows
      .filter((row) => new Date(row.createdAt).getTime() >= last7Start)
      .map((row) => row.userId)
  ).size;

  const labels: string[] = [];
  const issued: number[] = [];
  const redeemed: number[] = [];
  const activeUsers: number[] = [];

  for (let i = 0; i < safeDays; i += 1) {
    const dayStart = rangeStart + i * dayMs;
    const dayEnd = dayStart + dayMs;
    const dayRows = rangeRows.filter((row) => {
      const ts = new Date(row.createdAt).getTime();
      return ts >= dayStart && ts < dayEnd;
    });
    labels.push(new Date(dayStart).toISOString().slice(5, 10));
    issued.push(dayRows.reduce((sum, row) => (row.amount > 0 ? sum + row.amount : sum), 0));
    redeemed.push(dayRows.reduce((sum, row) => (row.amount < 0 ? sum + Math.abs(row.amount) : sum), 0));
    activeUsers.push(new Set(dayRows.map((row) => row.userId)).size);
  }

  return {
    kpis: {
      issuedToday,
      redeemedToday,
      activeUsers7d,
      pointsPool,
      activeCampaigns: Number(activeCampaignCount[0]?.count || 0),
      enabledRules: Number(enabledRuleCount[0]?.count || 0)
    },
    trends: {
      labels,
      issued,
      redeemed,
      activeUsers
    }
  };
}


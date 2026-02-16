import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

interface AdminAuditInput {
  actorUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  status?: 'success' | 'failed';
  message?: string;
  ip?: string;
  userAgent?: string | string[];
  beforeData?: unknown;
  afterData?: unknown;
}

function safeJson(input: unknown): string {
  if (input === undefined) return '';
  try {
    return JSON.stringify(input);
  } catch (_error) {
    return '';
  }
}

let tableEnsured = false;

async function ensureAuditTable() {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "actorUserId" TEXT,
      "action" TEXT NOT NULL,
      "targetType" TEXT,
      "targetId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'success',
      "message" TEXT,
      "ip" TEXT,
      "userAgent" TEXT,
      "beforeData" TEXT,
      "afterData" TEXT,
      "createdAt" INTEGER NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_target_idx" ON "AuditLog"("targetType", "targetId");`);
  tableEnsured = true;
}

export async function writeAdminAuditLog(input: AdminAuditInput) {
  if (!input.action) return;
  try {
    await ensureAuditTable();
    const id = randomUUID();
    const userAgent = Array.isArray(input.userAgent) ? input.userAgent.join(', ') : input.userAgent || '';
    await prisma.$executeRaw`
      INSERT INTO "AuditLog"
      ("id", "actorUserId", "action", "targetType", "targetId", "status", "message", "ip", "userAgent", "beforeData", "afterData", "createdAt")
      VALUES
      (${id}, ${input.actorUserId || ''}, ${input.action}, ${input.targetType || ''}, ${input.targetId || ''}, ${input.status || 'success'}, ${input.message || ''}, ${input.ip || ''}, ${userAgent}, ${safeJson(input.beforeData)}, ${safeJson(input.afterData)}, ${Date.now()})
    `;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[audit] writeAdminAuditLog failed:', (error as Error)?.message || error);
  }
}

export async function listAdminAuditLogs(limit = 100) {
  const finalLimit = Math.max(10, Math.min(500, Number(limit || 100)));
  await ensureAuditTable();

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    actorUserId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string;
    status: string;
    message: string;
    ip: string;
    userAgent: string;
    beforeData: string;
    afterData: string;
    createdAt: number;
  }>>(
    `SELECT a.id,
            COALESCE(a.actorUserId, '') AS actorUserId,
            COALESCE(u.name, '') AS actorName,
            COALESCE(a.action, '') AS action,
            COALESCE(a.targetType, '') AS targetType,
            COALESCE(a.targetId, '') AS targetId,
            COALESCE(a.status, '') AS status,
            COALESCE(a.message, '') AS message,
            COALESCE(a.ip, '') AS ip,
            COALESCE(a.userAgent, '') AS userAgent,
            COALESCE(a.beforeData, '') AS beforeData,
            COALESCE(a.afterData, '') AS afterData,
            COALESCE(a.createdAt, 0) AS createdAt
       FROM "AuditLog" a
       LEFT JOIN "User" u ON u.id = a.actorUserId
      ORDER BY a.createdAt DESC
      LIMIT ${finalLimit}`
  );

  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    status: row.status,
    message: row.message,
    ip: row.ip,
    userAgent: row.userAgent,
    beforeData: row.beforeData,
    afterData: row.afterData,
    createdAt: Number(row.createdAt || 0)
  }));
}


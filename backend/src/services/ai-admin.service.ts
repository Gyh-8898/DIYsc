import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

const VALID_AUTH_TYPES = ['bearer', 'x-api-key', 'query'] as const;
const VALID_MODEL_STATUS = ['active', 'deprecated', 'offline'] as const;

function toStr(v: unknown) {
  return String(v ?? '').trim();
}

function toBool(v: unknown) {
  return Boolean(v);
}

function toNum(v: unknown, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeProviderId(raw: unknown) {
  const id = toStr(raw);
  if (!id) return '';
  if (id.length > 40) return '';
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return '';
  return id;
}

function maskSecret(secret: string) {
  const s = String(secret || '');
  if (!s) return '';
  if (s.length <= 6) return '******';
  return `${'*'.repeat(Math.max(6, s.length - 4))}${s.slice(-4)}`;
}

function parseDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  const asNum = Number(input);
  if (Number.isFinite(asNum) && asNum > 0) {
    return new Date(asNum);
  }
  const asStr = String(input);
  const d = new Date(asStr);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeJsonString(input: unknown, emptyAsNull = true) {
  if (input == null) return emptyAsNull ? null : '{}';
  if (typeof input === 'string') {
    const t = input.trim();
    if (!t) return emptyAsNull ? null : '{}';
    try {
      JSON.parse(t);
      return t;
    } catch {
      throw new AppError(400310, 'JSON 格式不合法', 400);
    }
  }
  try {
    return JSON.stringify(input);
  } catch {
    throw new AppError(400311, 'JSON 数据不合法', 400);
  }
}

export async function listAiProviders() {
  const rows = await prisma.aiProviderConfig.findMany({ orderBy: [{ updatedAt: 'desc' }] });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    displayName: r.displayName,
    baseUrl: r.baseUrl,
    authType: r.authType,
    enabled: r.enabled,
    apiKeyMasked: maskSecret(r.apiKey),
    hasApiKey: Boolean(r.apiKey),
    metaJson: r.metaJson || '',
    updatedAt: r.updatedAt.getTime()
  }));
}

export async function upsertAiProvider(providerRaw: string, payload: any) {
  const provider = normalizeProviderId(providerRaw);
  if (!provider) {
    throw new AppError(400320, '供应商ID不合法', 400);
  }

  const displayName = toStr(payload?.displayName) || provider;
  const baseUrl = toStr(payload?.baseUrl);
  const authType = toStr(payload?.authType) || 'bearer';
  const enabled = payload?.enabled == null ? true : toBool(payload.enabled);
  const metaJson = normalizeJsonString(payload?.metaJson, true);

  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    throw new AppError(400321, 'baseUrl 必须以 http(s):// 开头', 400);
  }
  if (authType && !VALID_AUTH_TYPES.includes(authType as any)) {
    throw new AppError(400322, `authType must be one of: ${VALID_AUTH_TYPES.join(', ')}`, 400);
  }

  const existing = await prisma.aiProviderConfig.findUnique({ where: { provider } });
  const nextApiKey = typeof payload?.apiKey === 'string' ? payload.apiKey.trim() : '';
  const nextApiSecret = typeof payload?.apiSecret === 'string' ? payload.apiSecret.trim() : '';

  const saved = await prisma.aiProviderConfig.upsert({
    where: { provider },
    update: {
      displayName,
      baseUrl: baseUrl || existing?.baseUrl || '',
      authType,
      enabled,
      metaJson,
      apiKey: nextApiKey ? nextApiKey : existing?.apiKey || '',
      apiSecret: nextApiSecret ? nextApiSecret : existing?.apiSecret || null
    },
    create: {
      provider,
      displayName,
      baseUrl: baseUrl || '',
      authType,
      enabled,
      metaJson,
      apiKey: nextApiKey || '',
      apiSecret: nextApiSecret || null
    }
  });

  return {
    id: saved.id,
    provider: saved.provider,
    displayName: saved.displayName,
    baseUrl: saved.baseUrl,
    authType: saved.authType,
    enabled: saved.enabled,
    apiKeyMasked: maskSecret(saved.apiKey),
    hasApiKey: Boolean(saved.apiKey),
    metaJson: saved.metaJson || '',
    updatedAt: saved.updatedAt.getTime()
  };
}

function normalizeBaseUrl(raw: string) {
  const url = String(raw || '').trim();
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function applyAuth(url: string, headers: Record<string, string>, providerRow: { apiKey: string; authType: string }) {
  const authType = String(providerRow.authType || 'bearer').trim();
  if (authType === 'bearer') {
    headers.Authorization = `Bearer ${providerRow.apiKey}`;
    return url;
  }
  if (authType === 'x-api-key') {
    headers['X-API-Key'] = providerRow.apiKey;
    return url;
  }
  if (authType === 'query') {
    const u = new URL(url);
    u.searchParams.set('key', providerRow.apiKey);
    return u.toString();
  }
  return url;
}

async function fetchJson(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const text = await resp.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { ok: resp.ok, status: resp.status, text, json, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAiLikeModelsUrl(baseUrl: string) {
  const base = normalizeBaseUrl(baseUrl);
  const hasV1 = /\/v1(\/|$)/.test(base);
  const root = hasV1 ? base : `${base}/v1`;
  return `${root}/models`;
}

function buildGeminiModelsUrl(baseUrl: string) {
  const base = normalizeBaseUrl(baseUrl);
  // Supports v1beta/v1 endpoints depending on provider choice.
  return base.includes('/models') ? base : `${base}/models`;
}

export async function testAiProvider(provider: string) {
  const row = await prisma.aiProviderConfig.findUnique({ where: { provider } });
  if (!row) {
    throw new AppError(404320, '供应商不存在', 404);
  }
  if (!row.enabled) {
    throw new AppError(400323, '供应商已禁用', 400);
  }
  if (!row.baseUrl || !row.apiKey) {
    throw new AppError(400324, '供应商缺少 baseUrl/apiKey', 400);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const isGemini = row.provider === 'gemini';
  const endpoint = isGemini ? buildGeminiModelsUrl(row.baseUrl) : buildOpenAiLikeModelsUrl(row.baseUrl);
  const url = applyAuth(endpoint, headers, { apiKey: row.apiKey, authType: isGemini ? 'query' : row.authType });

  const resp = await fetchJson(url, { method: 'GET', headers }, 12000);
  if (!resp.ok) {
    throw new AppError(400325, `Provider test failed (${resp.status})`, 400);
  }

  const json: any = resp.json as any;
  let models: Array<{ id?: string; name?: string; displayName?: string }> = [];
  if (isGemini) {
    models = Array.isArray(json?.models) ? json.models.slice(0, 8) : [];
  } else {
    models = Array.isArray(json?.data) ? json.data.slice(0, 8) : [];
  }

  return {
    ok: true,
    status: resp.status,
    latencyMs: resp.latencyMs,
    sample: models.map((m: any) => ({
      id: typeof m?.id === 'string' ? m.id : undefined,
      name: typeof m?.name === 'string' ? m.name : undefined,
      displayName: typeof m?.displayName === 'string' ? m.displayName : undefined
    }))
  };
}

export async function listAiModels() {
  const rows = await prisma.aiModelRegistry.findMany({ orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    modelId: r.modelId,
    displayName: r.displayName,
    version: r.version,
    releaseDate: r.releaseDate ? r.releaseDate.getTime() : null,
    status: r.status,
    isDefault: r.isDefault,
    metaJson: r.metaJson || '',
    updatedAt: r.updatedAt.getTime()
  }));
}

export async function createAiModel(payload: any) {
  const provider = normalizeProviderId(payload?.provider);
  const modelId = toStr(payload?.modelId);
  const version = toStr(payload?.version);
  const displayName = toStr(payload?.displayName) || modelId;
  const status = toStr(payload?.status) || 'active';
  const isDefault = toBool(payload?.isDefault);
  const releaseDate = parseDate(payload?.releaseDate);
  const metaJson = normalizeJsonString(payload?.metaJson, true);

  if (!provider || !modelId || !version) {
    throw new AppError(400330, 'provider/modelId/version 不能为空', 400);
  }
  if (!VALID_MODEL_STATUS.includes(status as any)) {
    throw new AppError(400331, `status must be one of: ${VALID_MODEL_STATUS.join(', ')}`, 400);
  }

  if (isDefault) {
    await prisma.aiModelRegistry.updateMany({ data: { isDefault: false } });
  }

  const row = await prisma.aiModelRegistry.create({
    data: {
      provider,
      modelId,
      displayName,
      version,
      releaseDate,
      status,
      isDefault,
      metaJson
    }
  });

  return {
    id: row.id,
    provider: row.provider,
    modelId: row.modelId,
    displayName: row.displayName,
    version: row.version,
    releaseDate: row.releaseDate ? row.releaseDate.getTime() : null,
    status: row.status,
    isDefault: row.isDefault,
    metaJson: row.metaJson || '',
    updatedAt: row.updatedAt.getTime()
  };
}

export async function updateAiModel(id: string, payload: any) {
  const row = await prisma.aiModelRegistry.findUnique({ where: { id } });
  if (!row) {
    throw new AppError(404330, '模型不存在', 404);
  }

  const displayName = payload?.displayName != null ? toStr(payload.displayName) : row.displayName;
  const status = payload?.status != null ? toStr(payload.status) : row.status;
  const isDefault = payload?.isDefault != null ? toBool(payload.isDefault) : row.isDefault;
  const releaseDate = payload?.releaseDate !== undefined ? parseDate(payload.releaseDate) : row.releaseDate;
  const metaJson = payload?.metaJson !== undefined ? normalizeJsonString(payload.metaJson, true) : row.metaJson;

  if (status && !VALID_MODEL_STATUS.includes(status as any)) {
    throw new AppError(400332, `status must be one of: ${VALID_MODEL_STATUS.join(', ')}`, 400);
  }

  if (isDefault) {
    await prisma.aiModelRegistry.updateMany({ data: { isDefault: false } });
  }

  const saved = await prisma.aiModelRegistry.update({
    where: { id },
    data: {
      displayName,
      status,
      isDefault,
      releaseDate,
      metaJson
    }
  });

  return {
    id: saved.id,
    provider: saved.provider,
    modelId: saved.modelId,
    displayName: saved.displayName,
    version: saved.version,
    releaseDate: saved.releaseDate ? saved.releaseDate.getTime() : null,
    status: saved.status,
    isDefault: saved.isDefault,
    metaJson: saved.metaJson || '',
    updatedAt: saved.updatedAt.getTime()
  };
}

async function getOrCreateRouterRule() {
  const existing = await prisma.aiRouterRule.findUnique({ where: { id: 'global' } });
  if (existing) return existing;
  return prisma.aiRouterRule.create({
    data: {
      id: 'global',
      mode: 'manual',
      manualProvider: null,
      manualModelId: null,
      manualVersion: null,
      autoConfig: null
    }
  });
}

export async function getAiRouterRule() {
  const row = await getOrCreateRouterRule();
  return {
    id: row.id,
    mode: row.mode === 'auto' ? 'auto' : 'manual',
    manualProvider: row.manualProvider || '',
    manualModelId: row.manualModelId || '',
    manualVersion: row.manualVersion || '',
    autoConfig: row.autoConfig || ''
  };
}

export async function updateAiRouterRule(payload: any) {
  const row = await getOrCreateRouterRule();
  const mode = toStr(payload?.mode) === 'auto' ? 'auto' : 'manual';

  const manualProvider = toStr(payload?.provider || payload?.manualProvider);
  const manualModelId = toStr(payload?.modelId || payload?.manualModelId);
  const manualVersion = toStr(payload?.version || payload?.manualVersion);
  const autoConfig = payload?.autoConfig !== undefined ? normalizeJsonString(payload.autoConfig, true) : row.autoConfig;

  if (mode === 'manual') {
    if (!manualProvider || !manualModelId || !manualVersion) {
      throw new AppError(400340, '手动模式需要 provider/modelId/version', 400);
    }
    const exists = await prisma.aiModelRegistry.findFirst({
      where: { provider: manualProvider, modelId: manualModelId, version: manualVersion, status: 'active' }
    });
    if (!exists) {
      throw new AppError(400341, '所选 modelId+version 在注册中心不可用', 400);
    }
  } else {
    const activeCount = await prisma.aiModelRegistry.count({ where: { status: 'active' } });
    if (activeCount <= 0) {
      throw new AppError(400342, '自动模式至少需要一个可用的模型', 400);
    }
  }

  const saved = await prisma.aiRouterRule.update({
    where: { id: row.id },
    data: {
      mode,
      manualProvider: mode === 'manual' ? manualProvider : null,
      manualModelId: mode === 'manual' ? manualModelId : null,
      manualVersion: mode === 'manual' ? manualVersion : null,
      autoConfig
    }
  });

  return {
    id: saved.id,
    mode: saved.mode,
    manualProvider: saved.manualProvider || '',
    manualModelId: saved.manualModelId || '',
    manualVersion: saved.manualVersion || '',
    autoConfig: saved.autoConfig || ''
  };
}

export async function listAiPromptTemplates(taskType?: string) {
  const where = taskType ? { taskType } : undefined;
  const rows = await prisma.aiPromptTemplate.findMany({
    where,
    orderBy: [{ taskType: 'asc' }, { isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
  return rows.map((r) => ({
    id: r.id,
    taskType: r.taskType,
    name: r.name,
    version: r.version,
    content: r.content,
    status: r.status,
    trafficPercent: r.trafficPercent,
    isDefault: r.isDefault,
    updatedAt: r.updatedAt.getTime()
  }));
}

export async function createAiPromptTemplate(payload: any) {
  const taskType = toStr(payload?.taskType);
  const name = toStr(payload?.name) || 'default';
  const version = toStr(payload?.version) || '1';
  const content = toStr(payload?.content);
  const status = toStr(payload?.status) || 'active';
  const trafficPercent = Math.max(0, Math.min(100, toNum(payload?.trafficPercent, 0)));
  const isDefault = toBool(payload?.isDefault);

  if (!taskType || !content) {
    throw new AppError(400350, 'taskType/content 不能为空', 400);
  }

  if (isDefault) {
    await prisma.aiPromptTemplate.updateMany({ where: { taskType }, data: { isDefault: false } });
  }

  const row = await prisma.aiPromptTemplate.create({
    data: {
      taskType,
      name,
      version,
      content,
      status,
      trafficPercent,
      isDefault
    }
  });

  return {
    id: row.id,
    taskType: row.taskType,
    name: row.name,
    version: row.version,
    content: row.content,
    status: row.status,
    trafficPercent: row.trafficPercent,
    isDefault: row.isDefault,
    updatedAt: row.updatedAt.getTime()
  };
}

export async function updateAiPromptTemplate(id: string, payload: any) {
  const row = await prisma.aiPromptTemplate.findUnique({ where: { id } });
  if (!row) {
    throw new AppError(404350, '提示词模板不存在', 404);
  }

  const content = payload?.content !== undefined ? toStr(payload.content) : row.content;
  const status = payload?.status !== undefined ? toStr(payload.status) : row.status;
  const trafficPercent = payload?.trafficPercent !== undefined ? Math.max(0, Math.min(100, toNum(payload.trafficPercent, 0))) : row.trafficPercent;
  const isDefault = payload?.isDefault !== undefined ? toBool(payload.isDefault) : row.isDefault;

  if (isDefault) {
    await prisma.aiPromptTemplate.updateMany({ where: { taskType: row.taskType }, data: { isDefault: false } });
  }

  const saved = await prisma.aiPromptTemplate.update({
    where: { id },
    data: {
      content,
      status,
      trafficPercent,
      isDefault
    }
  });

  return {
    id: saved.id,
    taskType: saved.taskType,
    name: saved.name,
    version: saved.version,
    content: saved.content,
    status: saved.status,
    trafficPercent: saved.trafficPercent,
    isDefault: saved.isDefault,
    updatedAt: saved.updatedAt.getTime()
  };
}

export async function listAiPolicyRules() {
  const rows = await prisma.aiPolicyRule.findMany({ orderBy: [{ updatedAt: 'desc' }] });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    type: r.type,
    content: r.content,
    enabled: r.enabled,
    updatedAt: r.updatedAt.getTime()
  }));
}

export async function upsertAiPolicyRule(keyRaw: string, payload: any) {
  const key = toStr(keyRaw);
  if (!key) {
    throw new AppError(400360, '策略键不合法', 400);
  }

  const type = toStr(payload?.type) || 'text';
  const content = payload?.content == null ? '' : String(payload.content);
  const enabled = payload?.enabled == null ? true : toBool(payload.enabled);

  const saved = await prisma.aiPolicyRule.upsert({
    where: { key },
    update: { type, content, enabled },
    create: { key, type, content, enabled }
  });

  return {
    id: saved.id,
    key: saved.key,
    type: saved.type,
    content: saved.content,
    enabled: saved.enabled,
    updatedAt: saved.updatedAt.getTime()
  };
}

export async function listCommunityTagMappings() {
  const rows = await prisma.communityTagMapping.findMany({ orderBy: [{ updatedAt: 'desc' }] });
  return rows.map((r) => ({
    id: r.id,
    tag: r.tag,
    filter: r.filter,
    enabled: r.enabled,
    updatedAt: r.updatedAt.getTime()
  }));
}

export async function upsertCommunityTagMapping(tagRaw: string, payload: any) {
  const tag = toStr(tagRaw);
  if (!tag) {
    throw new AppError(400370, '标签不合法', 400);
  }

  const filter = normalizeJsonString(payload?.filter, false) || '{}';
  const enabled = payload?.enabled == null ? true : toBool(payload.enabled);

  const saved = await prisma.communityTagMapping.upsert({
    where: { tag },
    update: { filter, enabled },
    create: { tag, filter, enabled }
  });

  return {
    id: saved.id,
    tag: saved.tag,
    filter: saved.filter,
    enabled: saved.enabled,
    updatedAt: saved.updatedAt.getTime()
  };
}

function startOfDayMs(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function formatYmd(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function getAiDashboard(days: number) {
  const rangeDays = Math.max(1, Math.min(60, Math.floor(days || 7)));
  const today0 = startOfDayMs(new Date());
  const start0 = today0 - (rangeDays - 1) * 24 * 3600 * 1000;

  const labels = Array.from({ length: rangeDays }, (_, i) => formatYmd(start0 + i * 24 * 3600 * 1000));

  const series = {
    newUsers: Array.from({ length: rangeDays }, () => 0),
    analysesSuccess: Array.from({ length: rangeDays }, () => 0),
    analysesFail: Array.from({ length: rangeDays }, () => 0),
    reportsSaved: Array.from({ length: rangeDays }, () => 0),
    tagClicks: Array.from({ length: rangeDays }, () => 0),
    gotoDesigner: Array.from({ length: rangeDays }, () => 0),
    cost: Array.from({ length: rangeDays }, () => 0)
  };

  const startDate = new Date(start0);

  const [users, logs, reports, events] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: startDate } }, select: { createdAt: true } }),
    prisma.aiRequestLog.findMany({
      where: {
        createdAt: { gte: startDate },
        taskType: { in: ['community_bazi', 'community_liuyao'] }
      },
      select: { createdAt: true, status: true, cost: true }
    }),
    prisma.communityReport.findMany({ where: { createdAt: { gte: startDate } }, select: { createdAt: true } }),
    prisma.eventFunnelLog.findMany({
      where: {
        createdAt: { gte: startDate },
        eventType: { in: ['community_tag_click', 'community_goto_designer'] }
      },
      select: { createdAt: true, eventType: true }
    })
  ]);

  for (const u of users) {
    const idx = Math.floor((u.createdAt.getTime() - start0) / (24 * 3600 * 1000));
    if (idx >= 0 && idx < rangeDays) series.newUsers[idx] += 1;
  }

  for (const l of logs) {
    const idx = Math.floor((l.createdAt.getTime() - start0) / (24 * 3600 * 1000));
    if (idx < 0 || idx >= rangeDays) continue;
    if (String(l.status) === 'success') series.analysesSuccess[idx] += 1;
    else series.analysesFail[idx] += 1;
    series.cost[idx] += Number(l.cost || 0);
  }

  for (const r of reports) {
    const idx = Math.floor((r.createdAt.getTime() - start0) / (24 * 3600 * 1000));
    if (idx >= 0 && idx < rangeDays) series.reportsSaved[idx] += 1;
  }

  for (const e of events) {
    const idx = Math.floor((e.createdAt.getTime() - start0) / (24 * 3600 * 1000));
    if (idx < 0 || idx >= rangeDays) continue;
    if (e.eventType === 'community_tag_click') series.tagClicks[idx] += 1;
    if (e.eventType === 'community_goto_designer') series.gotoDesigner[idx] += 1;
  }

  const totals = {
    newUsers: series.newUsers.reduce((s, v) => s + v, 0),
    analysesSuccess: series.analysesSuccess.reduce((s, v) => s + v, 0),
    analysesFail: series.analysesFail.reduce((s, v) => s + v, 0),
    reportsSaved: series.reportsSaved.reduce((s, v) => s + v, 0),
    tagClicks: series.tagClicks.reduce((s, v) => s + v, 0),
    gotoDesigner: series.gotoDesigner.reduce((s, v) => s + v, 0),
    cost: Number(series.cost.reduce((s, v) => s + v, 0).toFixed(4))
  };

  return {
    rangeDays,
    labels,
    series,
    totals
  };
}


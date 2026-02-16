import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { getInventoryTreeForClient } from "./product.service";

const TASK_TYPES = ["bazi", "liuyao"] as const;
type TaskType = (typeof TASK_TYPES)[number];

export type CommunityRiskStatus = "pass" | "blocked" | "manual_review";

const BaziInputSchema = z.object({
  name: z.string().optional().default(""),
  gender: z.enum(["male", "female"]).optional().default("male"),
  birthDate: z.string().min(4),
  birthTime: z.string().optional().default(""),
  birthCity: z.string().optional().default(""),
  question: z.string().optional().default("")
});
type BaziInput = z.infer<typeof BaziInputSchema>;

const LiuyaoInputSchema = z.object({
  question: z.string().min(1),
  datetime: z.string().optional().default(""),
  coins: z.array(z.string()).length(6).optional().default([])
});
type LiuyaoInput = z.infer<typeof LiuyaoInputSchema>;

const InsightSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1)
});

const RecommendationSchema = z.object({
  tag: z.string().min(1),
  reason: z.string().min(1)
});

const AnalysisResultSchema = z.object({
  type: z.enum(["bazi", "liuyao"]),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  insights: z.array(InsightSchema).default([]),
  recommendedTags: z.array(RecommendationSchema).default([]),
  disclaimer: z.string().optional()
});

export type CommunityAnalysisResult = z.infer<typeof AnalysisResultSchema>;

export interface CommunityAnalysisResponse {
  traceId: string;
  riskStatus: CommunityRiskStatus;
  result: CommunityAnalysisResult;
  provider?: string;
  modelId?: string;
  version?: string;
}

function buildTraceId() {
  return crypto.randomUUID();
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch (_error) {
    return null;
  }
}

function extractJsonObject(text: string): unknown {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  const candidate = raw.slice(start, end + 1);
  return safeJsonParse(candidate);
}

function hashToPercent(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

async function ensureCommunitySession(userId: string, sessionId: string) {
  await prisma.communitySession.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    update: {},
    create: { userId, sessionId }
  });
}

type RateLimitConfig = {
  windowSeconds: number;
  maxRequests: number;
  scope: "session" | "user";
};

type PolicyBundle = {
  disclaimer: string;
  refuseTemplate: string;
  bannedWords: string[];
  highRiskWords: string[];
  rateLimit: RateLimitConfig;
};

function normalizeRateLimitConfig(raw: any): RateLimitConfig {
  const windowSeconds = Math.max(5, Math.min(3600, Number(raw?.windowSeconds ?? raw?.windowSec ?? 60) || 60));
  const maxRequests = Math.max(0, Math.min(200, Math.floor(Number(raw?.maxRequests ?? raw?.limit ?? 20) || 20)));
  const scopeRaw = String(raw?.scope || "session").toLowerCase();
  const scope: "session" | "user" = scopeRaw === "user" ? "user" : "session";
  return { windowSeconds, maxRequests, scope };
}

async function loadPolicyBundle(): Promise<PolicyBundle> {
  const rows = await prisma.aiPolicyRule.findMany({
    where: { enabled: true },
    orderBy: { updatedAt: "desc" }
  });

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const disclaimer = byKey.get("community_disclaimer")?.content?.trim() || "仅供文化交流与娱乐参考，不构成任何承诺或保证。";
  const refuseTemplate = byKey.get("community_refuse_template")?.content?.trim() || "该问题涉及高风险内容，建议理性看待并咨询专业人士。";
  const bannedWords = safeJsonParse<string[]>(byKey.get("community_banned_words")?.content || "") || ["改命", "保证", "必发财", "必成功", "包中奖"];
  const highRiskWords = safeJsonParse<string[]>(byKey.get("community_high_risk_words")?.content || "") || ["彩票", "投资", "疾病", "自杀", "犯罪", "赌博"];
  const rateLimit = normalizeRateLimitConfig(safeJsonParse<any>(byKey.get("community_rate_limit")?.content || "") || {});
  return { disclaimer, refuseTemplate, bannedWords, highRiskWords, rateLimit };
}

function containsAny(text: string, words: string[]) {
  const hay = text.toLowerCase();
  return words.some((w) => w && hay.includes(String(w).toLowerCase()));
}

function buildRefuseResult(type: TaskType, template: string, disclaimer: string): CommunityAnalysisResult {
  return {
    type,
    summary: template,
    tags: [],
    insights: [],
    recommendedTags: [],
    disclaimer
  };
}

type ModelSelection = {
  provider: string;
  modelId: string;
  version?: string;
};

async function getOrCreateRouterConfig() {
  const existing = await prisma.aiRouterRule.findUnique({ where: { id: "global" } });
  if (existing) return existing;
  return prisma.aiRouterRule.create({
    data: {
      id: "global",
      mode: "manual",
      manualProvider: null,
      manualModelId: null,
      manualVersion: null,
      autoConfig: null
    }
  });
}

type AutoRouterConfig = {
  strategy?: "balanced" | "cheap" | "fast" | "quality";
  maxLatencyMs?: number;
  maxCostPerRequest?: number;
  preferredProviders?: string[];
  requiredTags?: string[];
  candidateLimit?: number;
  weights?: { cost?: number; latency?: number; quality?: number };
};

type ModelMeta = {
  priceInput: number;
  priceOutput: number;
  latencyMs: number | null;
  tags: string[];
  qualityScore: number | null;
};

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

function normalizeStringList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const s = String(item || '').trim();
    if (!s) continue;
    out.push(s);
  }
  return Array.from(new Set(out));
}

function normalizeAutoRouterConfig(raw: any): AutoRouterConfig {
  const strategyRaw = String(raw?.strategy || 'balanced').toLowerCase();
  const strategy: AutoRouterConfig['strategy'] =
    strategyRaw === 'cheap' || strategyRaw === 'fast' || strategyRaw === 'quality' || strategyRaw === 'balanced'
      ? (strategyRaw as any)
      : 'balanced';

  const maxLatencyMs = Number(raw?.maxLatencyMs);
  const maxCostPerRequest = Number(raw?.maxCostPerRequest);
  const candidateLimit = Math.max(1, Math.min(5, Math.floor(Number(raw?.candidateLimit ?? raw?.topK ?? 3) || 3)));

  const preferredProviders = normalizeStringList(raw?.preferredProviders ?? raw?.providers);
  const requiredTags = normalizeStringList(raw?.requiredTags ?? raw?.requireTags);

  const weightsRaw = raw?.weights;
  const weights = weightsRaw && typeof weightsRaw === 'object'
    ? {
      cost: Number(weightsRaw.cost),
      latency: Number(weightsRaw.latency),
      quality: Number(weightsRaw.quality)
    }
    : undefined;

  return {
    strategy,
    maxLatencyMs: Number.isFinite(maxLatencyMs) && maxLatencyMs > 0 ? maxLatencyMs : undefined,
    maxCostPerRequest: Number.isFinite(maxCostPerRequest) && maxCostPerRequest > 0 ? maxCostPerRequest : undefined,
    preferredProviders,
    requiredTags,
    candidateLimit,
    weights
  };
}

function parseModelMeta(metaJson: string): ModelMeta {
  const meta = metaJson ? safeJsonParse<any>(metaJson) : null;
  const priceInput = Number(meta?.price?.input || 0) || 0;
  const priceOutput = Number(meta?.price?.output || 0) || 0;
  const latencyRaw = meta?.latencyMs ?? meta?.avgLatencyMs ?? meta?.p50LatencyMs ?? null;
  const latencyMs = Number.isFinite(Number(latencyRaw)) ? Number(latencyRaw) : null;
  const qualityRaw = meta?.qualityScore ?? meta?.quality ?? null;
  const qualityScore = Number.isFinite(Number(qualityRaw)) ? Number(qualityRaw) : null;
  const tags = Array.isArray(meta?.tags) ? meta.tags.map((t: any) => String(t || '').trim()).filter(Boolean) : [];
  return { priceInput, priceOutput, latencyMs, tags, qualityScore };
}

function pickAutoWeights(cfg: AutoRouterConfig) {
  const base = cfg.strategy === 'cheap'
    ? { cost: 0.6, latency: 0.2, quality: 0.2 }
    : cfg.strategy === 'fast'
      ? { cost: 0.2, latency: 0.6, quality: 0.2 }
      : cfg.strategy === 'quality'
        ? { cost: 0.2, latency: 0.2, quality: 0.6 }
        : { cost: 0.4, latency: 0.3, quality: 0.3 };

  const w = cfg.weights;
  const cost = Number.isFinite(w?.cost as any) ? Number(w?.cost) : NaN;
  const latency = Number.isFinite(w?.latency as any) ? Number(w?.latency) : NaN;
  const quality = Number.isFinite(w?.quality as any) ? Number(w?.quality) : NaN;
  const sum = (Number.isFinite(cost) ? cost : 0) + (Number.isFinite(latency) ? latency : 0) + (Number.isFinite(quality) ? quality : 0);

  const picked = sum > 0
    ? { cost: cost / sum, latency: latency / sum, quality: quality / sum }
    : base;

  const sum2 = picked.cost + picked.latency + picked.quality;
  return sum2 > 0 ? { cost: picked.cost / sum2, latency: picked.latency / sum2, quality: picked.quality / sum2 } : base;
}

function computeQualityScore(meta: ModelMeta) {
  if (meta.qualityScore != null) {
    return clamp01(Number(meta.qualityScore) / 100);
  }
  let q = 0.5;
  const tags = meta.tags.map((t) => t.toLowerCase());
  if (tags.includes('quality')) q += 0.3;
  if (tags.includes('reasoning')) q += 0.1;
  if (tags.includes('fast')) q += 0.05;
  return clamp01(q);
}

function invMinMax(v: number | null, min: number, max: number, unknownScore: number) {
  if (v == null || !Number.isFinite(v)) return unknownScore;
  if (max <= min) return 1;
  return 1 - (v - min) / (max - min);
}

function rankAutoModels(rows: any[], cfg: AutoRouterConfig) {
  let candidates = rows;

  if (cfg.preferredProviders && cfg.preferredProviders.length > 0) {
    const filtered = candidates.filter((r) => cfg.preferredProviders!.includes(String(r.provider)));
    if (filtered.length > 0) candidates = filtered;
  }

  const enriched = candidates.map((row) => {
    const meta = parseModelMeta(String(row.metaJson || ''));
    const costEst = meta.priceInput > 0 || meta.priceOutput > 0 ? meta.priceInput + meta.priceOutput : null;
    const tagSet = new Set(meta.tags.map((t) => t.toLowerCase()));
    return { row, meta, costEst, tagSet };
  });

  let usable = enriched;

  if (cfg.requiredTags && cfg.requiredTags.length > 0) {
    const need = cfg.requiredTags.map((t) => String(t || '').toLowerCase()).filter(Boolean);
    const filtered = usable.filter((e) => need.every((t) => e.tagSet.has(t)));
    if (filtered.length > 0) usable = filtered;
  }

  if (cfg.maxLatencyMs && cfg.maxLatencyMs > 0) {
    const filtered = usable.filter((e) => e.meta.latencyMs == null || e.meta.latencyMs <= cfg.maxLatencyMs!);
    if (filtered.length > 0) usable = filtered;
  }

  if (cfg.maxCostPerRequest && cfg.maxCostPerRequest > 0) {
    const filtered = usable.filter((e) => e.costEst == null || e.costEst <= cfg.maxCostPerRequest!);
    if (filtered.length > 0) usable = filtered;
  }

  const weights = pickAutoWeights(cfg);

  const knownCosts = usable.map((e) => e.costEst).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const costMin = knownCosts.length > 0 ? Math.min(...knownCosts) : 0;
  const costMax = knownCosts.length > 0 ? Math.max(...knownCosts) : 0;

  const knownLatency = usable.map((e) => e.meta.latencyMs).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const latMin = knownLatency.length > 0 ? Math.min(...knownLatency) : 0;
  const latMax = knownLatency.length > 0 ? Math.max(...knownLatency) : 0;

  return usable
    .map((e) => {
      const costScore = invMinMax(e.costEst, costMin, costMax, 0.4);
      const latencyScore = invMinMax(e.meta.latencyMs, latMin, latMax, 0.4);
      const qualityScore = computeQualityScore(e.meta);
      const boost = e.row.isDefault ? 0.02 : 0;
      const score = weights.cost * costScore + weights.latency * latencyScore + weights.quality * qualityScore + boost;
      return { ...e, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (Boolean(b.row.isDefault) !== Boolean(a.row.isDefault)) return Number(Boolean(b.row.isDefault)) - Number(Boolean(a.row.isDefault));
      const ta = a.row.updatedAt ? new Date(a.row.updatedAt).getTime() : 0;
      const tb = b.row.updatedAt ? new Date(b.row.updatedAt).getTime() : 0;
      return tb - ta;
    })
    .map((e) => e.row);
}

async function selectModelCandidatesForTask(taskType: string): Promise<{ mode: "manual" | "auto"; candidates: ModelSelection[]; autoConfig: AutoRouterConfig | null }> {
  const router = await getOrCreateRouterConfig();
  const mode = router.mode === "auto" ? "auto" : "manual";

  if (mode === "manual") {
    const provider = String(router.manualProvider || "").trim();
    const modelId = String(router.manualModelId || "").trim();
    const version = String(router.manualVersion || "").trim();
    if (!provider || !modelId || !version) {
      throw new AppError(42001, "AI router is in manual mode but no model is selected", 400);
    }

    const exists = await prisma.aiModelRegistry.findFirst({
      where: { provider, modelId, version, status: "active" }
    });
    if (!exists) {
      throw new AppError(42002, "Selected modelId+version is not available in registry", 400);
    }

    return { mode, candidates: [{ provider, modelId, version }], autoConfig: null };
  }

  const models = await prisma.aiModelRegistry.findMany({
    where: { status: "active" },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
  });
  if (models.length === 0) {
    throw new AppError(42004, "No active AI model in registry", 400);
  }

  const autoConfig = normalizeAutoRouterConfig(safeJsonParse<any>(String(router.autoConfig || "")) || {});
  const ranked = rankAutoModels(models, autoConfig);
  const limit = autoConfig.candidateLimit || 3;
  const picks = ranked
    .slice(0, limit)
    .map((m: any) => ({ provider: String(m.provider), modelId: String(m.modelId), version: String(m.version || '') || undefined }));

  return { mode, candidates: picks.length > 0 ? picks : [{ provider: String(models[0].provider), modelId: String(models[0].modelId), version: String(models[0].version) }], autoConfig };
}

async function selectModelForTask(taskType: string): Promise<ModelSelection> {
  const pick = await selectModelCandidatesForTask(taskType);
  const first = pick.candidates[0];
  if (!first) {
    throw new AppError(42005, "No model selected", 400);
  }
  return first;
}

async function getProviderConfig(provider: string) {
  const row = await prisma.aiProviderConfig.findUnique({ where: { provider } });
  if (!row || !row.enabled) {
    throw new AppError(42011, `AI provider not configured or disabled: ${provider}`, 400);
  }
  if (!row.baseUrl || !row.apiKey) {
    throw new AppError(42012, `AI provider missing baseUrl/apiKey: ${provider}`, 400);
  }
  return row;
}

type PromptPick = {
  id?: string;
  content: string;
  name: string;
  version: string;
};

const DEFAULT_PROMPTS: Record<string, string> = {
  community_bazi: [
    "你是一个文化娱乐型的八字灵感分析助手。",
    "你必须输出一个且仅一个 JSON 对象，不要输出任何多余文本、代码块或解释。",
    "输出必须满足以下 JSON 结构：",
    "{\"type\":\"bazi\",\"summary\":string,\"tags\":string[],\"insights\":[{\"title\":string,\"content\":string}],\"recommendedTags\":[{\"tag\":string,\"reason\":string}],\"disclaimer\":string}",
    "规则：仅供文化交流与娱乐参考；禁止承诺、保证；禁止医疗/法律/投资具体建议；表达要中性克制。",
    "输入：{{input}}"
  ].join("\n"),
  community_liuyao: [
    "你是一个文化娱乐型的六爻参考解读助手。",
    "你必须输出一个且仅一个 JSON 对象，不要输出任何多余文本、代码块或解释。",
    "输出必须满足以下 JSON 结构：",
    "{\"type\":\"liuyao\",\"summary\":string,\"tags\":string[],\"insights\":[{\"title\":string,\"content\":string}],\"recommendedTags\":[{\"tag\":string,\"reason\":string}],\"disclaimer\":string}",
    "规则：仅供文化交流与娱乐参考；禁止承诺、保证；禁止医疗/法律/投资具体建议；表达要中性克制。",
    "输入：{{input}}"
  ].join("\n")
};

async function pickPromptTemplate(taskType: string, userId: string): Promise<PromptPick> {
  const rows = await prisma.aiPromptTemplate.findMany({
    where: { taskType, status: "active" },
    orderBy: [{ updatedAt: "desc" }]
  });
  if (rows.length === 0) {
    const fallback = DEFAULT_PROMPTS[taskType] || DEFAULT_PROMPTS.community_bazi;
    return { content: fallback, name: "builtin", version: "0" };
  }

  const gray = rows.filter((r) => r.trafficPercent > 0);
  if (gray.length > 0) {
    const pct = hashToPercent(`${userId}:${taskType}`);
    let acc = 0;
    for (const t of gray) {
      acc += Math.max(0, Math.min(100, Number(t.trafficPercent) || 0));
      if (pct < acc) {
        return { id: t.id, content: t.content, name: t.name, version: t.version };
      }
    }
  }

  const def = rows.find((r) => r.isDefault) || rows[0];
  return { id: def.id, content: def.content, name: def.name, version: def.version };
}

type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type AiCallResult = {
  text: string;
  usage: AiUsage;
  raw: unknown;
};

function normalizeBaseUrl(raw: string) {
  const url = String(raw || "").trim();
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function applyAuth(url: string, headers: Record<string, string>, providerRow: { apiKey: string; authType: string }) {
  const authType = String(providerRow.authType || "bearer").trim();
  if (authType === "bearer") {
    headers.Authorization = `Bearer ${providerRow.apiKey}`;
    return url;
  }
  if (authType === "x-api-key") {
    headers["X-API-Key"] = providerRow.apiKey;
    return url;
  }
  if (authType === "query") {
    const u = new URL(url);
    u.searchParams.set("key", providerRow.apiKey);
    return u.toString();
  }
  return url;
}

async function fetchJson(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const text = await resp.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch (_error) {
      json = null;
    }
    return { ok: resp.ok, status: resp.status, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiLike(providerRow: { baseUrl: string; apiKey: string; authType: string }, modelId: string, prompt: string): Promise<AiCallResult> {
  const baseUrl = normalizeBaseUrl(providerRow.baseUrl);
  const endpoint = baseUrl.includes("/chat/completions")
    ? baseUrl
    : baseUrl.endsWith("/v1")
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/v1/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const url = applyAuth(endpoint, headers, providerRow);
  const payload = {
    model: modelId,
    messages: [
      { role: "user", content: prompt }
    ],
    temperature: 0.7
  };
  const started = Date.now();
  const resp = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, 20000);
  const latencyMs = Date.now() - started;
  if (!resp.ok) {
    throw new AppError(42031, `AI provider request failed (${resp.status})`, 400);
  }
  const data = (resp.json as any) || {};
  const text = String(data?.choices?.[0]?.message?.content || "");
  const usage = data?.usage || {};
  const inputTokens = Number(usage.prompt_tokens || 0) || 0;
  const outputTokens = Number(usage.completion_tokens || 0) || 0;
  const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens || 0) || 0;
  return {
    text,
    usage: { inputTokens, outputTokens, totalTokens },
    raw: { data, latencyMs }
  };
}

async function callGemini(providerRow: { baseUrl: string; apiKey: string; authType: string }, modelId: string, prompt: string): Promise<AiCallResult> {
  const baseUrl = normalizeBaseUrl(providerRow.baseUrl);
  const endpoint = baseUrl.includes(":generateContent")
    ? baseUrl
    : `${baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const url = applyAuth(endpoint, headers, { apiKey: providerRow.apiKey, authType: "query" });
  const payload = {
    contents: [
      { role: "user", parts: [{ text: prompt }] }
    ],
    generationConfig: { temperature: 0.7 }
  };
  const started = Date.now();
  const resp = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, 20000);
  const latencyMs = Date.now() - started;
  if (!resp.ok) {
    throw new AppError(42032, `Gemini request failed (${resp.status})`, 400);
  }
  const data = (resp.json as any) || {};
  const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "");
  const usageMeta = data?.usageMetadata || {};
  const inputTokens = Number(usageMeta.promptTokenCount || 0) || 0;
  const outputTokens = Number(usageMeta.candidatesTokenCount || 0) || 0;
  const totalTokens = Number(usageMeta.totalTokenCount || inputTokens + outputTokens || 0) || 0;
  return {
    text,
    usage: { inputTokens, outputTokens, totalTokens },
    raw: { data, latencyMs }
  };
}

async function callAi(selection: ModelSelection, prompt: string) {
  const provider = selection.provider;
  const providerRow = await getProviderConfig(provider);
  if (providerRow.provider === "gemini") {
    return callGemini(providerRow, selection.modelId, prompt);
  }
  return callOpenAiLike(providerRow, selection.modelId, prompt);
}

async function logRiskHit(data: { traceId: string; userId: string; sessionId: string; type: string; level: string; detail?: unknown }) {
  await prisma.riskHitLog.create({
    data: {
      traceId: data.traceId,
      userId: data.userId,
      sessionId: data.sessionId,
      type: data.type,
      level: data.level,
      detailJson: data.detail ? JSON.stringify(data.detail) : null
    }
  });
}

async function logAiRequest(data: {
  traceId: string;
  userId: string;
  sessionId: string;
  taskType: string;
  provider: string;
  modelId: string;
  version?: string;
  promptTemplateId?: string;
  requestJson: unknown;
  responseJson?: unknown;
  usage?: AiUsage;
  latencyMs?: number;
  status: "success" | "fail" | "blocked";
  errorMessage?: string;
  policyHits?: unknown;
}) {
  let cost = 0;
  if (data.usage && data.provider && data.modelId && data.provider !== "policy") {
    try {
      const row = data.version
        ? await prisma.aiModelRegistry.findFirst({
          where: { provider: data.provider, modelId: data.modelId, version: data.version }
        })
        : await prisma.aiModelRegistry.findFirst({
          where: { provider: data.provider, modelId: data.modelId, status: "active" },
          orderBy: { updatedAt: "desc" }
        });

      const meta = row?.metaJson ? safeJsonParse<any>(row.metaJson) : null;
      const priceInput = Number((meta as any)?.price?.input || 0) || 0;
      const priceOutput = Number((meta as any)?.price?.output || 0) || 0;
      if (priceInput > 0 || priceOutput > 0) {
        cost = (Number(data.usage.inputTokens || 0) / 1000) * priceInput + (Number(data.usage.outputTokens || 0) / 1000) * priceOutput;
        cost = Number(cost.toFixed(6));
      }
    } catch (_error) {
      cost = 0;
    }
  }
  await prisma.aiRequestLog.create({
    data: {
      traceId: data.traceId,
      userId: data.userId,
      sessionId: data.sessionId,
      taskType: data.taskType,
      provider: data.provider,
      modelId: data.modelId,
      version: data.version || null,
      promptTemplateId: data.promptTemplateId || null,
      requestJson: JSON.stringify(data.requestJson || {}),
      responseJson: data.responseJson ? JSON.stringify(data.responseJson) : null,
      inputTokens: data.usage?.inputTokens || 0,
      outputTokens: data.usage?.outputTokens || 0,
      totalTokens: data.usage?.totalTokens || 0,
      cost: cost,
      latencyMs: data.latencyMs || 0,
      status: data.status,
      errorMessage: data.errorMessage || null,
      policyHitsJson: data.policyHits ? JSON.stringify(data.policyHits) : null
    }
  });
}

async function captureFunnelEvent(data: { userId: string; sessionId: string; eventType: string; payload?: unknown }) {
  await prisma.eventFunnelLog.create({
    data: {
      userId: data.userId,
      sessionId: data.sessionId,
      eventType: data.eventType,
      payloadJson: data.payload ? JSON.stringify(data.payload) : null
    }
  });
}

async function runAnalysis(userId: string, sessionId: string, type: TaskType, taskTypeKey: string, input: unknown): Promise<CommunityAnalysisResponse> {
  await ensureCommunitySession(userId, sessionId);
  const traceId = buildTraceId();
  const policy = await loadPolicyBundle();
  const inputText = JSON.stringify(input || {});

  await captureFunnelEvent({ userId, sessionId, eventType: "community_analysis_start", payload: { traceId, type } });

  const rate = policy.rateLimit;
  if (rate && rate.maxRequests > 0) {
    const since = new Date(Date.now() - rate.windowSeconds * 1000);
    const where: any = {
      createdAt: { gte: since },
      taskType: { in: ["community_bazi", "community_liuyao"] }
    };
    if (rate.scope === "user") {
      where.userId = userId;
    } else {
      where.userId = userId;
      where.sessionId = sessionId;
    }

    const recentCount = await prisma.aiRequestLog.count({ where });
    if (recentCount >= rate.maxRequests) {
      await logRiskHit({
        traceId,
        userId,
        sessionId,
        type: "rate_limit",
        level: "medium",
        detail: { rateLimit: rate, recentCount }
      });

      await logAiRequest({
        traceId,
        userId,
        sessionId,
        taskType: taskTypeKey,
        provider: "policy",
        modelId: "blocked",
        status: "blocked",
        requestJson: { input },
        responseJson: null,
        errorMessage: "rate_limited",
        policyHits: { rateLimit: rate, recentCount }
      });

      return {
        traceId,
        riskStatus: "blocked",
        result: buildRefuseResult(type, "请求过于频繁，请稍后再试。", policy.disclaimer)
      };
    }
  }

  if (containsAny(inputText, policy.highRiskWords)) {
    await logRiskHit({ traceId, userId, sessionId, type: "high_risk_input", level: "high", detail: { type } });
    await logAiRequest({
      traceId,
      userId,
      sessionId,
      taskType: taskTypeKey,
      provider: "policy",
      modelId: "blocked",
      status: "blocked",
      requestJson: { input },
      responseJson: null,
      errorMessage: "high_risk_input",
      policyHits: { highRiskWords: policy.highRiskWords }
    });
    return {
      traceId,
      riskStatus: "blocked",
      result: buildRefuseResult(type, policy.refuseTemplate, policy.disclaimer)
    };
  }

  const pick = await selectModelCandidatesForTask(taskTypeKey);
  const promptTemplate = await pickPromptTemplate(taskTypeKey, userId);
  const prompt = String(promptTemplate.content || "").replace("{{input}}", JSON.stringify(input));

  const attempts: any[] = [];
  let lastError: unknown = null;

  for (const selection of pick.candidates) {
    const started = Date.now();

    try {
      const call = await callAi(selection, prompt);
      const latencyMs = Date.now() - started;

      const rawParsed = extractJsonObject(call.text);
      if (!rawParsed) {
        throw new AppError(42041, "AI output is not valid JSON", 400);
      }

      const validated = AnalysisResultSchema.safeParse(rawParsed);
      if (!validated.success) {
        throw new AppError(42042, "AI output JSON schema validation failed", 400);
      }

      const result: CommunityAnalysisResult = {
        ...validated.data,
        type,
        disclaimer: policy.disclaimer
      };

      const outputText = JSON.stringify(result);
      if (containsAny(outputText, policy.bannedWords)) {
        attempts.push({
          provider: selection.provider,
          modelId: selection.modelId,
          version: selection.version,
          status: "blocked",
          latencyMs,
          reason: "banned_word_output"
        });

        await logRiskHit({
          traceId,
          userId,
          sessionId,
          type: "banned_word_output",
          level: "high",
          detail: { type, provider: selection.provider, modelId: selection.modelId, version: selection.version }
        });

        lastError = new AppError(42051, "banned_word_output", 400);
        continue;
      }

      attempts.push({
        provider: selection.provider,
        modelId: selection.modelId,
        version: selection.version,
        status: "success",
        latencyMs
      });

      await logAiRequest({
        traceId,
        userId,
        sessionId,
        taskType: taskTypeKey,
        provider: selection.provider,
        modelId: selection.modelId,
        version: selection.version,
        promptTemplateId: promptTemplate.id,
        status: "success",
        requestJson: { promptTemplate, input },
        responseJson: { text: call.text, parsed: result },
        usage: call.usage,
        latencyMs,
        policyHits: {
          routerMode: pick.mode,
          autoConfig: pick.autoConfig,
          attempts
        }
      });

      await captureFunnelEvent({ userId, sessionId, eventType: "community_analysis_success", payload: { traceId, type } });

      return {
        traceId,
        riskStatus: "pass",
        result,
        provider: selection.provider,
        modelId: selection.modelId,
        version: selection.version
      };
    } catch (error) {
      const latencyMs = Date.now() - started;
      const message = error instanceof Error ? error.message : "Unknown error";
      attempts.push({
        provider: selection.provider,
        modelId: selection.modelId,
        version: selection.version,
        status: "fail",
        latencyMs,
        reason: message
      });
      lastError = error;
      continue;
    }
  }

  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const lastProvider = String(lastAttempt?.provider || "auto");
  const lastModelId = String(lastAttempt?.modelId || "unknown");
  const lastVersion = lastAttempt?.version ? String(lastAttempt.version) : undefined;
  const lastLatencyMs = Number(lastAttempt?.latencyMs || 0);

  if (attempts.some((a) => a.status === "blocked")) {
    await logAiRequest({
      traceId,
      userId,
      sessionId,
      taskType: taskTypeKey,
      provider: lastProvider,
      modelId: lastModelId,
      version: lastVersion,
      promptTemplateId: promptTemplate.id,
      status: "blocked",
      requestJson: { promptTemplate, input },
      responseJson: null,
      latencyMs: lastLatencyMs,
      errorMessage: "banned_word_output",
      policyHits: {
        routerMode: pick.mode,
        autoConfig: pick.autoConfig,
        attempts
      }
    });

    return {
      traceId,
      riskStatus: "blocked",
      result: buildRefuseResult(type, "为确保合规，本次结果未返回，请尝试调整问题描述后再试。", policy.disclaimer),
      provider: lastProvider,
      modelId: lastModelId,
      version: lastVersion
    };
  }

  const message = lastError instanceof Error ? lastError.message : "AI request failed";
  await logAiRequest({
    traceId,
    userId,
    sessionId,
    taskType: taskTypeKey,
    provider: lastProvider,
    modelId: lastModelId,
    version: lastVersion,
    promptTemplateId: promptTemplate.id,
    status: "fail",
    requestJson: { promptTemplate, input },
    responseJson: null,
    latencyMs: lastLatencyMs,
    errorMessage: message,
    policyHits: {
      routerMode: pick.mode,
      autoConfig: pick.autoConfig,
      attempts
    }
  });

  throw lastError instanceof Error ? lastError : new AppError(42043, message, 400);
}
export async function analyzeCommunityBazi(userId: string, sessionId: string, payload: unknown): Promise<CommunityAnalysisResponse> {
  const parsed = BaziInputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(400210, "Invalid bazi input", 400);
  }
  return runAnalysis(userId, sessionId, "bazi", "community_bazi", parsed.data);
}

export async function analyzeCommunityLiuyao(userId: string, sessionId: string, payload: unknown): Promise<CommunityAnalysisResponse> {
  const parsed = LiuyaoInputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(400211, "Invalid liuyao input", 400);
  }
  return runAnalysis(userId, sessionId, "liuyao", "community_liuyao", parsed.data);
}

export async function saveCommunityDraft(userId: string, sessionId: string, type: TaskType, payload: unknown) {
  await ensureCommunitySession(userId, sessionId);
  const stored = await prisma.communityDraft.upsert({
    where: { userId_sessionId_type: { userId, sessionId, type } },
    update: { payload: JSON.stringify(payload || {}) },
    create: { userId, sessionId, type, payload: JSON.stringify(payload || {}) }
  });
  return {
    id: stored.id,
    type: stored.type,
    payload: safeJsonParse(stored.payload) || {},
    updatedAt: stored.updatedAt.getTime()
  };
}

export async function getLatestCommunityDraft(userId: string, sessionId: string) {
  const draft = await prisma.communityDraft.findFirst({
    where: { userId, sessionId },
    orderBy: { updatedAt: "desc" }
  });
  if (!draft) return null;
  return {
    id: draft.id,
    type: draft.type,
    payload: safeJsonParse(draft.payload) || {},
    updatedAt: draft.updatedAt.getTime()
  };
}

export async function saveCommunityReportFromTrace(userId: string, sessionId: string, traceId: string, title?: string) {
  await ensureCommunitySession(userId, sessionId);
  const existing = await prisma.communityReport.findFirst({
    where: { userId, sessionId, traceId, deletedAt: null }
  });
  if (existing) {
    return {
      id: existing.id,
      type: existing.type,
      title: existing.title || "",
      tags: safeJsonParse<string[]>(existing.tags) || [],
      createdAt: existing.createdAt.getTime()
    };
  }
  const log = await prisma.aiRequestLog.findUnique({ where: { traceId } });
  if (!log || log.userId !== userId || log.sessionId !== sessionId) {
    throw new AppError(404210, "Analysis trace not found", 404);
  }
  if (log.status !== "success" || !log.responseJson) {
    throw new AppError(400212, "Trace is not a successful analysis", 400);
  }

  const response = safeJsonParse<any>(log.responseJson) || {};
  const parsed = response.parsed ? response.parsed : extractJsonObject(String(response.text || ""));
  const validated = AnalysisResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AppError(400213, "Stored analysis result is invalid", 400);
  }
  const result = validated.data;
  const tags = Array.isArray(result.tags) ? result.tags : [];
  const request = safeJsonParse<any>(log.requestJson) || {};
  const input = request?.input || {};

  const report = await prisma.communityReport.create({
    data: {
      userId,
      sessionId,
      type: result.type,
      title: title ? String(title).trim() : null,
      input: JSON.stringify(input),
      output: JSON.stringify(result),
      tags: JSON.stringify(tags),
      traceId,
      riskStatus: "pass",
      provider: log.provider,
      modelId: log.modelId,
      version: log.version
    }
  });

  await captureFunnelEvent({ userId, sessionId, eventType: "community_report_saved", payload: { reportId: report.id, traceId } });
  return {
    id: report.id,
    type: report.type,
    title: report.title || "",
    tags,
    createdAt: report.createdAt.getTime()
  };
}

export async function listCommunityReports(userId: string, sessionId: string) {
  const rows = await prisma.communityReport.findMany({
    where: { userId, sessionId, deletedAt: null },
    orderBy: { createdAt: "desc" }
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title || "",
    tags: safeJsonParse<string[]>(r.tags) || [],
    createdAt: r.createdAt.getTime()
  }));
}

export async function getCommunityReportById(userId: string, sessionId: string, id: string) {
  const row = await prisma.communityReport.findFirst({
    where: { id, userId, sessionId, deletedAt: null }
  });
  if (!row) {
    throw new AppError(404211, "Report not found", 404);
  }
  return {
    id: row.id,
    type: row.type,
    title: row.title || "",
    input: safeJsonParse(row.input) || {},
    output: safeJsonParse(row.output) || {},
    tags: safeJsonParse<string[]>(row.tags) || [],
    provider: row.provider || "",
    modelId: row.modelId || "",
    version: row.version || "",
    createdAt: row.createdAt.getTime()
  };
}

export async function deleteCommunityReport(userId: string, sessionId: string, id: string) {
  const row = await prisma.communityReport.findFirst({
    where: { id, userId, sessionId, deletedAt: null }
  });
  if (!row) {
    throw new AppError(404212, "Report not found", 404);
  }
  await prisma.communityReport.update({
    where: { id },
    data: { deletedAt: new Date() }
  });
  await captureFunnelEvent({ userId, sessionId, eventType: "community_report_deleted", payload: { reportId: id } });
  return { ok: true };
}

type TagFilter = {
  element?: string[];
  material?: string[];
  keyword?: string;
  categoryIds?: string[];
};

function matchItem(item: any, filter: TagFilter) {
  const name = String(item?.name || "");
  const meaning = String(item?.meaning || "");
  const description = String(item?.description || "");
  const element = String(item?.element || "");
  const material = String(item?.material || "");
  const categoryName = String(item?._categoryName || "");
  const mainName = String(item?._mainName || "");

  const hay = `${name} ${meaning} ${description} ${categoryName} ${mainName} ${element} ${material}`.toLowerCase();

  const hasAny = (arr?: string[]) =>
    Array.isArray(arr) && arr.some((x) => x && hay.includes(String(x).toLowerCase()));

  if (filter.element && filter.element.length > 0) {
    if (!hasAny(filter.element)) return false;
  }
  if (filter.material && filter.material.length > 0) {
    if (!hasAny(filter.material)) return false;
  }
  if (filter.keyword && filter.keyword.trim()) {
    if (!hay.includes(filter.keyword.trim().toLowerCase())) return false;
  }
  return true;
}

export async function recommendCommunityBeadsByTags(tags: string[]) {
  const normalized = Array.from(new Set(tags.map((t) => String(t || "").trim()).filter(Boolean))).slice(0, 20);
  if (normalized.length === 0) return [];
  const mappings = await prisma.communityTagMapping.findMany({
    where: { enabled: true, tag: { in: normalized } }
  });
  const map = new Map(mappings.map((m) => [m.tag, safeJsonParse<TagFilter>(m.filter) || {}]));
  const tree = await getInventoryTreeForClient();
  const allItems: any[] = [];
  for (const main of tree.mainCategories || []) {
    for (const sub of main.subCategories || []) {
      for (const item of sub.items || []) {
        allItems.push({ ...item, _categoryId: sub.id, _categoryName: sub.name, _mainId: main.id, _mainName: main.name });
      }
    }
  }

  return normalized.map((tag) => {
    // If the tag is not configured in mapping, fall back to keyword match for broader coverage.
    const filter = map.get(tag) || { keyword: tag };
    const items = allItems
      .filter((it) => (filter.categoryIds && filter.categoryIds.length > 0 ? filter.categoryIds.includes(it._categoryId) : true))
      .filter((it) => matchItem(it, filter))
      .slice(0, 24)
      .map((it) => ({
        id: it.id,
        name: it.name,
        price: Number(it.price || 0),
        sizeMm: Number(it.sizeMm || 0),
        color: it.color,
        image: it.image,
        inStock: it.inStock !== false,
        material: it.material,
        element: it.element,
        meaning: it.meaning,
        description: it.description,
        images: Array.isArray(it.images) ? it.images : [],
        categoryId: it._categoryId,
        categoryName: it._categoryName,
        mainCategoryId: it._mainId,
        mainCategoryName: it._mainName
      }));
    return { tag, filter, items };
  });
}













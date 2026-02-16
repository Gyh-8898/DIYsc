export type ToastType = 'success' | 'error';

export function toNum(v: unknown, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function safeJsonPretty(raw: string) {
  const text = String(raw || '').trim();
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return raw;
  }
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(String(raw || '')) as T;
  } catch {
    return fallback;
  }
}


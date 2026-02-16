const BLOCKED_HOST_PATTERNS = [/images\.unsplash\.com/i];

export function normalizePublicImageUrl(input: unknown): string {
  const value = String(input || '').trim();
  if (!value) return '';

  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(value)) {
      return '';
    }
  }

  return value;
}


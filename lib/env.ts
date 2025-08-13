export function hasAIKey(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
}

export function getAllowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS || '';
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

export function isHealthProtected(): boolean {
  return typeof process.env.HEALTH_TOKEN === 'string' && process.env.HEALTH_TOKEN.length > 0;
}



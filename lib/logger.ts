function maskSecrets(input: unknown): string {
  try {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return str
      .replace(/(apiKey|authorization|token|secret|password)\s*[:=]\s*"[^"]+"/gi, '$1:"***"')
      .replace(/(apiKey|authorization|token|secret|password)\s*[:=]\s*'[^']+'/gi, "$1:'***'")
      .replace(/(AIza[0-9A-Za-z\-_]{35})/g, '***');
  } catch {
    return '[unserializable]';
  }
}

function truncate(text: string, max = 300): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...<truncated>';
}

const env = process.env.NODE_ENV || 'development';

export const logger = {
  debug: (...args: unknown[]) => {
    if (env !== 'production') console.debug(...args.map(maskSecrets));
  },
  info: (...args: unknown[]) => {
    if (env !== 'production') console.info(...args.map(maskSecrets));
  },
  warn: (...args: unknown[]) => {
    console.warn(...args.map(maskSecrets));
  },
  error: (...args: unknown[]) => {
    const mapped = args.map(a => {
      if (a instanceof Error) return a;
      const s = String(a);
      return truncate(maskSecrets(s));
    });
    console.error(...mapped);
  },
};

export { maskSecrets, truncate };



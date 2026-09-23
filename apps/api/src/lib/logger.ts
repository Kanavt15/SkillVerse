/**
 * Structured JSON logger.
 *
 * Workers Logs (enabled by `observability` in wrangler.jsonc) indexes JSON
 * fields, so logging objects instead of strings makes logs searchable
 * ("show every error for requestId X").
 *
 * PRIVACY/SECURITY: keys that commonly carry secrets or personal data are
 * redacted automatically. Still, never log request bodies wholesale.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
}

const REDACT =
  /pass(word)?|secret|token|authorization|cookie|otp|signature|api[-_]?key|card|cvv|pan/i;

/** Returns a deep copy of `value` with sensitive-looking keys replaced by "[REDACTED]". */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

/** Creates a logger whose every line includes `base` (e.g. the request ID). */
export function createLogger(base: Fields = {}): Logger {
  const write = (level: Level, msg: string, fields?: Fields) => {
    const line = JSON.stringify({
      level,
      msg,
      time: new Date().toISOString(),
      ...base,
      ...(fields ? (redact(fields) as Fields) : {}),
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
  };
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
  };
}

/** Private D1/rate-limit bridge for the Render runtime. Never expose its key to a browser. */
import { z } from 'zod';

interface GatewayEnv {
  DB: D1Database;
  RL_API: RateLimit;
  RL_AUTH: RateLimit;
  GATEWAY_KEY: string;
}
const statementSchema = z.strictObject({
  sql: z.string().min(1).max(524288),
  params: z
    .array(z.union([z.string(), z.number(), z.null(), z.array(z.number().int().min(0).max(255))]))
    .max(1000),
});
const querySchema = z.strictObject({
  mode: z.enum(['batch', 'all', 'raw']),
  statements: z.array(statementSchema).min(1).max(900),
});
const limitSchema = z.strictObject({
  binding: z.enum(['RL_API', 'RL_AUTH']),
  key: z.string().min(1).max(256),
});
const MAX_BYTES = 8 * 1024 * 1024;

async function authorized(request: Request, secret: string) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || secret.length < 32 || supplied.length > 256) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(secret)),
  ]);
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
  return difference === 0;
}

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export default {
  async fetch(request: Request, env: GatewayEnv): Promise<Response> {
    const json = (body: unknown, status = 200) =>
      Response.json(body, {
        status,
        headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      });
    if (!(await authorized(request, env.GATEWAY_KEY))) return json({ error: 'UNAUTHORIZED' }, 401);
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
      const input = await readBody(request),
        path = new URL(request.url).pathname;
      if (path === '/limit') {
        const parsed = limitSchema.safeParse(input);
        if (!parsed.success) return json({ error: 'INVALID_INPUT' }, 400);
        return json(await env[parsed.data.binding].limit({ key: parsed.data.key }));
      }
      if (path !== '/query') return json({ error: 'NOT_FOUND' }, 404);
      const parsed = querySchema.safeParse(input);
      if (!parsed.success) return json({ error: 'INVALID_INPUT' }, 400);
      const { mode, statements } = parsed.data;
      const prepared = statements.map((s) => env.DB.prepare(s.sql).bind(...s.params));
      if (mode === 'batch') return json(await env.DB.batch(prepared));
      if (prepared.length !== 1) return json({ error: 'INVALID_INPUT' }, 400);
      return json(
        mode === 'raw' ? await prepared[0]!.raw({ columnNames: true }) : await prepared[0]!.all(),
      );
    } catch (error) {
      const message = String(error);
      // Only this application conflict is safe to send across the runtime boundary.
      const code = message.includes('COURSE_REVIEW_LOCK')
        ? 'COURSE_REVIEW_LOCK'
        : message.includes('BODY_TOO_LARGE')
          ? 'BODY_TOO_LARGE'
          : 'GATEWAY_FAILED';
      return json({ error: code }, code === 'BODY_TOO_LARGE' ? 413 : 500);
    }
  },
} satisfies ExportedHandler<GatewayEnv>;

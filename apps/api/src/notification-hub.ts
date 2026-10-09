/** Per-user hibernating WebSockets; send refresh hints only, never inbox contents or client broadcasts. */
import { DurableObject } from 'cloudflare:workers';
import { createDb, schema } from '@skillverse/db';
import { and, eq, gt, isNull, or } from 'drizzle-orm';

export class NotificationHub extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/publish' && request.method === 'POST') {
      const sockets = this.ctx.getWebSockets();
      // Revalidate each distinct session before delivering any activity hint (including after logout).
      const valid = new Map<string, boolean>();
      for (const ws of sockets) {
        const attachment = ws.deserializeAttachment() as { tokenHash: string; userId: string };
        let active = valid.get(attachment.tokenHash);
        if (active === undefined) {
          const { sessions, users, mfaTotp } = schema;
          const session = await createDb(this.env.DB)
            .select({ id: sessions.id })
            .from(sessions)
            .innerJoin(users, eq(users.id, sessions.userId))
            .leftJoin(mfaTotp, eq(mfaTotp.userId, users.id))
            .where(
              and(
                eq(sessions.id, attachment.tokenHash),
                eq(sessions.userId, attachment.userId),
                eq(users.status, 'active'),
                gt(sessions.expiresAt, new Date()),
                gt(sessions.idleExpiresAt, new Date()),
                or(isNull(mfaTotp.enabledAt), eq(sessions.mfaVerified, true)),
              ),
            )
            .get();
          active = Boolean(session);
          valid.set(attachment.tokenHash, active);
        }
        try {
          if (active) ws.send('{"type":"refresh"}');
          else ws.close(1008, 'Session expired');
        } catch {
          ws.close(1011, 'Reconnect');
        }
      }
      return new Response(null, { status: 204 });
    }
    if (path !== '/connect' || request.method !== 'GET')
      return new Response('Not found', { status: 404 });
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket upgrade required', { status: 426 });
    const tokenHash = request.headers.get('x-session-hash'),
      userId = request.headers.get('x-user-id');
    if (!tokenHash || !userId) return new Response('Unauthorized', { status: 401 });
    if (this.ctx.getWebSockets().length >= 5)
      return new Response('Too many connections', { status: 429 });
    const pair = new WebSocketPair(),
      client = pair[0],
      server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ tokenHash, userId });
    return new Response(null, { status: 101, webSocket: client });
  }
  override webSocketMessage(ws: WebSocket) {
    ws.close(1008, 'This connection only receives notification updates.');
  }
  override webSocketError(ws: WebSocket) {
    ws.close(1011, 'Reconnect');
  }
}

# Persistent and live notifications

The signed-in header links to `/notifications` and shows an unread count rendered on the server. The inbox supports all/unread filters, 20 alerts per page, marking one or all alerts read, and discussion preferences. Links, forms and the persistent inbox work without JavaScript.

## Events and persistence

`notifications` belongs to one recipient and contains server-generated copy and a same-origin destination. A unique event/recipient key deduplicates retries. `notification_preferences` defaults discussion alerts to enabled; disabling them affects future alerts without deleting previous ones. Moderation feedback is always delivered.

- A new question alerts its instructor.
- A reply alerts the question author and instructor, deduplicating recipients and suppressing the actor's own alert.
- An accepted answer alerts its reply author once per question/reply pair; clearing and reaccepting the same answer does not send another alert.
- Hiding or restoring content sends the author the staff feedback. Dismissal does not alert the reported user or disclose the reporting identity.

The originating action and its notification inserts share an atomic D1 batch. Conditional inserts check the successful question/reply/solution/decision, current preference and recipient existence. A stale moderation decision or failed course write creates no alert. Reply links include the correct page and anchor at creation time. Later hidden replies can move pagination; the thread still remains the destination.

## Live channel

The API exports `NotificationHub`, a SQLite-backed Durable Object with one namespace instance per user and at most five hibernating WebSocket connections. Bindings are declared independently for development, staging and production. The class migration is in Wrangler; D1 migration `0008_notifications.sql` creates the inbox and preference tables.

`GET /api/v1/me/notifications/live` requires a valid session, a WebSocket upgrade and an exact allowed website Origin. The namespace and internal identity headers come from the resolved session, overriding any client-supplied user ID. The Durable Object endpoints are reachable through trusted Worker bindings, not public API routes. Before publishing, the hub rechecks attached session hashes against account status, expiry, revocation and the MFA state. Client broadcasts close the socket. Ping/pong uses the hibernation auto-response mechanism.

The live payload is only a refresh hint. Notification text and counts are fetched through authenticated, recipient-scoped API routes. Socket failures cannot lose persisted alerts or make a successful discussion action fail. The client reconnects with bounded backoff, refreshes on reconnect/focus/network recovery and closes on teardown. The inbox revalidates on hints without periodic inbox polling. Production CSP explicitly permits only the website's secure socket origin.

See Cloudflare's [hibernation server example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/) for the runtime mechanism. The local Vitest Worker tests exercise the real Durable Object and WebSocket upgrade, including cross-user routing, Origin/auth gates, ping/pong, revoked sessions, refused broadcasts and the connection cap. Chromium checks live badge updates, inbox read controls, persisted preferences and mobile accessibility.

Email notifications, retention/pruning policy and additional event families remain future enhancements. No staging or production resources are created by local tests.

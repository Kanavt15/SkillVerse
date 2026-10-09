/** Live unread badge with reconnect/focus recovery; the persisted inbox works without JavaScript. */
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const count = liveCount ?? initialCount;
  useEffect(() => {
    let disposed = false,
      stopped = false,
      socket: WebSocket | null = null,
      delay = 1000;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const controller = new AbortController();
    let refreshing = false,
      queued = false,
      queuedRevalidation = false;
    async function refresh(revalidate = false) {
      if (disposed) return;
      if (refreshing) {
        queued = true;
        queuedRevalidation ||= revalidate;
        return;
      }
      refreshing = true;
      try {
        const response = await fetch('/api/v1/me/notifications/unread', {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (response.status === 401) {
          stopped = true;
          socket?.close();
          if (!disposed) setLiveCount(0);
          return;
        }
        if (!response.ok) return;
        const result = (await response.json()) as { ok: boolean; data?: { unreadCount: number } };
        if (!disposed && result.ok && Number.isInteger(result.data?.unreadCount)) {
          setLiveCount(result.data!.unreadCount);
          if (revalidate) window.dispatchEvent(new Event('skillverse:notifications'));
        }
      } catch {
        /* Persistent inbox and focus recovery remain available during disconnects. */
      } finally {
        refreshing = false;
        if (queued) {
          const next = queuedRevalidation;
          queued = false;
          queuedRevalidation = false;
          void refresh(next);
        }
      }
    }
    function connect() {
      if (
        disposed ||
        stopped ||
        !navigator.onLine ||
        (socket && socket.readyState < WebSocket.CLOSING)
      )
        return;
      const url = new URL('/api/v1/me/notifications/live', window.location.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(url);
      socket.onopen = () => {
        delay = 1000;
        void refresh();
        heartbeat = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN && document.visibilityState === 'visible')
            socket.send('ping');
        }, 30000);
      };
      socket.onmessage = (event) => {
        if (event.data === '{"type":"refresh"}') void refresh(true);
      };
      socket.onclose = (event) => {
        clearInterval(heartbeat);
        if (event.code === 1008) {
          stopped = true;
          void refresh();
        }
        if (!disposed && !stopped) {
          retry = setTimeout(connect, delay);
          delay = Math.min(delay * 2, 30000);
        }
      };
    }
    function recover() {
      if (document.visibilityState === 'visible') {
        void refresh(true);
        clearTimeout(retry);
        connect();
      }
    }
    void refresh();
    connect();
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(retry);
      clearInterval(heartbeat);
      socket?.close();
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
    };
    // Reconcile a server-rendered count as well when the live channel is unavailable.
  }, [initialCount]);
  return (
    <Link
      to="/notifications"
      aria-label={count ? `Notifications, ${count} unread` : 'Notifications, no unread'}
      className="relative flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
    >
      <Bell className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-0 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 font-semibold text-brand-fg"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

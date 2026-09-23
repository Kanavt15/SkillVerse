/**
 * Values created once per request in workers/app.ts and readable from
 * entry.server.tsx, loaders, actions and middleware via `context.get(...)`.
 */
import { createContext } from 'react-router';

/** The CSP nonce for this response (see lib/security.server.ts). */
export const nonceContext = createContext<string>('');

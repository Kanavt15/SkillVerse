/**
 * Identity tables: who a user is, what they're allowed to be, and their sessions.
 * Phase 1 (auth) adds OAuth accounts, email tokens and MFA tables alongside these.
 */
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { ROLES } from '@skillverse/shared';
import { id, timestamps } from './_columns';

export const users = sqliteTable(
  'users',
  {
    id: id(),
    /** Login email, stored trimmed + lower-cased. Unique across all accounts. */
    email: text('email').notNull().unique(),
    /** When the user proved they own `email`. NULL = not verified yet (purchases/posting are blocked). */
    emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),
    /** Public handle used in profile URLs (/@username). Lower-case, unique. */
    username: text('username').notNull().unique(),
    /** Name shown in the UI. */
    displayName: text('display_name').notNull(),
    /**
     * Versioned password hash, e.g. "pbkdf2$100000$<salt>$<hash>".
     * NULL for accounts that only sign in with Google or email links.
     * Never selected by default queries; never sent to clients.
     */
    passwordHash: text('password_hash'),
    /** R2 object key of the profile picture, or NULL for the default avatar. */
    avatarKey: text('avatar_key'),
    /** active = normal; suspended = blocked by a moderator; deleted = pending hard delete. */
    status: text('status', { enum: ['active', 'suspended', 'deleted'] })
      .notNull()
      .default('active'),
    /** Set when the user asks to delete their account; a cron job hard-deletes 30 days later. */
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [index('users_status_idx').on(t.status)],
);

/** Extra roles on top of the implicit `learner`. One row per (user, role). */
export const userRoles = sqliteTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** One of ROLES in @skillverse/shared. */
    role: text('role', { enum: ROLES }).notNull(),
    /** Admin who granted it, or NULL when granted automatically (e.g. earned fast-track). */
    grantedBy: text('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

/**
 * Server-side sessions. The browser holds a random 256-bit token in an HttpOnly
 * cookie; we store only its SHA-256 hash as `id`. A database leak therefore
 * does not let anyone impersonate users.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 (hex) of the session token. The raw token is never stored. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Hard limit: the session dies at this time no matter how active it is (30 days). */
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    /** Sliding limit: pushed forward on activity; the session dies after 7 idle days. */
    idleExpiresAt: integer('idle_expires_at', { mode: 'timestamp_ms' }).notNull(),
    /** True once the user passed the 2FA challenge in this session. */
    mfaVerified: integer('mfa_verified', { mode: 'boolean' }).notNull().default(false),
    /** Salted hash of the client IP (for "your sessions" UI and abuse checks, not tracking). */
    ipHash: text('ip_hash'),
    /** Browser user-agent, truncated to 255 chars, shown in "your sessions". */
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

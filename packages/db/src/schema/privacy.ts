/** Private eligibility, consent, support and bounded export artifacts. Never selected in public views. */
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { id, timestamps } from './_columns';
import { users } from './identity';

export const guardianRequests = sqliteTable(
  'guardian_requests',
  {
    id: id(),
    guardianUserId: text('guardian_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    scope: text('scope', { enum: ['learning', 'teaching'] }).notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'revoked'] })
      .notNull()
      .default('pending'),
    consentVersion: text('consent_version').notNull(),
    version: integer('version').notNull().default(0),
    identityMethod: text('identity_method'),
    verificationReference: text('verification_reference'),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewNotes: text('review_notes').notNull().default(''),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    verificationValidUntil: integer('verification_valid_until', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    index('guardian_requests_owner_idx').on(t.guardianUserId, t.createdAt),
    index('guardian_requests_status_idx').on(t.status, t.createdAt),
  ],
);
export const accountPrivacy = sqliteTable('account_privacy', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  birthDate: text('birth_date'),
  termsVersion: text('terms_version').notNull(),
  privacyVersion: text('privacy_version').notNull(),
  instructorVersion: text('instructor_version'),
  agreedAt: integer('agreed_at', { mode: 'timestamp_ms' }).notNull(),
  guardianRequestId: text('guardian_request_id').references(() => guardianRequests.id, {
    onDelete: 'set null',
  }),
  externalMedia: integer('external_media', { mode: 'boolean' }).notNull().default(false),
  version: integer('version').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const guardianInvitations = sqliteTable(
  'guardian_invitations',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id')
      .notNull()
      .references(() => guardianRequests.id, { onDelete: 'cascade' }),
    childEmailHash: text('child_email_hash'),
    childBirthDate: text('child_birth_date'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    usedByUserId: text('used_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('guardian_invitations_request_idx').on(t.requestId, t.createdAt)],
);
export const privacyExports = sqliteTable(
  'privacy_exports',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: text('state', {
      enum: ['queued', 'building', 'ready', 'failed', 'expired', 'cancelled'],
    })
      .notNull()
      .default('queued'),
    resourceIndex: integer('resource_index').notNull().default(0),
    cursor: text('cursor').notNull().default(''),
    part: integer('part').notNull().default(0),
    bytes: integer('bytes').notNull().default(0),
    leaseNonce: text('lease_nonce'),
    leaseUntil: integer('lease_until').notNull().default(0),
    error: text('error'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps(),
  },
  (t) => [
    index('privacy_exports_owner_idx').on(t.userId, t.createdAt),
    index('privacy_exports_state_idx').on(t.state, t.leaseUntil),
  ],
);
export const privacyExportParts = sqliteTable(
  'privacy_export_parts',
  {
    exportId: text('export_id')
      .notNull()
      .references(() => privacyExports.id, { onDelete: 'cascade' }),
    part: integer('part').notNull(),
    body: text('body').notNull(),
  },
  (t) => [primaryKey({ columns: [t.exportId, t.part] })],
);
export const supportRequests = sqliteTable(
  'support_requests',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    category: text('category', {
      enum: ['account', 'privacy', 'guardian', 'content', 'general'],
    }).notNull(),
    status: text('status', { enum: ['unverified', 'open', 'resolved', 'erased'] })
      .notNull()
      .default('unverified'),
    verificationHash: text('verification_hash'),
    verificationExpiresAt: integer('verification_expires_at', { mode: 'timestamp_ms' }),
    verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
    version: integer('version').notNull().default(0),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    index('support_requests_email_idx').on(t.email, t.createdAt),
    index('support_requests_status_idx').on(t.status, t.createdAt),
    index('support_verification_idx').on(t.verificationHash),
  ],
);
export const supportReplies = sqliteTable(
  'support_replies',
  {
    id: id(),
    requestId: text('request_id')
      .notNull()
      .references(() => supportRequests.id, { onDelete: 'cascade' }),
    staffUserId: text('staff_user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    deliveryState: text('delivery_state', {
      enum: ['pending', 'delivering', 'delivered', 'failed', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('support_replies_request_idx').on(t.requestId, t.createdAt),
    index('support_replies_delivery_idx').on(t.deliveryState, t.nextAttemptAt),
  ],
);

/** Provider attempts are session-bound. No Aadhaar number, XML, address, photo or legal name is stored. */
export const guardianVerifications = sqliteTable('guardian_verifications', {
  requestId: text('request_id')
    .primaryKey()
    .references(() => guardianRequests.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull().unique(),
  sessionHash: text('session_hash').notNull(),
  stateHash: text('state_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** Teacher identity receipts; provider document data is never persisted. */
export const teacherVerifications = sqliteTable('teacher_verifications', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull().unique(),
  sessionHash: text('session_hash').notNull(),
  stateHash: text('state_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
  validUntil: integer('valid_until', { mode: 'timestamp_ms' }),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

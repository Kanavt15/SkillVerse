/**
 * The signed-in user's own account: "me" view, profile edits, and session management.
 */
import { eq } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import type { UpdateProfileInput } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { AppError } from '../lib/errors';
import {
  deleteSessionByHandle,
  deleteUserSessions,
  listUserSessions,
} from '../repositories/sessions.repository';
import { findProfile } from '../repositories/users.repository';

/** Shape returned by GET /api/v1/me. Contains only the user's own, non-secret data. */
export async function getMe(db: Db, auth: AuthContext) {
  const profile = await findProfile(db, auth.user.id);
  return {
    id: auth.user.id,
    email: auth.user.email,
    emailVerified: auth.user.emailVerified,
    mfaEnabled: auth.user.mfaEnabled,
    username: auth.user.username,
    displayName: auth.user.displayName,
    roles: auth.roles,
    profile: {
      headline: profile?.headline ?? '',
      bio: profile?.bio ?? '',
      websiteUrl: profile?.websiteUrl ?? null,
      location: profile?.location ?? null,
      timezone: profile?.timezone ?? 'Asia/Kolkata',
      interests: safeJsonArray(profile?.interests),
      goal: profile?.goal ?? null,
      onboarded: Boolean(profile?.onboardedAt),
    },
  };
}

function safeJsonArray(value: string | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function updateProfile(db: Db, userId: string, input: UpdateProfileInput) {
  const profilePatch: Partial<typeof schema.userProfiles.$inferInsert> = {};
  if (input.headline !== undefined) profilePatch.headline = input.headline;
  if (input.bio !== undefined) profilePatch.bio = input.bio;
  if (input.websiteUrl !== undefined) profilePatch.websiteUrl = input.websiteUrl || null;
  if (input.location !== undefined) profilePatch.location = input.location || null;
  if (input.timezone !== undefined) profilePatch.timezone = input.timezone;
  if (input.interests !== undefined)
    profilePatch.interests = JSON.stringify([...new Set(input.interests)]);
  if (input.goal !== undefined) profilePatch.goal = input.goal;
  if (input.completeOnboarding) profilePatch.onboardedAt = new Date();

  const statements = [];
  if (Object.keys(profilePatch).length > 0) {
    statements.push(
      db
        .update(schema.userProfiles)
        .set(profilePatch)
        .where(eq(schema.userProfiles.userId, userId)),
    );
  }
  if (input.displayName !== undefined) {
    statements.push(
      db
        .update(schema.users)
        .set({ displayName: input.displayName })
        .where(eq(schema.users.id, userId)),
    );
  }
  if (statements.length === 1) await statements[0];
  else if (statements.length > 1)
    await db.batch(statements as [(typeof statements)[0], ...typeof statements]);
}

export async function listSessions(db: Db, auth: AuthContext) {
  const rows = await listUserSessions(db, auth.user.id);
  return rows.map((s) => ({
    handle: s.handle,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    current: s.id === auth.session.tokenHash,
  }));
}

export async function revokeSession(db: Db, auth: AuthContext, handle: string) {
  const deleted = await deleteSessionByHandle(db, auth.user.id, handle);
  // 404 (not 403) for someone else's handle: don't confirm it exists.
  if (deleted.length === 0) throw new AppError('NOT_FOUND', 'Session not found.');
}

export async function revokeOtherSessions(db: Db, auth: AuthContext) {
  await deleteUserSessions(db, auth.user.id, auth.session.tokenHash);
}

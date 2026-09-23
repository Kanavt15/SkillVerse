/**
 * Feature flags: which features are switched on.
 *
 * Flags are read on many requests but change rarely, so the result is kept in
 * memory inside the Worker isolate for 60 seconds. After an admin flips a flag
 * it takes up to a minute to apply everywhere.
 *
 * Why not Workers KV? The free plan allows only 1,000 KV writes per day, and a
 * refresh-every-minute cache would exceed that on its own. Isolate memory is
 * free and unlimited; the cost is one small D1 read per isolate per minute.
 * See docs/operations/free-tier-limits.md.
 */
import type { Db } from '@skillverse/db';
import { listFeatureFlags } from '../repositories/feature-flags.repository';

const TTL_MS = 60_000;

export type FeatureMap = Record<string, boolean>;

let cache: { value: FeatureMap; expires: number } | null = null;

/**
 * Flags as seen by an anonymous visitor: a flag counts as ON only when it is
 * enabled for 100% of users. Per-user percentage rollouts are evaluated
 * separately once we know who the user is.
 */
export async function getPublicFeatures(db: Db, now = Date.now()): Promise<FeatureMap> {
  if (cache && cache.expires > now) return cache.value;

  const rows = await listFeatureFlags(db);
  const features: FeatureMap = {};
  for (const row of rows) features[row.key] = row.enabled && row.rolloutPercent >= 100;

  cache = { value: features, expires: now + TTL_MS };
  return features;
}

/** Drops the cached flags. Used by tests and, later, by the admin "save flag" action. */
export function clearFeatureCache(): void {
  cache = null;
}

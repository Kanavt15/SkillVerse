/**
 * Feature flags: which features are switched on.
 *
 * Flags are read on many requests but change rarely, so the result is cached
 * in KV for 60 seconds (the KV minimum). After an admin flips a flag, it
 * takes up to a minute to apply everywhere.
 */
import type { Db } from '@skillverse/db';
import { listFeatureFlags } from '../repositories/feature-flags.repository';

const CACHE_KEY = 'feature-flags:v1';
const CACHE_TTL_SECONDS = 60;

export type FeatureMap = Record<string, boolean>;

/**
 * Flags as seen by an anonymous visitor: a flag counts as ON only when it is
 * enabled for 100% of users. Per-user percentage rollouts are evaluated
 * separately once we know who the user is.
 */
export async function getPublicFeatures(db: Db, cache: KVNamespace): Promise<FeatureMap> {
  const cached = await cache.get<FeatureMap>(CACHE_KEY, 'json');
  if (cached) return cached;

  const rows = await listFeatureFlags(db);
  const features: FeatureMap = {};
  for (const row of rows) features[row.key] = row.enabled && row.rolloutPercent >= 100;

  await cache.put(CACHE_KEY, JSON.stringify(features), { expirationTtl: CACHE_TTL_SECONDS });
  return features;
}

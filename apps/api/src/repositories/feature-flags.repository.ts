/**
 * Data access for the `feature_flags` table.
 * Repositories contain ONLY queries: no caching, no business rules, no HTTP.
 */
import { schema, type Db } from '@skillverse/db';

export function listFeatureFlags(db: Db) {
  return db
    .select({
      key: schema.featureFlags.key,
      enabled: schema.featureFlags.enabled,
      rolloutPercent: schema.featureFlags.rolloutPercent,
    })
    .from(schema.featureFlags);
}

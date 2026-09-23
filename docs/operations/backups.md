# Backups and restore

## What protects the data

| Layer                 | What it gives you                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 Time Travel**    | Point-in-time restore of the whole database to any minute in the retention window (7 days on free, 30 days on paid). Automatic, no setup. |
| **Manual exports**    | A full SQL dump you keep yourself: protection against account problems and long-ago mistakes.                                             |
| **Migrations in git** | The schema can always be rebuilt from `packages/db/migrations/`.                                                                          |

## Weekly export (until it's automated in Phase 2)

```bash
cd apps/api
npx wrangler d1 export DB --remote --env production --output ../../../skillverse-backup-$(date +%F).sql
```

- Store backups **outside the repository**, in encrypted storage only you control. They contain personal data.
- Keep at least the last 4 weekly backups.
- Delete backups older than your retention policy (document it in the privacy policy).

## Restore with Time Travel

1. Find a safe point in time (just before the bad change). The `audit_logs` table and Workers Logs help here.
2. See the available restore points:
   ```bash
   cd apps/api
   npx wrangler d1 time-travel info DB --env production
   ```
3. Restore (this **replaces** the current database contents):
   ```bash
   npx wrangler d1 time-travel restore DB --env production --timestamp=2026-09-23T10:15:00Z
   ```
4. Check the site and the affected data. Note the restore in the incident timeline.

⚠️ Everything written after the restore point is lost. For a partial mistake (one table, a few rows), prefer restoring into a **new** database and copying only the affected rows back.

## Restore from an export file

```bash
cd apps/api
npx wrangler d1 create skillverse-restore-test
npx wrangler d1 execute skillverse-restore-test --remote --file=../../../skillverse-backup-2026-09-20.sql
```

## Practise

Once per quarter, restore the latest export into a scratch database and check that it opens and has recent data. An untested backup might not work when you need it.

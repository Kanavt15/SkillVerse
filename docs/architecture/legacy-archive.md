# Verified legacy source reference

On 2026-10-12 the cached local Git history contains the former application at
`origin/main`, pinned to **`eaa052e8d4723e9b0ec582f311ed7085f3c69195`**.
The local `legacy-v1` tag does not exist. Verification used read-only Git tree/file
inspection, without fetching, executing old code or installing its dependencies.
This verifies local source availability, not the current remote state or a backup.

```sh
git cat-file -t eaa052e8d4723e9b0ec582f311ed7085f3c69195
git ls-tree --name-only eaa052e8d4723e9b0ec582f311ed7085f3c69195
git show eaa052e8d4723e9b0ec582f311ed7085f3c69195:backend/package.json
```

That tree includes `backend`, `frontend` and `database`. The backend manifest
includes Express 4, **mysql2**, ioredis, Razorpay and Socket.IO. Older planning
text described MongoDB; the inspected archive uses MySQL tooling, so do not use
that description as a migration specification. Controllers include gamification,
points, wallet and payments, with a gamification cron module.

For later domain work, inspect this exact commit's business rules, identify the
intended behavior and dependencies, then write current D1/Hono contracts and
authorization/ledger/replay tests before porting anything. Do not copy legacy
payment, wallet or role-update controllers into production. The current TODO
phase ordering and security/financial constraints remain authoritative.

Preserve this commit in your normal repository backup before changing refs.
No archival tag, remote branch, old runtime or credentials were changed here.

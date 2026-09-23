# Contributing to SkillVerse

Thanks for helping build SkillVerse! This document is the full rulebook. For the step-by-step path of your first change, see [README → Your first contribution](README.md#11-your-first-contribution).

## Ground rules

1. **Security and correctness beat speed.** If you're unsure whether something is safe, ask in the PR.
2. **Docs change with code.** A PR that changes behaviour without updating the docs is incomplete.
3. **Small PRs.** One feature or fix per PR, ideally under ~400 changed lines excluding generated files.
4. **Everything green.** `npm run check` must pass before you ask for review.

## Branches

- The main branch is always deployable.
- Branch names: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`, `refactor/<topic>`.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <what changed, imperative, lower case>

<optional body: WHY, not how. Wrap at ~72 chars.>
```

- **type:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `security`
- **scope:** the area, e.g. `api`, `web`, `db`, `auth`, `courses`, `payments`
- Examples: `feat(courses): add full-text course search`, `fix(auth): expire sessions after 30 days`

## Code style

Formatting is automatic (Prettier, and format-on-save in VS Code). ESLint enforces the rest. Beyond what the tools check:

### Naming

| Thing                | Convention                   | Example                         |
| -------------------- | ---------------------------- | ------------------------------- |
| Files and folders    | `kebab-case`                 | `feature-flags.service.ts`      |
| React components     | `PascalCase`                 | `SiteHeader`                    |
| Functions, variables | `camelCase`                  | `getPublicFeatures`             |
| Constants            | `UPPER_SNAKE_CASE`           | `MAX_JSON_BODY_BYTES`           |
| DB tables / columns  | `snake_case` (plural tables) | `feature_flags.rollout_percent` |
| API paths            | `kebab-case`, plural nouns   | `/api/v1/learning-paths`        |

### Comments

- Every source file starts with a short header comment explaining **what it is for**.
- Exported functions get a TSDoc comment when their purpose, parameters or errors aren't obvious from the name and types.
- Comment the **why**, not the what. `// 60s TTL because KV writes are limited on the free plan` is useful. `// set ttl to 60` is noise.
- Security-relevant code always explains the threat it defends against.

### API rules

- Layering: **route → service → repository**. Routes never contain SQL, and repositories never contain business rules.
- Every input (body, query, params) is validated by a Zod schema in `createRoute`.
- Throw `AppError(code, message)` for expected failures. Never build error JSON by hand.
- Money is integer paise. Percentages are basis points.
- Writes that must succeed together go in one `db.batch([...])` (D1 has no interactive transactions). See [ADR 0004](docs/architecture/adr/0004-d1-atomicity.md).
- Return only the fields the client needs. Never return password hashes, tokens or internal IDs of other users' private data.

### Web rules

- Use design tokens (`bg-surface`, `text-fg-muted`), not raw Tailwind colours.
- No `dangerouslySetInnerHTML` (ESLint blocks it).
- Files named `*.server.ts` must only be imported by server code (loaders, actions, entry.server).
- Accessibility: keyboard reachable, visible focus, labels on inputs, `aria-label` on icon buttons, colour contrast ≥ 4.5:1.

### Database rules

- Change the schema in `packages/db/src/schema/`, then run `npm run db:generate`. Never hand-edit an applied migration.
- Every new column gets a doc comment in the schema file.
- Update [docs/architecture/database-schema.md](docs/architecture/database-schema.md) in the same PR (`npm run docs:check` enforces this).

## Tests

- New logic needs tests. Bug fixes need a test that failed before the fix.
- Security behaviour (auth, permissions, CSRF, rate limits, validation) must be tested explicitly, including the **deny** cases.
- See [docs/guides/writing-tests.md](docs/guides/writing-tests.md).

## Dependencies

- Prefer the platform (Web APIs, Workers runtime) over adding a package.
- Before adding a dependency, check its maintenance, size and licence, and whether it works in Workers.
- Add dependencies to the **workspace** that uses them: `npm install <pkg> --workspace @skillverse/web`.

## Pull request checklist

The PR template repeats this list:

- [ ] `npm run check` passes
- [ ] Tested manually in the browser (light and dark theme, mobile width)
- [ ] Docs updated (guides, READMEs, schema doc, CHANGELOG)
- [ ] No secrets, tokens or personal data in code, logs or fixtures
- [ ] New inputs validated; new endpoints have permission checks and tests for the deny cases

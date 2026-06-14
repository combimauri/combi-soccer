# Plan 003: Capture the Supabase schema in the repo and fix repo-durability gaps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: This repo has a single commit (`e6984e8`) and the
> app exists as uncommitted working-tree changes. Open every file quoted in
> "Current state" and confirm the excerpts match the live code; also re-run the
> migration-count query in Step 1 and confirm it returns ≥ 13 rows. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `e6984e8` (working tree state of 2026-06-12)

## Why this matters

Half of this application — tables, RLS policies, the betting-window function,
the scoring trigger, the leaderboard refresh, the TheSportsDB sync function,
the pg_cron schedule — lives **only** in the remote Supabase project
(`mdhvgoqmtiufleaweevc`). Nothing of it is in the repo. If the project is
deleted, corrupted, or needs to be recreated, the schema is unrecoverable
except by archaeology. The good news: all 13 applied migrations are stored
with their full SQL in the database itself (`supabase_migrations.schema_migrations`),
so capturing them is mechanical. While touching repo hygiene, this plan also
adds `.env` patterns to `.gitignore` and fixes one actively-wrong line in
`CLAUDE.md`.

## Current state

- The repo has **no** `supabase/` directory and no `.sql` files
  (`find . -name '*.sql' -not -path './node_modules/*'` → empty).
- Verified 2026-06-12 against the live DB: `supabase_migrations.schema_migrations`
  contains 13 rows, versions `20260611201809` (`enable_citext_extension`)
  through `20260612101258` (`match_winners_expose_updated_at_tiebreak`), each
  with a `statements` text array holding the full migration SQL.
- `.gitignore` (46 lines) has no `.env` patterns. No `.env` file currently
  exists; the only client config is the **publishable** (anon) Supabase key in
  `src/environments/environment.ts`, which is public by design — do not move
  or obfuscate it.
- `CLAUDE.md` (repo root), in the "Routing is split in two" bullet, says:
  "the default `**` route uses `RenderMode.Prerender`." That is stale —
  `src/app/app.routes.server.ts:14` is `{ path: '**', renderMode:
  RenderMode.Server }`, and all routes use `RenderMode.Server` (the how-to-play
  page is deliberately server-rendered so it localizes via `Accept-Language`).
- Tooling available to the executor: the Supabase MCP server (read access via
  `execute_sql`) is configured in `.mcp.json` for this project. There are no
  local Supabase CLI credentials.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| List migrations | MCP `execute_sql`: `select version, name from supabase_migrations.schema_migrations order by version;` | 13+ rows |
| Fetch one migration | MCP `execute_sql`: `select statements from supabase_migrations.schema_migrations where version = '<v>';` | the SQL text array |
| Tests | `CI=true npm test` | exit 0 |

## Scope

**In scope** (the only files you should create/modify):
- `supabase/migrations/<version>_<name>.sql` (create, one per applied migration)
- `supabase/README.md` (create — provenance note)
- `.gitignore` (append env patterns)
- `CLAUDE.md` (fix the stale render-mode sentence; add a one-line pointer to
  `supabase/migrations/`)

**Out of scope** (do NOT touch):
- The remote database — this plan is **read-only against Supabase**. No
  `apply_migration`, no DDL, no data changes.
- `src/environments/environment.ts` — the publishable key stays where it is.
- `src/app/app.routes.server.ts` — the code is correct; the doc was wrong.
- Edge functions (`update-match-score`) — exporting Deno function source is a
  separate concern; note it in `supabase/README.md` as not yet captured.

## Git workflow

- No remote, single local commit. Do not commit, branch, or push. (Separately
  from this plan: the operator should commit the working tree — flagged in
  `plans/README.md`.)

## Steps

### Step 1: Export every applied migration to `supabase/migrations/`

Using the Supabase MCP `execute_sql` tool (read-only queries only):

1. `select version, name from supabase_migrations.schema_migrations order by version;`
2. For each row, fetch `statements` and write the concatenated SQL (join array
   elements with `\n\n`) to `supabase/migrations/<version>_<name>.sql` —
   e.g. `supabase/migrations/20260611201809_enable_citext_extension.sql`.
   Write the SQL verbatim; do not reformat or "fix" it.

If any `statements` value looks like it contains a secret (a service-role key,
an API token embedded in a function body), STOP — do not write that file —
and report the migration version and the credential type only, never the value.
(Heads-up: `create_match_sync_function_and_cron` calls TheSportsDB's **free,
keyless** API tier — URLs containing `thesportsdb.com/api/v1/json/123/` are the
free public key "123", not a secret.)

**Verify**: `ls supabase/migrations/ | wc -l` → 13 (or the row count from
query 1 if migrations were added since planning).

### Step 2: Write `supabase/README.md`

Content to include (a short file, ~15 lines):
- These files are an **export** of migrations applied to project
  `mdhvgoqmtiufleaweevc` via the Supabase MCP; the live database is the
  source of truth, and these are for disaster recovery / review.
- How to re-export (the Step 1 queries).
- Known gaps: the `update-match-score` edge function source and the Supabase
  Auth dashboard config (redirect URLs, providers) are not captured here.
- The pg_cron job `sync-wc-matches` (every 5 min) is created inside one of the
  migrations and would be recreated by replaying them.

**Verify**: file exists; `cat supabase/README.md` mentions "disaster recovery".

### Step 3: Add env patterns to `.gitignore`

Append to `.gitignore`:

```
# Environment files
.env
.env.*
!.env.example
```

**Verify**: `git check-ignore -q .env && echo ignored` → prints `ignored`.

### Step 4: Fix the stale sentence in `CLAUDE.md`

In the "Routing is split in two" bullet, replace the claim that the default
`**` route uses `RenderMode.Prerender` with the truth: all server routes,
including `**`, use `RenderMode.Server` (see `src/app/app.routes.server.ts`),
because every page hydrates live Supabase data and `how-to-play` localizes
via the request's `Accept-Language`. Keep the existing advice that render
modes are controlled per-path in that file. Also add, under "## Architecture",
one line: "Database schema: exported migration history in
`supabase/migrations/` (see `supabase/README.md`); the live Supabase project
is authoritative."

**Verify**: `grep -n "Prerender" CLAUDE.md` → no match claiming `**` uses
Prerender (mentions of `RenderMode.Prerender` as an *option* are fine);
`grep -n "supabase/migrations" CLAUDE.md` → 1 match.

### Step 5: Confirm nothing else changed

**Verify**: `git status --short` → shows only `supabase/` (new), `.gitignore`
(modified), `CLAUDE.md` (modified) beyond what was already listed before you
started. `CI=true npm test` → exit 0 (nothing in the app changed).

## Test plan

No app code changes — the verification gates above are the test. The
meaningful check is Step 1's file count matching the live migration count.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `ls supabase/migrations/*.sql | wc -l` equals the row count of
      `schema_migrations` (≥ 13)
- [ ] Every exported file is non-empty (`find supabase/migrations -size 0` → empty)
- [ ] `git check-ignore -q .env` exits 0
- [ ] `grep -c "supabase/migrations" CLAUDE.md` ≥ 1
- [ ] `CI=true npm test` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Supabase MCP tools are unavailable in your environment — the export
  cannot proceed without read access; report instead of guessing schema DDL.
- `supabase_migrations.schema_migrations` does not exist or `statements` is
  empty/NULL for any row — report which versions are unrecoverable this way.
- Any migration body appears to contain a credential (see Step 1) — report
  version + credential type only.

## Maintenance notes

- From now on, any new migration applied via MCP `apply_migration` should also
  be exported here (same filename convention) — otherwise this export drifts.
  Consider re-running the Step 1 export after each schema change.
- The betting-window rule lives in both SQL (`is_betting_open`, now visible in
  `supabase/migrations/20260611234028_*.sql`) and TS
  (`deriveBettingState` in `src/app/core/models/models.ts`) — keep in sync.
- Reviewer should scrutinize: that the exported SQL was not reformatted, and
  that no secret slipped into the export.

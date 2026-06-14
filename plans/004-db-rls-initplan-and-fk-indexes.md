# Plan 004: Fix per-row `auth.uid()` re-evaluation in RLS policies and add missing FK indexes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: This plan targets the **remote Supabase
> database** (project `mdhvgoqmtiufleaweevc`), not repo files. Before
> proceeding, re-run the policy query in "Current state" and confirm the
> policy expressions match the excerpts. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-capture-db-schema-in-repo.md (so the new migration
  is exported alongside the existing history; can run before 003 if needed,
  but then 003 must re-export)
- **Category**: perf
- **Planned at**: commit `e6984e8`, 2026-06-12 (DB state verified same day)

## Why this matters

The Supabase performance advisor flags 6 RLS policies (4 on `bets`, 2 on
`profiles`) that call `auth.uid()` **per row** instead of once per query
(lint `auth_rls_initplan`, WARN). The `bets` table grows as users × matches —
with the World Cup live right now, every user's `myBets()` select and the
post-match `match_winners` reads scan increasingly many rows, re-evaluating
the auth function each time. Wrapping the call as `(select auth.uid())` makes
Postgres evaluate it once as an InitPlan. The advisor also flags (INFO) that
`matches.home_team_id` / `matches.away_team_id` foreign keys have no covering
index; every match query joins both. Both fixes are standard, documented
Supabase remediations with no behavior change.

## Current state

Verified 2026-06-12 via `select tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename in ('bets',
'profiles') order by tablename, policyname;`:

| Table | Policy | cmd | qual (USING) | with_check |
|-------|--------|-----|--------------|------------|
| bets | `delete own bet in window` | DELETE | `((auth.uid() = user_id) AND is_betting_open(match_id))` | — |
| bets | `insert own bet in window` | INSERT | — | `((auth.uid() = user_id) AND is_betting_open(match_id))` |
| bets | `read own or closed bets` | SELECT | `((auth.uid() = user_id) OR (EXISTS (SELECT 1 FROM matches m WHERE ((m.id = bets.match_id) AND (now() > (m.start_time - '00:10:00'::interval))))))` | — |
| bets | `update own bet in window` | UPDATE | `(auth.uid() = user_id)` | `((auth.uid() = user_id) AND is_betting_open(match_id))` |
| profiles | `insert own profile` | INSERT | — | `(auth.uid() = id)` |
| profiles | `profiles public read` | SELECT | `true` | — |
| profiles | `update own profile` | UPDATE | `(auth.uid() = id)` | `(auth.uid() = id)` |

(`profiles public read` is fine — no auth call. The other 6 need the rewrite.)

Advisor lints to clear (from `get_advisors(type='performance')`, 2026-06-12):
- `auth_rls_initplan` on `public.profiles` × 2 and `public.bets` × 4.
- `unindexed_foreign_keys`: `matches_home_team_id_fkey`,
  `matches_away_team_id_fkey`.

Semantics that must NOT change (the business rules encoded in these policies):
betting window enforcement comes from `is_betting_open(match_id)` (opens 6 h
before `start_time`, closes 10 min before); the SELECT policy reveals other
users' bets only after `now() > start_time - 10 min`. Do not touch
`is_betting_open` or the interval literal.

## Commands you will need

All database work goes through the Supabase MCP tools:

| Purpose | Tool | Expected on success |
|---------|------|---------------------|
| Apply DDL | `mcp__supabase__apply_migration` (name: `rls_initplan_and_fk_indexes`) | success |
| Re-check policies | `mcp__supabase__execute_sql` with the pg_policies query above | quals show `( SELECT auth.uid() ...)` |
| Re-check advisors | `mcp__supabase__get_advisors` type `performance` | the 8 lints listed above are gone |
| App still works | `CI=true npm test` in the repo | exit 0 |

## Scope

**In scope**:
- One migration on the remote DB: `ALTER POLICY` on the 6 policies above +
  `CREATE INDEX` × 2 on `public.matches`.
- If plan 003 has landed: export the new migration file to
  `supabase/migrations/` per that plan's convention.

**Out of scope** (do NOT touch):
- `is_betting_open()`, `score_match()`, triggers, views, cron jobs.
- The `profiles public read` policy (no auth call — nothing to fix).
- Any policy on `matches`, `teams`, `leaderboard`.
- All repo source files under `src/`.

## Git workflow

- Repo: only the optional exported migration file under `supabase/migrations/`.
  Do not commit, branch, or push.

## Steps

### Step 1: Apply the migration

Via `mcp__supabase__apply_migration`, name `rls_initplan_and_fk_indexes`:

```sql
-- Evaluate auth.uid() once per query (InitPlan) instead of per row.
-- Remediation for Supabase lint 0003_auth_rls_initplan.

alter policy "insert own bet in window" on public.bets
  with check (((select auth.uid()) = user_id) and is_betting_open(match_id));

alter policy "update own bet in window" on public.bets
  using ((select auth.uid()) = user_id)
  with check (((select auth.uid()) = user_id) and is_betting_open(match_id));

alter policy "delete own bet in window" on public.bets
  using (((select auth.uid()) = user_id) and is_betting_open(match_id));

alter policy "read own or closed bets" on public.bets
  using (
    ((select auth.uid()) = user_id)
    or exists (
      select 1 from public.matches m
      where m.id = bets.match_id
        and now() > (m.start_time - interval '10 minutes')
    )
  );

alter policy "insert own profile" on public.profiles
  with check ((select auth.uid()) = id);

alter policy "update own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Covering indexes for the matches→teams foreign keys (lint 0001).
create index if not exists matches_home_team_id_idx on public.matches (home_team_id);
create index if not exists matches_away_team_id_idx on public.matches (away_team_id);
```

**Verify**: tool reports success.

### Step 2: Confirm the policies and indexes

1. Re-run the pg_policies query from "Current state" → every former
   `auth.uid()` now reads `( SELECT auth.uid() ... )` in `qual`/`with_check`;
   the 10-minute interval and `is_betting_open` calls are unchanged.
2. `select indexname from pg_indexes where schemaname='public' and
   tablename='matches' and indexname like 'matches_%_team_id_idx';` → 2 rows.

**Verify**: both queries return the expected shapes.

### Step 3: Confirm the advisor lints cleared

Run `mcp__supabase__get_advisors` with type `performance`.

**Verify**: no `auth_rls_initplan` entries for `bets`/`profiles`; no
`unindexed_foreign_keys` entries for `matches`. (Other, unrelated lints may
exist — leave them.)

### Step 4: Functional smoke check

The policies gate real betting. Confirm behavior is unchanged:

1. `select count(*) from public.bets;` via `execute_sql` (service-level MCP
   access bypasses RLS — this only confirms the table is healthy).
2. In the repo, `CI=true npm test` → exit 0.
3. If you have browser access to https://futbol.combimauri.com: load the
   home page and confirm matches render. (Optional; skip if headless.)

**Verify**: as listed per item.

### Step 5: Export the migration to the repo (if plan 003 landed)

Fetch the new row from `supabase_migrations.schema_migrations` (it will have
the latest version and name `rls_initplan_and_fk_indexes`) and write it to
`supabase/migrations/<version>_rls_initplan_and_fk_indexes.sql`.

**Verify**: file exists and contains `alter policy`.

## Test plan

No app-code tests apply (the change is DB-side and semantically neutral).
The verification is Step 2 (expressions) + Step 3 (advisor lints cleared).
If you want a stronger guarantee and have time: place a bet as a real user in
the live app for a match whose window is open, and confirm a match outside
its window still rejects (the UI hides the button, so this requires a direct
authenticated PostgREST call — treat as optional and skip if you have no
authenticated session).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] pg_policies shows `( SELECT auth.uid()` in all 6 rewritten policies
- [ ] `pg_indexes` shows `matches_home_team_id_idx` and `matches_away_team_id_idx`
- [ ] `get_advisors(performance)` no longer reports the 8 lints from "Current state"
- [ ] `CI=true npm test` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The pg_policies output doesn't match the "Current state" table (policies
  were renamed or rewritten since planning).
- `alter policy` fails for any policy — report the error; do NOT fall back to
  `drop policy` + `create policy` without operator approval (a dropped policy
  briefly removes protection on a live table).
- The advisor still reports `auth_rls_initplan` for a policy you rewrote —
  report rather than iterating blindly.

## Maintenance notes

- Any future policy that references `auth.uid()` (or `auth.jwt()`) should use
  the `(select auth.uid())` form from the start — cite Supabase lint 0003.
- The `read own or closed bets` policy encodes the 10-minutes-before-kickoff
  reveal rule; it is one of the four places the betting-window rule lives
  (SQL function, this policy, TS `deriveBettingState`, i18n copy). If the
  window changes, update all four.
- Reviewer should scrutinize: that the rewritten expressions are logically
  identical to the originals (only the InitPlan wrapping added).

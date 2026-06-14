# Plan 002: Stop reporting every bet-save failure as "betting just closed"

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: This repo has a single commit (`e6984e8`) and the
> app exists as uncommitted working-tree changes, so `git diff` against a SHA is
> useless. Instead: open every file quoted in "Current state" and confirm the
> excerpts match the live code. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-test-baseline-betting-logic.md
- **Category**: bug
- **Planned at**: commit `e6984e8` (working tree state of 2026-06-12)

## Why this matters

`BetService.placeOrUpdate()` wraps **every** Supabase error in
`BettingClosedError`. The bet dialog then shows the i18n message "Betting just
closed for this match — your bet was not saved." for *any* failure: network
drop, Supabase outage, auth token expiry, constraint violation. During a live
World Cup, a user on flaky stadium Wi-Fi will be told betting closed while the
window is wide open — and will not retry. The fix distinguishes the actual
RLS rejection (Postgres error code `42501`, "row violates row-level security
policy") from everything else, and adds error logging to two fire-and-forget
async paths so real failures stop vanishing silently.

## Current state

- `src/app/core/services/bet.service.ts` — the conflation, lines 76–93:

  ```ts
  const { data, error } = await this.sb
    .from('bets')
    .upsert(
      {
        user_id: uid,
        match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      },
      { onConflict: 'user_id,match_id' },
    )
    .select()
    .single();

  if (error) throw new BettingClosedError(error.message);
  ```

  `BettingClosedError` is defined at the top of the same file (lines 8–13).
  The Supabase error object is a `PostgrestError` with a `code: string` field;
  an RLS rejection on insert/update carries code `'42501'`.

  Background (verified against the live DB on 2026-06-12): the `bets` RLS
  policies gate writes with `auth.uid() = user_id AND is_betting_open(match_id)`,
  so a write outside the window fails RLS → PostgREST returns code `42501`.
  A *new* row blocked by RLS may instead surface as `'PGRST301'` or a 401/403
  depending on PostgREST version — treat `42501` as the canonical code and
  keep the conservative fallback described in Step 1.

- `src/app/core/services/bet.service.ts` lines 24–30 — constructor effect
  with an unhandled rejection path (`refresh()` → `myBets()` can throw):

  ```ts
  constructor() {
    // Refresh the store whenever the auth state resolves or changes.
    effect(() => {
      this.auth.isAuthenticated();
      void this.refresh();
    });
  }
  ```

- `src/app/core/services/leaderboard.service.ts` lines 49–59 — realtime
  callback with the same pattern (`() => void this.load()`), where `load()`
  throws on Supabase error.

- `src/app/features/betting/bet-dialog/bet-dialog.ts` lines 216–219 — the
  consumer that maps the error to i18n keys (this code is already correct and
  needs no change; it's quoted so you can confirm the contract):

  ```ts
  } catch (err) {
    this.errorKey.set(
      err instanceof BettingClosedError ? 'bet.errorClosed' : 'bet.errorGeneric',
    );
  }
  ```

  i18n keys `bet.errorClosed` and `bet.errorGeneric` already exist in both
  `src/app/i18n/en.ts` and `src/app/i18n/es.ts` — no new keys needed.

- Tests: after plan 001, `src/app/core/services/bet.service.spec.ts` contains
  a characterization test annotated `// characterization — plan 002 narrows
  this to RLS errors only`. This plan updates it.

- Conventions: strict TS, no `any`. There is no logging framework; the repo's
  only acceptable sink is `console.error` (used nowhere yet — keep messages
  short and prefixed with the service name).

## Commands you will need

| Purpose | Command            | Expected on success |
|---------|--------------------|---------------------|
| Tests   | `CI=true npm test` | exit 0, all pass    |
| Build   | `npm run build`    | exit 0              |
| Format  | `npx prettier --check src/app/core/services/*.ts` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/app/core/services/bet.service.ts`
- `src/app/core/services/leaderboard.service.ts`
- `src/app/core/services/bet.service.spec.ts` (update tests)

**Out of scope** (do NOT touch, even though they look related):
- `src/app/features/betting/bet-dialog/bet-dialog.ts` — its
  `instanceof BettingClosedError` branch already does the right thing.
- `src/app/i18n/en.ts`, `src/app/i18n/es.ts` — existing keys suffice.
- Supabase migrations / RLS policies — the server-side window is correct.
- `src/app/core/services/match.service.ts` — its realtime callback does not
  call a throwing async function.

## Git workflow

- No remote, single local commit, operator deploys from the working tree.
  Do not commit, branch, or push — leave changes in the working tree.

## Steps

### Step 1: Narrow the error mapping in `placeOrUpdate()`

In `src/app/core/services/bet.service.ts`, replace line 90
(`if (error) throw new BettingClosedError(error.message);`) with logic that:

1. Throws `BettingClosedError` when `error.code === '42501'` (RLS rejection —
   the betting window is genuinely closed or the row isn't the user's).
2. Re-throws anything else as-is (`throw error;`), so the dialog shows the
   generic message and the real failure reaches the console/network tab.

Keep it small:

```ts
if (error) {
  // 42501 = Postgres "violates row-level security policy" → window closed.
  if (error.code === '42501') throw new BettingClosedError(error.message);
  throw error;
}
```

**Verify**: `npm run build` → exit 0.

### Step 2: Update the characterization test and add the new case

In `src/app/core/services/bet.service.spec.ts`:
- Change the plan-001 characterization test so the mocked error is
  `{ code: '42501', message: 'new row violates row-level security policy' }`
  and the expectation stays `BettingClosedError`.
- Add a test: mocked error `{ code: '08006', message: 'connection failure' }`
  → `placeOrUpdate()` rejects with an error that is **not** an
  `instanceof BettingClosedError`.

**Verify**: `CI=true npx ng test --include='**/bet.service.spec.ts'` → exit 0,
all tests (now 6) pass.

### Step 3: Catch the fire-and-forget rejections

1. `src/app/core/services/bet.service.ts` constructor effect — replace
   `void this.refresh();` with:
   ```ts
   this.refresh().catch((err) => console.error('BetService: refresh failed', err));
   ```
2. `src/app/core/services/leaderboard.service.ts` realtime callback — replace
   `() => void this.load()` with:
   ```ts
   () => {
     this.load().catch((err) => console.error('LeaderboardService: refetch failed', err));
   }
   ```

Do not change any other `void`-prefixed call — the rest either cannot reject
(router navigations handled by Angular) or are awaited inside
`PendingTasks.run()` where Angular surfaces the error.

**Verify**: `npm run build` → exit 0.

### Step 4: Full suite + format

**Verify**: `CI=true npm test` → exit 0. Then
`npx prettier --check src/app/core/services/bet.service.ts
src/app/core/services/leaderboard.service.ts` → exit 0.

## Test plan

Covered in Step 2: the 42501 → `BettingClosedError` mapping and the
non-42501 pass-through. Pattern: the existing `bet.service.spec.ts` from
plan 001. No new test files.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "42501" src/app/core/services/bet.service.ts` returns exactly one match
- [ ] `grep -n "void this.refresh()" src/app/core/services/bet.service.ts` returns no matches
- [ ] `grep -n "void this.load()" src/app/core/services/leaderboard.service.ts` returns no matches
- [ ] `CI=true npm test` exits 0, including the new non-RLS-error test
- [ ] `npm run build` exits 0
- [ ] No files outside the in-scope list modified beyond what `git status` showed before starting
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpt at bet.service.ts lines 76–93 doesn't match the live code.
- Plan 001's spec file does not exist (dependency not landed) — report and
  do not write production code without the characterization test.
- You find evidence (e.g. in a manual check or existing logs) that the live
  RLS rejection uses a code other than `42501` — report the observed code
  instead of broadening the match yourself.

## Maintenance notes

- If Supabase/PostgREST changes its RLS error surface, the `42501` check is
  the single point to update; the fallback path (generic error) fails safe —
  worst case users see "something went wrong" instead of "betting closed".
- Reviewer should scrutinize: that no other call sites construct
  `BettingClosedError` (grep — as of planning, only bet.service.ts does).
- Deferred deliberately: a retry/offline queue for bet submissions, and
  surfacing the underlying error detail in the dialog (would need new i18n
  keys in both en.ts and es.ts).

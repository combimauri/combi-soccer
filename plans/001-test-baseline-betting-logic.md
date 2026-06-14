# Plan 001: Establish a unit-test baseline for the betting-window mirror and BetService

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: This repo has a single commit (`e6984e8`) and the
> entire app exists as uncommitted working-tree changes, so `git diff` against a
> SHA is useless. Instead: open every file quoted in "Current state" and confirm
> the excerpts match the live code. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e6984e8` (working tree state of 2026-06-12)

## Why this matters

This is a live betting app for the FIFA World Cup 2026 — which is happening
*right now* (group stage runs June 11–27, 2026). The entire repo has exactly
one spec file (`src/app/app.spec.ts`, 2 trivial tests). The core business
logic — the betting-window state machine and the bet placement/refresh service
— has zero automated coverage. Every other plan in `plans/` (bug fixes,
refactors) needs this baseline to land safely. The betting window is also
mirrored in SQL on the Supabase side; a regression in the TS mirror silently
shows users wrong "open for betting" states.

## Current state

- `src/app/core/models/models.ts` — pure function `deriveBettingState()` at
  lines 51–63. This is the highest-value test target: a pure function with
  documented business rules (window opens 6 hours before `start_time`, closes
  10 minutes before `start_time`; it is a UI-only mirror of the SQL function
  `is_betting_open()` — the DB has final say). Excerpt:

  ```ts
  const BET_OPENS_BEFORE_START_MS = 6 * 60 * 60 * 1000; // 6 hours before kickoff
  const BET_CLOSES_BEFORE_START_MS = 10 * 60 * 1000; // 10 minutes before kickoff

  export function deriveBettingState(match: MatchRow, now: number): BettingState {
    if (match.status === 'finished' || match.status === 'cancelled') {
      return 'finished';
    }
    const start = new Date(match.start_time).getTime();
    const opensAt = start - BET_OPENS_BEFORE_START_MS;
    const closesAt = start - BET_CLOSES_BEFORE_START_MS;
    if (now < opensAt) return 'upcoming';
    if (now > closesAt) return 'closed';
    return 'open';
  }
  ```

  `BettingState` is `'upcoming' | 'open' | 'closed' | 'finished'` (line 14).
  `MatchRow` is `Tables<'matches'>` from the generated Supabase types — for
  tests, build a minimal cast helper rather than filling every column (see
  Step 1).

- `src/app/core/services/bet.service.ts` — `BetService`, an
  `@Injectable({ providedIn: 'root' })` signal store. Key behaviors to pin
  down with tests:
  - `refresh()` (lines 33–36): loads `myBets()` into the `byMatch` Map signal.
  - `myBets()` (lines 52–61): returns `[]` without querying when no user is
    signed in; throws on Supabase error.
  - `placeOrUpdate()` (lines 68–93): throws `Error('You must be signed in to
    place a bet.')` when unauthenticated; upserts with
    `{ onConflict: 'user_id,match_id' }`; **currently wraps every Supabase
    error in `BettingClosedError`** (line 90 — `if (error) throw new
    BettingClosedError(error.message);`). Plan 002 changes that line; write
    the test for the *current* behavior as a characterization test and mark
    it with a comment `// characterization — behavior changes in plan 002`.
  - On success, updates the `byMatch` signal map (line 91).
  - The constructor registers an `effect()` that calls `refresh()` when
    `auth.isAuthenticated()` changes (lines 24–30).

- `src/app/core/supabase/supabase.ts` — exports `SUPABASE_CLIENT`, an
  `InjectionToken` for the Supabase client. In tests, override this token
  with a mock object; do NOT let tests hit the real Supabase project.

- `src/app/core/services/auth.service.ts` — `AuthService` exposes `user`
  (computed signal) and `isAuthenticated` (computed signal). In BetService
  tests, provide a stub: `{ user: signal(...), isAuthenticated: signal(...) }`
  via `{ provide: AuthService, useValue: stub }` (computed and signal are
  interchangeable for readers).

- Existing test exemplar: `src/app/app.spec.ts` — uses
  `TestBed.configureTestingModule({ imports: [App], providers: [...] })`
  style with Vitest (`describe`/`it`/`expect` globals). Match its structure.
  Note it provides `provideZonelessChangeDetection()` — do the same when a
  test needs TestBed.

- Test runner: Vitest 4 via the `@angular/build:unit-test` builder. `CI=true
  npm test` runs once and exits (verified 2026-06-12: "Test Files 1 passed
  (1), Tests 2 passed (2)").

- Repo conventions (from `CLAUDE.md` / `.claude/CLAUDE.md`): strict TS, no
  `any` (use `unknown` + narrowing), signals, `inject()`. Prettier is
  configured — run `npx prettier --write` on files you create.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Tests     | `CI=true npm test`                               | exit 0, all tests pass |
| Single file | `CI=true npx ng test --include='**/models.spec.ts'` | exit 0 |
| Build     | `npm run build`                                  | exit 0 (bundle under 1 MB budget) |
| Format    | `npx prettier --write src/app/core/**/*.spec.ts` | exit 0 |

## Scope

**In scope** (the only files you should create/modify):
- `src/app/core/models/models.spec.ts` (create)
- `src/app/core/services/bet.service.spec.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/app/core/models/models.ts`, `src/app/core/services/bet.service.ts` —
  this plan adds tests only; production code changes belong to plan 002.
- `src/app/app.spec.ts` — leave the existing tests as-is.
- Any Supabase migration or remote database state.
- E2E test infrastructure (Playwright/Cypress) — deliberately deferred.

## Git workflow

- This repo has no remote and one local commit; the operator deploys from the
  working tree. Do not commit, branch, or push — leave changes in the working
  tree and report them.

## Steps

### Step 1: Test `deriveBettingState()` in `src/app/core/models/models.spec.ts`

Create the spec. Build matches with a helper so you don't enumerate every
`MatchRow` column:

```ts
import { describe, expect, it } from 'vitest';
import { MatchRow, deriveBettingState } from './models';

const KICKOFF = Date.parse('2026-06-20T18:00:00Z');

function match(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    status: 'scheduled',
    start_time: new Date(KICKOFF).toISOString(),
    ...overrides,
  } as MatchRow;
}
```

(The `as MatchRow` cast is acceptable in tests; `deriveBettingState` only
reads `status` and `start_time`.)

Cover, with one `it()` each (times relative to KICKOFF):
1. 7 h before kickoff → `'upcoming'`
2. exactly 6 h before (opensAt boundary) → `'open'` (now === opensAt is not `< opensAt`)
3. 1 h before → `'open'`
4. exactly 10 min before (closesAt boundary) → `'open'` (now === closesAt is not `> closesAt`)
5. 9 min before → `'closed'`
6. during the match (after kickoff, status `'live'`) → `'closed'`
7. status `'finished'` → `'finished'` regardless of time
8. status `'cancelled'` → `'finished'`

**Verify**: `CI=true npx ng test --include='**/models.spec.ts'` → exit 0,
8 tests pass.

### Step 2: Test `BetService` in `src/app/core/services/bet.service.spec.ts`

Mock the Supabase client behind `SUPABASE_CLIENT` and stub `AuthService`.
A workable mock shape (the service uses method chaining):

```ts
function supabaseMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    upsert: () => chain,
    then: (resolve: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return { from: () => chain };
}
```

(`myBets()` awaits the chain directly after `.eq()`, which is why the mock
needs a `then` — the PostgREST builder is thenable. Verify against the real
call shapes in `bet.service.ts` before finalizing the mock.)

Provide via TestBed:

```ts
TestBed.configureTestingModule({
  providers: [
    provideZonelessChangeDetection(),
    { provide: SUPABASE_CLIENT, useValue: mock },
    { provide: AuthService, useValue: { user: signal(stubUser), isAuthenticated: signal(true) } },
  ],
});
const service = TestBed.inject(BetService);
```

Cover:
1. `myBets()` returns `[]` and never calls `from()` when `user()` is null.
2. `refresh()` populates `byMatch()` keyed by `match_id` from returned bets.
3. `placeOrUpdate()` rejects with message `'You must be signed in to place a
   bet.'` when `user()` is null.
4. `placeOrUpdate()` on Supabase error `{ code: '42501', message: '...' }`
   throws `BettingClosedError`. Comment: `// characterization — plan 002
   narrows this to RLS errors only`.
5. `placeOrUpdate()` on success updates `byMatch()` with the returned row.

**Verify**: `CI=true npx ng test --include='**/bet.service.spec.ts'` → exit 0,
5 tests pass.

### Step 3: Run the full suite and format

**Verify**: `CI=true npm test` → exit 0, ≥15 tests pass (2 existing + 13 new).
Then `npx prettier --check src/app/core/models/models.spec.ts
src/app/core/services/bet.service.spec.ts` → exit 0.

## Test plan

This plan *is* the test plan. Structural pattern: `src/app/app.spec.ts`.
The boundary cases in Step 1 items 2 and 4 encode the exact semantics of the
window edges — if one fails, the production code's comparison operators are
the source of truth (`<` and `>`, i.e. boundaries count as open); fix the
test expectation, not the code.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `CI=true npm test` exits 0; total tests ≥ 15
- [ ] `src/app/core/models/models.spec.ts` exists with 8 passing tests
- [ ] `src/app/core/services/bet.service.spec.ts` exists with 5 passing tests
- [ ] `npm run build` exits 0
- [ ] `git status --short` shows only the two new spec files added (plus
      pre-existing modifications that were already there before you started)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code.
- The Supabase builder mock cannot satisfy `myBets()`'s await shape after two
  attempts (the thenable detail) — report the actual call chain you observed.
- `CI=true npm test` does not terminate (watch mode) — report; do not switch
  test runners or add new dev dependencies.
- You feel the need to modify production code to make it testable — that is
  out of scope; report which seam is missing.

## Maintenance notes

- Plan 002 changes `placeOrUpdate()` error handling; test 4 in Step 2 must be
  updated by that plan (it is annotated as a characterization test).
- If the betting-window rule ever changes, it lives in FOUR places: SQL
  `is_betting_open()`, `deriveBettingState()` in models.ts, the bets RLS
  SELECT policy, and the i18n copy (`matches.opensBefore`, `howto.when1/2` in
  `src/app/i18n/en.ts` + `es.ts`). These tests will catch the TS mirror only.
- Reviewer should scrutinize: that mocks assert *call shapes* (e.g. `eq`
  called with `user_id`) only where behavior depends on them — over-asserting
  chain internals makes the tests brittle.

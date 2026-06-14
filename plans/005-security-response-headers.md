# Plan 005: Add security response headers to the SSR server and Vercel routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: This repo has a single commit (`e6984e8`) and the
> app exists as uncommitted working-tree changes. Open every file quoted in
> "Current state" and confirm the excerpts match the live code. On a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (header-only; one MED-risk caveat: a malformed `vercel.json`
  breaks routing — Step 4's deploy check is mandatory)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e6984e8` (working tree state of 2026-06-12)

## Why this matters

The app is a public, authenticated betting site (https://futbol.combimauri.com)
and currently sends **no** hardening headers: no `Strict-Transport-Security`,
no `X-Content-Type-Options`, no frame-ancestors protection, no
`Referrer-Policy`, no `Permissions-Policy`. These are standard, non-breaking
defenses (clickjacking, MIME sniffing, protocol downgrade on first visit,
referrer leakage of auth-callback URLs). A full Content-Security-Policy is
**deliberately out of scope** — Angular emits inline styles per component and
a workable CSP needs design and testing; don't attempt it here.

## Current state

- `src/server.ts` — Express 5 server. Static middleware at lines 30–36, then
  the Angular catch-all at lines 41–48:

  ```ts
  app.use(
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
      redirect: false,
    }),
  );

  app.use((req, res, next) => {
    angularApp
      .handle(req)
      .then((response) =>
        response ? writeResponseToNodeResponse(response, res) : next(),
      )
      .catch(next);
  });
  ```

  There is no header middleware and no helmet dependency. `reqHandler` is
  exported at line 68 and is what `api/index.mjs` invokes on Vercel.

- `vercel.json` (entire file):

  ```json
  {
    "version": 2,
    "functions": {
      "api/index.mjs": {
        "includeFiles": "dist/combi-soccer/**"
      }
    },
    "routes": [
      { "src": "/", "dest": "/api" },
      { "handle": "filesystem" },
      { "src": "/(.*)", "dest": "/api" }
    ]
  }
  ```

  **Critical constraint**: this file uses the legacy `routes` array, which
  CANNOT be combined with a top-level `headers` key (Vercel rejects the
  config). Headers for filesystem-served static assets must go on a route
  object with `"continue": true`. SSR responses get their headers from the
  Express middleware instead, since `/` and all non-file paths run through
  `api/index.mjs` → `reqHandler`.

- The root-first route `{ "src": "/", "dest": "/api" }` exists for a reason
  (Vercel otherwise serves a prerendered `index.csr.html` for `/` from the
  filesystem) — do not reorder or remove the existing three entries.

- Deployment is `npx vercel deploy --prod` from the local working tree (no
  git integration). The Vercel CLI may not be installed globally — use `npx`.

- Conventions: no new dependencies for trivial needs — set headers manually
  rather than adding `helmet` (the repo has 12 prod deps, all framework-level).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build | `npm run build` | exit 0 |
| Run SSR locally | `npm run serve:ssr:combi-soccer` | "Node Express server listening on http://localhost:4000" |
| Check headers locally | `curl -sI http://localhost:4000/ \| grep -i strict-transport` | header present |
| Tests | `CI=true npm test` | exit 0 |
| Deploy (operator may do this) | `npx vercel deploy --prod` | deployment URL printed |
| Check headers in prod | `curl -sI https://futbol.combimauri.com/ \| grep -iE 'strict-transport\|x-content-type\|x-frame'` | 3 headers present |

## Scope

**In scope** (the only files you should modify):
- `src/server.ts`
- `vercel.json`

**Out of scope** (do NOT touch):
- `api/index.mjs` — its header *stripping* is a documented Angular-SSR-on-
  Vercel workaround; adding response headers there would duplicate the
  Express middleware.
- Any Content-Security-Policy header — explicitly deferred (see "Why").
- `angular.json` `security.allowedHosts` — unrelated mechanism.
- Adding the `helmet` package or any new dependency.

## Git workflow

- No remote, single local commit, operator deploys from the working tree.
  Do not commit, branch, or push.

## Steps

### Step 1: Add a header middleware to `src/server.ts`

Insert **before** the `express.static` call (so both static and SSR responses
from the Express path get the headers):

```ts
/** Security headers for every response. CSP is deferred — Angular emits
 *  inline component styles; see plans/005-security-response-headers.md. */
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

**Verify**: `npm run build` → exit 0. Then `npm run serve:ssr:combi-soccer`
(background), `curl -sI http://localhost:4000/ | grep -ci 'strict-transport\|x-content-type\|x-frame\|referrer-policy\|permissions-policy'`
→ `5`. Also confirm the page still renders:
`curl -s http://localhost:4000/ | grep -c 'ng-server-context'` → `1`
(this proves SSR still works). Stop the server afterwards.

### Step 2: Add headers for filesystem-served assets in `vercel.json`

Replace the `routes` array with (only the first entry is new — the original
three stay in their existing order **after** it):

```json
"routes": [
  {
    "src": "/(.*)",
    "headers": {
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "continue": true
  },
  { "src": "/", "dest": "/api" },
  { "handle": "filesystem" },
  { "src": "/(.*)", "dest": "/api" }
]
```

(`X-Frame-Options` is intentionally omitted from the static rule — static
assets are images/JS/CSS where it's meaningless; documents get it from
Express. `"continue": true` means the rule adds headers and matching falls
through to the rest.)

**Verify**: `cat vercel.json | python3 -m json.tool` → valid JSON, and the
array order is exactly: headers-rule, root→/api, filesystem, catch-all→/api.

### Step 3: Run the test suite

**Verify**: `CI=true npm test` → exit 0.

### Step 4: Deploy and verify in production

If you are authorized to deploy (the operator normally runs this):
`npm run build && npx vercel deploy --prod`. Otherwise hand the verified
working tree back and ask the operator to deploy.

After deploy:
- `curl -sI https://futbol.combimauri.com/ | grep -ciE 'strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy'` → `5`
- `curl -s https://futbol.combimauri.com/ | grep -c 'ng-server-context'` → `1`
  (SSR did not deopt — this is the regression the header stripping in
  `api/index.mjs` exists to prevent; if it returns 0, the deploy regressed
  SSR → roll back by redeploying the previous build and STOP)
- `curl -sI https://futbol.combimauri.com/matches | grep -ci x-frame-options` → `1`
- A static asset, e.g. `curl -sI https://futbol.combimauri.com/favicon-32.png | grep -ci x-content-type-options` → `1`

## Test plan

No unit tests apply (infrastructure headers). The verification gates in
Steps 1 and 4 are the tests — particularly the `ng-server-context` check,
which guards the one realistic regression (Vercel routing/SSR breakage).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Local: `curl -sI http://localhost:4000/` shows all 5 headers
- [ ] Local: SSR HTML still contains `ng-server-context`
- [ ] `vercel.json` parses as JSON and keeps the original three routes in order
- [ ] `CI=true npm test` exits 0
- [ ] (If deployed) production checks in Step 4 pass
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/server.ts` or `vercel.json` don't match the "Current state" excerpts.
- After Step 2, a local `npx vercel dev` or a preview deploy rejects the
  config ("routes cannot be present with headers" or similar) — report the
  exact error; do not migrate the file to `rewrites`/`headers` form yourself
  (that form previously broke root-path SSR in this project).
- The production `ng-server-context` check returns 0 after deploy (SSR
  deopted) — redeploy the previous build and report.

## Maintenance notes

- When a CSP is eventually designed, start from `Content-Security-Policy-
  Report-Only` and expect to need `style-src 'unsafe-inline'` for Angular
  component styles; Supabase endpoints (`https://mdhvgoqmtiufleaweevc.supabase.co`
  and its websocket) must be in `connect-src`.
- If the Vercel config is ever migrated from legacy `routes` to
  `rewrites`+`headers` (or to `vercel.ts`), re-test the root path `/`
  specifically — it historically fell through to a static CSR shell.
- Reviewer should scrutinize: header values (HSTS max-age 2 years, no
  `preload` — preload is a one-way door and needs the operator's sign-off).

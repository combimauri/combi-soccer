# Quiniela Mundial ⚽

A World Cup 2026 score-prediction game. Predict the scoreline of each match,
place your bet before kickoff, and climb the per-match and global leaderboards.
Bilingual (English / Spanish), server-rendered, and live-updating.

**Live:** https://futbol.combimauri.com

---

## How it works

- **Betting window** — a match opens for betting **24 hours before** kickoff and
  closes **10 minutes before** it starts. The window is enforced server-side by
  Postgres row-level-security; the UI only mirrors it.
- **Scoring** — points are awarded once a match finishes:
  | Result | Points |
  | --- | --- |
  | Correct outcome (home / draw / away) | +3 |
  | Exact scoreline | +5 (→ **8** total with the outcome) |
  | Each correctly predicted team goal (when not exact) | +1 |
- **Tiebreak** — on the per-match board, ties are broken by the *effective bet
  time*: the moment you last edited your prediction, or your first placement if
  you never edited it.
- **Live matches** — scores, the current minute, and goal events refresh in real
  time via Supabase Realtime.

## Tech stack

- **[Angular 21](https://angular.dev)** — standalone components, signals, native
  control flow, `OnPush` change detection, server-side rendering (SSR).
- **[Tailwind CSS v4](https://tailwindcss.com)** — wired through PostCSS, no
  config file; design tokens live in `src/styles.css`.
- **[Supabase](https://supabase.com)** — Postgres, row-level security, auth
  (Google OAuth + magic link), Realtime, and edge functions for match scoring.
- **[Transloco](https://jsverse.github.io/transloco/)** — runtime EN/ES i18n.
- **[Vercel](https://vercel.com)** — hosts the Angular SSR server as a serverless
  function (`api/index.mjs` + `vercel.json`).

## Getting started

> Requires Node.js 20+ and npm.

```bash
npm install
npm start          # dev server with SSR at http://localhost:4200
```

Supabase connection config lives in `src/environments/environment.ts`. The key
there is the **publishable** client key — safe to ship in the browser; access is
gated entirely by row-level-security policies. The `service_role` key and other
secrets are never committed (they live in Vercel / Supabase environment vars).

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Dev server (SSR) at `http://localhost:4200` |
| `npm run build` | Production build to `dist/` (SSR output) |
| `npm run watch` | Rebuild on change (development config) |
| `npm test` | Unit tests (Vitest via `@angular/build:unit-test`) |
| `npm run serve:ssr:combi-soccer` | Run the built SSR server from `dist/` |

Formatting is handled by Prettier: `npx prettier --write <files>`.

## Project structure

```
src/
  app/
    core/          # services, models, guards, Supabase client + DB types
    features/      # auth, betting, matches, leaderboard, instructions
    shared/        # reusable pipes and UI (language switcher, etc.)
    i18n/          # Transloco setup + en/es message catalogs
  environments/    # Supabase URL + publishable key
api/index.mjs      # Vercel serverless entry that hosts the Angular SSR handler
vercel.json        # Vercel routing → SSR function
```

- **Routing is split** between client routes (`app.routes.ts`) and per-path SSR
  render modes (`app.routes.server.ts`).
- **Config is split** between the browser app config (`app.config.ts`) and
  server-only providers (`app.config.server.ts`).

## License

Personal project — all rights reserved.

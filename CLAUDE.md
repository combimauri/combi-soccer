# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Conventions

Detailed TypeScript/Angular/accessibility conventions live in `.claude/CLAUDE.md` and are loaded automatically. Follow them — key points: standalone components (no `standalone: true`), signals for state, `input()`/`output()` functions, `inject()` over constructor injection, `OnPush` change detection, native control flow (`@if`/`@for`/`@switch`), `class`/`style` bindings (never `ngClass`/`ngStyle`), and reactive forms.

## Commands

```bash
npm start              # ng serve — dev server at http://localhost:4200 (SSR dev)
npm run build          # production build to dist/ (SSR output mode)
npm run watch          # dev build, rebuild on change
npm test               # run unit tests (Vitest via @angular/build:unit-test)
npm run serve:ssr:combi-soccer   # run the built SSR server from dist/

ng test --include='**/app.spec.ts'   # run a single test file
ng generate component <name>          # scaffold (prefix: `combi`)
```

There is no lint target configured. Prettier is set up (`.prettierrc`) — format with `npx prettier --write <files>`.

## Architecture

Angular 21 standalone app with **server-side rendering** and **Tailwind CSS v4**.

- **SSR pipeline**: `src/main.ts` (browser bootstrap) and `src/main.server.ts` (server bootstrap) share `src/app/app.ts` (root `App` component). `src/server.ts` is an Express 5 server using `AngularNodeAppEngine`; it serves static assets from the build's `/browser` folder and renders everything else through Angular. The exported `reqHandler` is what the Angular dev-server, build, and any Firebase Cloud Function entry use.
- **Routing is split in two**: `src/app/app.routes.ts` holds client routes (currently empty — add feature routes here, lazy-loaded). `src/app/app.routes.server.ts` holds `ServerRoute[]` controlling render mode per path; the default `**` route uses `RenderMode.Prerender`. When adding dynamic/auth routes, change their render mode here (e.g. `RenderMode.Server`).
- **Config is split too**: `src/app/app.config.ts` is the browser `ApplicationConfig` (router, client hydration with event replay, global error listeners). `src/app/app.config.server.ts` merges server-only providers on top via `mergeApplicationConfig`.
- **Styling**: Tailwind v4 is wired through PostCSS (`.postcssrc.json` → `@tailwindcss/postcss`) and imported in `src/styles.css` with `@import 'tailwindcss'`. There is no `tailwind.config.js`.

Build budgets (`angular.json`): 1 MB initial bundle error cap, 8 kB per-component-style error cap.

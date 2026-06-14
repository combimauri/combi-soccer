import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Auth flows depend on the live session — render on the server per request.
  { path: 'auth/sign-in', renderMode: RenderMode.Server },
  { path: 'auth/callback', renderMode: RenderMode.Server },
  { path: 'setup-username', renderMode: RenderMode.Server },
  // Matches and leaderboard hydrate from Supabase and stream realtime updates.
  { path: '', renderMode: RenderMode.Server },
  { path: 'matches', renderMode: RenderMode.Server },
  { path: 'matches/:id', renderMode: RenderMode.Server },
  { path: 'leaderboard', renderMode: RenderMode.Server },
  { path: 'how-to-play', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server },
];

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Bet now · Quiniela Mundial',
    loadComponent: () =>
      import('./features/betting/bet-now/bet-now').then((m) => m.BetNow),
  },
  {
    path: 'matches',
    title: 'Matches · Quiniela Mundial',
    loadComponent: () =>
      import('./features/matches/match-list/match-list').then((m) => m.MatchList),
  },
  {
    path: 'matches/:id',
    title: 'Match · Quiniela Mundial',
    loadComponent: () =>
      import('./features/matches/match-detail/match-detail').then(
        (m) => m.MatchDetail,
      ),
  },
  {
    path: 'leaderboard',
    title: 'Leaderboard · Quiniela Mundial',
    loadComponent: () =>
      import('./features/leaderboard/global-leaderboard/global-leaderboard').then(
        (m) => m.GlobalLeaderboard,
      ),
  },
  {
    path: 'how-to-play',
    title: 'How to play · Quiniela Mundial',
    loadComponent: () =>
      import('./features/instructions/instructions').then((m) => m.Instructions),
  },
  {
    path: 'auth/sign-in',
    title: 'Sign in · Quiniela Mundial',
    loadComponent: () =>
      import('./features/auth/sign-in/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'auth/callback',
    title: 'Signing in · Quiniela Mundial',
    loadComponent: () =>
      import('./features/auth/callback/callback').then((m) => m.AuthCallback),
  },
  {
    path: 'setup-username',
    title: 'Choose a username · Quiniela Mundial',
    loadComponent: () =>
      import('./features/auth/username-setup/username-setup').then(
        (m) => m.UsernameSetup,
      ),
  },
  { path: '**', redirectTo: '' },
];

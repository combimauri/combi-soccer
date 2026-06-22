export type NavIconName = 'predict' | 'matches' | 'leaderboard' | 'howto';

/** A top-level navigation destination, rendered in both the desktop bar and the mobile tab bar. */
export interface NavItem {
  path: string;
  /** Transloco key for the label. */
  labelKey: string;
  icon: NavIconName;
  /** Match the route exactly (used for the home route so it isn't active everywhere). */
  exact?: boolean;
}

/**
 * Single source of truth for primary navigation. Add a destination here and it
 * appears in the desktop bar and the mobile tab bar automatically; once there
 * are more than 5, the mobile bar keeps the first four and folds the rest into
 * a "More" sheet.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', labelKey: 'nav.predictNow', icon: 'predict', exact: true },
  { path: '/matches', labelKey: 'nav.matches', icon: 'matches' },
  { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: 'leaderboard' },
  { path: '/how-to-play', labelKey: 'nav.howToPlay', icon: 'howto' },
];

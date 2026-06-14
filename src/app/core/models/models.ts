import { Tables } from '../supabase/database.types';

export type Team = Tables<'teams'>;
export type Profile = Tables<'profiles'>;
export type Bet = Tables<'bets'>;
export type MatchRow = Tables<'matches'>;
export type LeaderboardRow = Tables<'leaderboard'>;

export type BetOutcome = 'home' | 'draw' | 'away';
export type MatchStage = MatchRow['stage'];
export type MatchStatus = MatchRow['status'];

/** Lifecycle of the betting window for a single match. */
export type BettingState = 'upcoming' | 'open' | 'closed' | 'finished';

/** A goal event from the live match timeline. */
export interface MatchGoal {
  team: 'home' | 'away';
  minute: string;
  player: string;
  assist: string | null;
}

/** A match row with its teams joined and betting state derived for the UI. */
export interface MatchView extends MatchRow {
  home: Team | null;
  away: Team | null;
  bettingState: BettingState;
}

/** A leaderboard row joined with the owning profile's username. */
export interface LeaderboardEntry extends LeaderboardRow {
  profile: Pick<Profile, 'username'> | null;
}

export type MatchWinnerRow = Tables<'match_winners'>;

/** A per-match ranking row joined with the player's username. */
export interface MatchWinnerEntry extends MatchWinnerRow {
  profile: Pick<Profile, 'username'> | null;
}

const BET_OPENS_BEFORE_START_MS = 24 * 60 * 60 * 1000; // 24 hours before kickoff
const BET_CLOSES_BEFORE_START_MS = 10 * 60 * 1000; // 10 minutes before kickoff

/**
 * Mirror of the SQL `is_betting_open()` function so the client highlight and the
 * server-enforced window agree. The DB always has the final say; this is only
 * for display.
 */
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

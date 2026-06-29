import { Tables } from '../supabase/database.types';

export type Team = Tables<'teams'>;
export type Profile = Tables<'profiles'>;
export type Prediction = Tables<'bets'>;
export type MatchRow = Tables<'matches'>;
export type LeaderboardRow = Tables<'leaderboard'>;

export type PredictionOutcome = 'home' | 'draw' | 'away';
/** Which side advances from a knockout tie — never a draw. */
export type Advancer = 'home' | 'away';
export type MatchStage = MatchRow['stage'];
export type MatchStatus = MatchRow['status'];

/** Knockout stages — the only ones that can be decided on penalties. */
export const KNOCKOUT_STAGES: ReadonlySet<MatchStage> = new Set([
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]);

/** True when a match is a knockout fixture (so a tie goes to penalties). */
export function isKnockoutStage(stage: MatchStage): boolean {
  return KNOCKOUT_STAGES.has(stage);
}

/** Lifecycle of the prediction window for a single match. */
export type PredictionState = 'upcoming' | 'open' | 'closed' | 'finished';

/** A goal event from the live match timeline. */
export interface MatchGoal {
  team: 'home' | 'away';
  minute: string;
  player: string;
  assist: string | null;
}

/** A match row with its home/away teams joined (no derived UI state yet). */
export interface MatchWithTeams extends MatchRow {
  home: Team | null;
  away: Team | null;
}

/** A match row with its teams joined and prediction state derived for the UI. */
export interface MatchView extends MatchWithTeams {
  predictionState: PredictionState;
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

const PREDICTION_OPENS_BEFORE_START_MS = 24 * 60 * 60 * 1000; // 24 hours before kickoff
const PREDICTION_CLOSES_BEFORE_START_MS = 10 * 60 * 1000; // 10 minutes before kickoff

/**
 * Mirror of the SQL `is_betting_open()` function so the client highlight and the
 * server-enforced window agree. The DB always has the final say; this is only
 * for display.
 */
export function derivePredictionState(match: MatchRow, now: number): PredictionState {
  if (match.status === 'finished' || match.status === 'cancelled') {
    return 'finished';
  }

  // A TBD fixture (a knockout slot whose teams aren't decided yet) can't be
  // predicted — there's nothing to bet on. Treat it as not-yet-open regardless
  // of its placeholder kickoff time. Mirrors the team-null guard in SQL is_betting_open().
  if (match.home_team_id === null || match.away_team_id === null) {
    return 'upcoming';
  }

  const start = new Date(match.start_time).getTime();
  const opensAt = start - PREDICTION_OPENS_BEFORE_START_MS;
  const closesAt = start - PREDICTION_CLOSES_BEFORE_START_MS;

  if (now < opensAt) return 'upcoming';
  if (now > closesAt) return 'closed';
  return 'open';
}

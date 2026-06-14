import { Injectable, effect, inject, signal } from '@angular/core';

import { SUPABASE_CLIENT } from '../supabase/supabase';
import { Bet, MatchWinnerEntry } from '../models/models';
import { AuthService } from './auth.service';

/** Thrown when the DB rejects a bet because its window is closed (RLS). */
export class BettingClosedError extends Error {
  constructor(message = 'Betting is closed for this match.') {
    super(message);
    this.name = 'BettingClosedError';
  }
}

@Injectable({ providedIn: 'root' })
export class BetService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  private readonly _byMatch = signal<Map<number, Bet>>(new Map());
  /** The signed-in user's bets keyed by match id; kept in sync with auth + writes. */
  readonly byMatch = this._byMatch.asReadonly();

  constructor() {
    // Refresh the store whenever the auth state resolves or changes.
    effect(() => {
      this.auth.isAuthenticated();
      void this.refresh();
    });
  }

  /** Reload the current user's bets into {@link byMatch}. */
  async refresh(): Promise<void> {
    const list = await this.myBets();
    this._byMatch.set(new Map(list.map((bet) => [bet.match_id, bet])));
  }

  /** The signed-in user's bet for a match, or null. */
  async myBet(matchId: number): Promise<Bet | null> {
    const uid = this.auth.user()?.id;
    if (!uid) return null;
    const { data } = await this.sb
      .from('bets')
      .select('*')
      .eq('match_id', matchId)
      .eq('user_id', uid)
      .maybeSingle();
    return data;
  }

  /** All bets placed by the signed-in user (empty if not signed in). */
  async myBets(): Promise<Bet[]> {
    const uid = this.auth.user()?.id;
    if (!uid) return [];
    const { data, error } = await this.sb
      .from('bets')
      .select('*')
      .eq('user_id', uid);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Place or modify a bet. Uses upsert so the same call covers both cases.
   * The betting window is enforced server-side by RLS — a rejection surfaces
   * as a {@link BettingClosedError}.
   */
  async placeOrUpdate(
    matchId: number,
    homeScore: number,
    awayScore: number,
  ): Promise<Bet> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('You must be signed in to place a bet.');

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
    this._byMatch.update((map) => new Map(map).set(data.match_id, data));
    return data;
  }

  /** Per-match ranking (winner = position 1), visible once betting closed. */
  async matchLeaderboard(matchId: number): Promise<MatchWinnerEntry[]> {
    const { data, error } = await this.sb
      .from('match_winners')
      .select('*, profile:user_id(username)')
      .eq('match_id', matchId)
      .order('position');
    if (error) throw error;
    return (data ?? []) as unknown as MatchWinnerEntry[];
  }
}

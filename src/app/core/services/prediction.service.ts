import { Injectable, effect, inject, signal } from '@angular/core';

import { SUPABASE_CLIENT } from '../supabase/supabase';
import { Advancer, Prediction, MatchWinnerEntry } from '../models/models';
import { AuthService } from './auth.service';

/** Thrown when the DB rejects a prediction because its window is closed (RLS). */
export class PredictionClosedError extends Error {
  constructor(message = 'Predictions are closed for this match.') {
    super(message);
    this.name = 'PredictionClosedError';
  }
}

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  private readonly _byMatch = signal<Map<number, Prediction>>(new Map());
  /** The signed-in user's predictions keyed by match id; kept in sync with auth + writes. */
  readonly byMatch = this._byMatch.asReadonly();

  constructor() {
    // Refresh the store whenever the auth state resolves or changes.
    effect(() => {
      this.auth.isAuthenticated();
      void this.refresh();
    });
  }

  /** Reload the current user's predictions into {@link byMatch}. */
  async refresh(): Promise<void> {
    const list = await this.myPredictions();
    this._byMatch.set(new Map(list.map((prediction) => [prediction.match_id, prediction])));
  }

  /** The signed-in user's prediction for a match, or null. */
  async myPrediction(matchId: number): Promise<Prediction | null> {
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

  /** All predictions made by the signed-in user (empty if not signed in). */
  async myPredictions(): Promise<Prediction[]> {
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
   * Place or modify a prediction. Uses upsert so the same call covers both cases.
   * The prediction window is enforced server-side by RLS — a rejection surfaces
   * as a {@link PredictionClosedError}.
   */
  async placeOrUpdate(
    matchId: number,
    homeScore: number,
    awayScore: number,
    advancer: Advancer | null = null,
  ): Promise<Prediction> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('You must be signed in to make a prediction.');

    const { data, error } = await this.sb
      .from('bets')
      .upsert(
        {
          user_id: uid,
          match_id: matchId,
          predicted_home_score: homeScore,
          predicted_away_score: awayScore,
          predicted_advancer: advancer,
        },
        { onConflict: 'user_id,match_id' },
      )
      .select()
      .single();

    if (error) throw new PredictionClosedError(error.message);
    this._byMatch.update((map) => new Map(map).set(data.match_id, data));
    return data;
  }

  /** Per-match ranking (winner = position 1), visible once predictions close. */
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

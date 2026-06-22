import { Injectable, Signal, inject, resource } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { SUPABASE_CLIENT } from '../supabase/supabase';
import {
  MatchView,
  MatchWithTeams,
  derivePredictionState,
} from '../models/models';

const SELECT = '*, home:home_team_id(*), away:away_team_id(*)';

/**
 * Server-side match search by team name. The name matching runs in Postgres
 * (`search_match_ids`) against the localized team-name columns, then the
 * matched matches are fetched in full — so search works even when the browse
 * lists are only partially loaded (paginated). Respects the active language.
 */
@Injectable({ providedIn: 'root' })
export class MatchSearchService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly transloco = inject(TranslocoService);

  /** Active language; drives which localized column the server matches against. */
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /**
   * Build a resource that resolves the matches matching `query` (debounced) for
   * the active language, or `null` when the query is blank (= no active search).
   * Call from a component's field initializer so it tears down with it.
   */
  searchMatches(query: Signal<string>) {
    const debounced = toSignal(toObservable(query).pipe(debounceTime(250)), {
      initialValue: query(),
    });

    return resource<MatchView[] | null, { q: string; lang: string }>({
      params: () => ({ q: debounced().trim(), lang: this.lang() ?? 'en' }),
      defaultValue: null,
      loader: async ({ params }) => {
        if (!params.q) return null;
        const { data: idRows, error } = await this.sb.rpc('search_match_ids', {
          p_query: params.q,
          p_lang: params.lang,
        });
        if (error) throw error;
        const ids = (idRows ?? []).map((row) => row.match_id);
        if (!ids.length) return [];

        const { data, error: fetchError } = await this.sb
          .from('matches')
          .select(SELECT)
          .in('id', ids)
          .order('stage')
          .order('start_time');
        if (fetchError) throw fetchError;

        const now = Date.now();
        return ((data ?? []) as unknown as MatchWithTeams[]).map((row) => ({
          ...row,
          predictionState: derivePredictionState(row, now),
        }));
      },
    });
  }
}

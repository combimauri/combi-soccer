import { Injectable, Signal, inject, resource } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { SUPABASE_CLIENT } from '../supabase/supabase';

/**
 * Server-side match search by team name. The name matching runs in Postgres
 * (`search_match_ids`) against the localized team-name columns, so it respects
 * the active language: English query → English names, Spanish → Spanish names,
 * accent- and case-insensitive. The client only filters by the returned ids.
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
   * Build a resource that resolves the set of match ids matching `query` for the
   * active language. Call from a component's field initializer so it tears down
   * with the component. The query is debounced; a blank query yields `null`
   * (= no filtering). `value()` keeps the previous result while reloading, so
   * the list doesn't flash empty between keystrokes.
   */
  resultIds(query: Signal<string>) {
    const debounced = toSignal(toObservable(query).pipe(debounceTime(250)), {
      initialValue: query(),
    });

    return resource<Set<number> | null, { q: string; lang: string }>({
      params: () => ({ q: debounced().trim(), lang: this.lang() ?? 'en' }),
      defaultValue: null,
      loader: async ({ params }) => {
        if (!params.q) return null;
        const { data, error } = await this.sb.rpc('search_match_ids', {
          p_query: params.q,
          p_lang: params.lang,
        });
        if (error) throw error;
        return new Set((data ?? []).map((row) => row.match_id));
      },
    });
  }
}

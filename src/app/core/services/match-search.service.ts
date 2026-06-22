import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

import { MatchView } from '../models/models';

/** Lowercase + strip accents so "Türkiye" matches "turkiye", "México" matches "mexico". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Filters matches by team name for the search boxes. Names are matched against
 * the *translated* country labels, so search works in whichever language is
 * active. Expose {@link lang} so callers can register a reactive dependency and
 * re-run their filter when the user switches languages.
 */
@Injectable({ providedIn: 'root' })
export class MatchSearchService {
  private readonly transloco = inject(TranslocoService);

  /** Active language as a signal; read it inside a computed to track changes. */
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** True when the query is blank or either team's translated name contains it. */
  matches(match: MatchView, query: string): boolean {
    const q = normalize(query);
    if (!q) return true;
    return (
      normalize(this.teamName(match.home?.code)).includes(q) ||
      normalize(this.teamName(match.away?.code)).includes(q)
    );
  }

  private teamName(code: string | null | undefined): string {
    return code ? this.transloco.translate('countries.' + code) : '';
  }
}

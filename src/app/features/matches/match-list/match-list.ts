import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  PendingTasks,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { TranslocoPipe } from '@jsverse/transloco';

import { MatchService } from '../../../core/services/match.service';
import { MatchSearchService } from '../../../core/services/match-search.service';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchCard } from '../match-card/match-card';
import { PredictionDialog } from '../../predictions/prediction-dialog/prediction-dialog';
import { SearchField } from '../../../shared/search-field/search-field';
import { InfiniteScroll } from '../../../shared/infinite-scroll/infinite-scroll';
import { paginate } from '../../../shared/infinite-scroll/paginate';

@Component({
  selector: 'combi-match-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, PredictionDialog, SearchField, InfiniteScroll, TranslocoPipe],
  template: `
    <div class="mb-6">
      <h1 class="font-display text-3xl font-bold tracking-tight">{{ 'matches.title' | transloco }}</h1>
      <p class="text-sm text-slate-600">{{ 'matches.subtitle' | transloco }}</p>
    </div>

    <combi-search-field
      class="mb-6 block"
      [label]="'search.label' | transloco"
      [placeholder]="'search.placeholder' | transloco"
      [value]="query()"
      (valueChange)="query.set($event)"
    />

    @for (group of groupsPage.items(); track group.stage) {
      <section class="mb-8">
        <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          {{ 'stages.' + group.stage | transloco }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          @for (match of group.matches; track match.id) {
            <combi-match-card
              [match]="match"
              [prediction]="predictions.byMatch().get(match.id) ?? null"
              (predict)="predictionDialog.open($event)"
            />
          }
        </div>
      </section>
    } @empty {
      @if (query().trim()) {
        <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          {{ 'search.noResults' | transloco: { query: query() } }}
        </p>
      } @else {
        <p class="text-slate-500">{{ 'matches.empty' | transloco }}</p>
      }
    }
    @if (groupsPage.hasMore()) {
      <div combiInfiniteScroll (reached)="groupsPage.more()" aria-hidden="true" class="h-px"></div>
    }

    <combi-prediction-dialog #predictionDialog />
  `,
})
export class MatchList implements OnInit, OnDestroy {
  protected readonly matchService = inject(MatchService);
  protected readonly predictions = inject(PredictionService);
  private readonly search = inject(MatchSearchService);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly query = signal('');
  /** Server-resolved ids matching the query (null = no active search). */
  private readonly searchIds = this.search.resultIds(this.query);

  /** Stage groups filtered by the search result; groups with no hits drop out. */
  protected readonly filteredGroups = computed(() => {
    const ids = this.searchIds.value();
    const groups = this.matchService.grouped();
    if (!ids) return groups;
    return groups
      .map((group) => ({
        stage: group.stage,
        matches: group.matches.filter((m) => ids.has(m.id)),
      }))
      .filter((group) => group.matches.length > 0);
  });

  /** Reveal stage groups a few at a time as the user scrolls. */
  protected readonly groupsPage = paginate(this.filteredGroups, 4);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    // Tracked so SSR waits for the data before snapshotting the HTML.
    void this.pendingTasks.run(() => this.matchService.load());
    if (this.isBrowser) {
      this.matchService.subscribeLive();
      // Re-evaluate prediction windows every 30 s without refetching.
      this.timer = setInterval(() => this.matchService.tick(), 30_000);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    void this.matchService.unsubscribe();
  }
}

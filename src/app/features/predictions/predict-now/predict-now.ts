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

import { MatchView } from '../../../core/models/models';
import { PredictNowService } from '../../../core/services/predict-now.service';
import { MatchSearchService } from '../../../core/services/match-search.service';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchCard } from '../../matches/match-card/match-card';
import { PredictionDialog } from '../prediction-dialog/prediction-dialog';
import { SearchField } from '../../../shared/search-field/search-field';
import { InfiniteScroll } from '../../../shared/infinite-scroll/infinite-scroll';

/**
 * Default view: matches in play right now (live score, refreshed) and matches
 * whose prediction window is open, each showing the signed-in user's prediction
 * so they can make/edit it or track it live in one place. Data is fetched as
 * targeted queries (live / open / paginated history) rather than the whole list.
 */
@Component({
  selector: 'combi-predict-now',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, PredictionDialog, SearchField, InfiniteScroll, TranslocoPipe],
  template: `
    <div class="mb-6">
      <h1 class="font-display text-3xl font-bold tracking-tight">{{ 'predict.title' | transloco }}</h1>
      <p class="text-sm text-slate-600">{{ 'predict.subtitle' | transloco }}</p>
    </div>

    @if (predictNow.liveMatches(); as live) {
      @if (live.length) {
        <section class="mb-8">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden="true"></span>
            {{ 'predict.liveTitle' | transloco }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2">
            @for (match of live; track match.id) {
              <combi-match-card
                [match]="match"
                [prediction]="predictions.byMatch().get(match.id) ?? null"
                (predict)="predictionDialog.open($event)"
              />
            }
          </div>
        </section>
      }
    }

    <section>
      <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        {{ 'predict.openTitle' | transloco }}
      </h2>
      @if (predictNow.openForPredictions(); as open) {
        @if (open.length) {
          <div class="grid gap-3 sm:grid-cols-2">
            @for (match of open; track match.id) {
              <combi-match-card
                [match]="match"
                [prediction]="predictions.byMatch().get(match.id) ?? null"
                (predict)="predictionDialog.open($event)"
              />
            }
          </div>
        } @else {
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            {{ 'predict.empty' | transloco }}
          </p>
        }
      }
    </section>

    @if (predictNow.history().length) {
      <section class="mt-10">
        <h2 class="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
          {{ 'predict.historyTitle' | transloco }}
        </h2>
        <p class="mb-3 text-xs text-slate-500">{{ 'predict.historySubtitle' | transloco }}</p>
        <combi-search-field
          class="mb-3 block"
          [label]="'search.label' | transloco"
          [placeholder]="'search.placeholder' | transloco"
          [value]="query()"
          (valueChange)="query.set($event)"
        />
        @if (historyResults(); as results) {
          @if (results.length) {
            <div class="grid gap-3 sm:grid-cols-2">
              @for (match of results; track match.id) {
                <combi-match-card
                  [match]="match"
                  [prediction]="predictions.byMatch().get(match.id) ?? null"
                  (predict)="predictionDialog.open($event)"
                />
              }
            </div>
            @if (!searching() && predictNow.hasMoreHistory()) {
              <div combiInfiniteScroll (reached)="predictNow.loadMoreHistory()" aria-hidden="true" class="h-px"></div>
            }
          } @else if (searching() && !searchMatches.isLoading()) {
            <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
              {{ 'search.noResults' | transloco: { query: query() } }}
            </p>
          }
        }
      </section>
    }

    <combi-prediction-dialog #predictionDialog />
  `,
})
export class PredictNow implements OnInit, OnDestroy {
  protected readonly predictNow = inject(PredictNowService);
  protected readonly predictions = inject(PredictionService);
  private readonly search = inject(MatchSearchService);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly query = signal('');
  /** Matched matches when searching history (null while the query is blank). */
  protected readonly searchMatches = this.search.searchMatches(this.query);
  protected readonly searching = computed(() => !!this.query().trim());

  /** Paginated history when browsing; matched finished predictions when searching. */
  protected readonly historyResults = computed<MatchView[]>(() => {
    if (!this.searching()) return this.predictNow.history();
    const predicted = this.predictions.byMatch();
    return (this.searchMatches.value() ?? [])
      .filter((m) => m.status === 'finished' && predicted.has(m.id))
      .sort((a, b) => b.start_time.localeCompare(a.start_time));
  });

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    void this.pendingTasks.run(() => this.predictNow.loadActive());
    if (this.isBrowser) {
      this.predictNow.subscribeLive();
      this.tickTimer = setInterval(() => this.predictNow.tick(), 30_000);
      // Refresh live/open data while something is in play.
      this.refreshTimer = setInterval(() => {
        if (this.predictNow.liveMatches().length) {
          void this.predictNow.loadActive();
        }
      }, 60_000);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.tickTimer);
    clearInterval(this.refreshTimer);
    void this.predictNow.unsubscribe();
  }
}

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
import { MatchCard } from '../../matches/match-card/match-card';
import { PredictionDialog } from '../prediction-dialog/prediction-dialog';
import { SearchField } from '../../../shared/search-field/search-field';
import { InfiniteScroll } from '../../../shared/infinite-scroll/infinite-scroll';
import { paginate } from '../../../shared/infinite-scroll/paginate';

/**
 * Default view: matches in play right now (live score, refreshed) and matches
 * whose prediction window is open, each showing the signed-in user's prediction
 * so they can make/edit it or track it live in one place.
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

    @if (matchService.liveMatches(); as live) {
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
      @if (matchService.openForPredictions().length) {
        <div class="grid gap-3 sm:grid-cols-2">
          @for (match of openPage.items(); track match.id) {
            <combi-match-card
              [match]="match"
              [prediction]="predictions.byMatch().get(match.id) ?? null"
              (predict)="predictionDialog.open($event)"
            />
          }
        </div>
        @if (openPage.hasMore()) {
          <div combiInfiniteScroll (reached)="openPage.more()" aria-hidden="true" class="h-px"></div>
        }
      } @else {
        <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          {{ 'predict.empty' | transloco }}
        </p>
      }
    </section>

    @if (history(); as past) {
      @if (past.length) {
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
          @if (filteredHistory(); as results) {
            @if (results.length) {
              <div class="grid gap-3 sm:grid-cols-2">
                @for (match of historyPage.items(); track match.id) {
                  <combi-match-card
                    [match]="match"
                    [prediction]="predictions.byMatch().get(match.id) ?? null"
                    (predict)="predictionDialog.open($event)"
                  />
                }
              </div>
              @if (historyPage.hasMore()) {
                <div combiInfiniteScroll (reached)="historyPage.more()" aria-hidden="true" class="h-px"></div>
              }
            } @else {
              <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
                {{ 'search.noResults' | transloco: { query: query() } }}
              </p>
            }
          }
        </section>
      }
    }

    <combi-prediction-dialog #predictionDialog />
  `,
})
export class PredictNow implements OnInit, OnDestroy {
  protected readonly matchService = inject(MatchService);
  protected readonly predictions = inject(PredictionService);
  private readonly search = inject(MatchSearchService);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly query = signal('');
  /** Server-resolved ids matching the query (null = no active search). */
  private readonly searchIds = this.search.resultIds(this.query);

  /** Finished matches the user predicted — most recent first. */
  protected readonly history = computed(() =>
    this.matchService
      .matches()
      .filter((m) => m.status === 'finished' && this.predictions.byMatch().has(m.id))
      .sort((a, b) => b.start_time.localeCompare(a.start_time)),
  );

  /** {@link history} narrowed to the search result (by team name). */
  protected readonly filteredHistory = computed(() => {
    const ids = this.searchIds.value();
    const past = this.history();
    return ids ? past.filter((m) => ids.has(m.id)) : past;
  });

  /** Reveal open matches and past predictions a page at a time as the user scrolls. */
  protected readonly openPage = paginate(this.matchService.openForPredictions, 8);
  protected readonly historyPage = paginate(this.filteredHistory, 8);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    void this.pendingTasks.run(() => this.matchService.load());
    if (this.isBrowser) {
      // Realtime pushes live score/status changes; these are belt-and-suspenders.
      this.matchService.subscribeLive();
      this.tickTimer = setInterval(() => this.matchService.tick(), 30_000);
      // Re-fetch while something is in play, so live data stays fresh.
      this.refreshTimer = setInterval(() => {
        if (this.matchService.liveMatches().length) {
          void this.matchService.load();
        }
      }, 60_000);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.tickTimer);
    clearInterval(this.refreshTimer);
    void this.matchService.unsubscribe();
  }
}

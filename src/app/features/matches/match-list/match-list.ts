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
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { TranslocoPipe } from '@jsverse/transloco';

import { MatchService, groupByStage } from '../../../core/services/match.service';
import { MatchSearchService } from '../../../core/services/match-search.service';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchCard } from '../match-card/match-card';
import { Bracket } from '../bracket/bracket';
import { PredictionDialog } from '../../predictions/prediction-dialog/prediction-dialog';
import { SearchField } from '../../../shared/search-field/search-field';
import { InfiniteScroll } from '../../../shared/infinite-scroll/infinite-scroll';

type MatchesView = 'list' | 'bracket';

@Component({
  selector: 'combi-match-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, Bracket, PredictionDialog, SearchField, InfiniteScroll, TranslocoPipe],
  template: `
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="font-display text-3xl font-bold tracking-tight">{{ 'matches.title' | transloco }}</h1>
        <p class="text-sm text-slate-600">{{ 'matches.subtitle' | transloco }}</p>
      </div>

      <div
        role="group"
        [attr.aria-label]="'matches.viewToggle' | transloco"
        class="inline-flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm"
      >
        <button
          type="button"
          (click)="setView('list')"
          [attr.aria-pressed]="view() === 'list'"
          class="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          [class]="view() === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        >
          {{ 'matches.viewList' | transloco }}
        </button>
        <button
          type="button"
          (click)="setView('bracket')"
          [attr.aria-pressed]="view() === 'bracket'"
          class="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          [class]="view() === 'bracket' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        >
          {{ 'matches.viewBracket' | transloco }}
        </button>
      </div>
    </div>

    @if (view() === 'bracket') {
      <combi-bracket (predict)="predictionDialog.open($event)" />
    } @else {
    <combi-search-field
      class="mb-6 block"
      [label]="'search.label' | transloco"
      [placeholder]="'search.placeholder' | transloco"
      [value]="query()"
      (valueChange)="query.set($event)"
    />

    @for (group of displayGroups(); track group.stage) {
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
      @if (searching()) {
        @if (!searchMatches.isLoading()) {
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            {{ 'search.noResults' | transloco: { query: query() } }}
          </p>
        }
      } @else {
        <p class="text-slate-500">{{ 'matches.empty' | transloco }}</p>
      }
    }

    @if (!searching() && matchService.hasMore()) {
      <div combiInfiniteScroll (reached)="matchService.loadMore()" aria-hidden="true" class="h-px"></div>
    }
    }

    <combi-prediction-dialog #predictionDialog />
  `,
})
export class MatchList implements OnInit, OnDestroy {
  protected readonly matchService = inject(MatchService);
  protected readonly predictions = inject(PredictionService);
  private readonly search = inject(MatchSearchService);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** List vs bracket view, kept in the `?view` query param so it's deep-linkable. */
  protected readonly view = toSignal(
    this.route.queryParamMap.pipe(
      map((p): MatchesView => (p.get('view') === 'bracket' ? 'bracket' : 'list')),
    ),
    {
      initialValue: (this.route.snapshot.queryParamMap.get('view') === 'bracket'
        ? 'bracket'
        : 'list') as MatchesView,
    },
  );

  protected setView(view: MatchesView): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'bracket' ? 'bracket' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected readonly query = signal('');
  /** Matches matching the search (null while the query is blank). */
  protected readonly searchMatches = this.search.searchMatches(this.query);

  protected readonly searching = computed(() => !!this.query().trim());

  /** Search results (fetched in full) when searching; otherwise the paginated browse list. */
  protected readonly displayGroups = computed(() =>
    this.searching()
      ? groupByStage(this.searchMatches.value() ?? [])
      : this.matchService.grouped(),
  );

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    // Tracked so SSR waits for the first page before snapshotting the HTML.
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

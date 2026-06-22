import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  PendingTasks,
  computed,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

import { MatchService } from '../../../core/services/match.service';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchCard } from '../../matches/match-card/match-card';
import { PredictionDialog } from '../prediction-dialog/prediction-dialog';

/**
 * Default view: matches in play right now (live score, refreshed) and matches
 * whose prediction window is open, each showing the signed-in user's prediction
 * so they can make/edit it or track it live in one place.
 */
@Component({
  selector: 'combi-predict-now',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, PredictionDialog, TranslocoPipe],
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
      @if (matchService.openForPredictions(); as open) {
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

    @if (history(); as past) {
      @if (past.length) {
        <section class="mt-10">
          <h2 class="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
            {{ 'predict.historyTitle' | transloco }}
          </h2>
          <p class="mb-3 text-xs text-slate-500">{{ 'predict.historySubtitle' | transloco }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            @for (match of past; track match.id) {
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

    <combi-prediction-dialog #predictionDialog />
  `,
})
export class PredictNow implements OnInit, OnDestroy {
  protected readonly matchService = inject(MatchService);
  protected readonly predictions = inject(PredictionService);
  private readonly pendingTasks = inject(PendingTasks);

  /** Finished matches the user predicted — most recent first. */
  protected readonly history = computed(() =>
    this.matchService
      .matches()
      .filter((m) => m.status === 'finished' && this.predictions.byMatch().has(m.id))
      .sort((a, b) => b.start_time.localeCompare(a.start_time)),
  );
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

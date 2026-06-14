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
import { BetService } from '../../../core/services/bet.service';
import { MatchCard } from '../../matches/match-card/match-card';
import { BetDialog } from '../bet-dialog/bet-dialog';

/**
 * Default view: matches in play right now (live score, refreshed) and matches
 * whose betting window is open, each showing the signed-in user's bet so they
 * can place/edit it or track it live in one place.
 */
@Component({
  selector: 'combi-bet-now',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, BetDialog, TranslocoPipe],
  template: `
    <div class="mb-6">
      <h1 class="font-display text-3xl font-bold tracking-tight">{{ 'betNow.title' | transloco }}</h1>
      <p class="text-sm text-slate-600">{{ 'betNow.subtitle' | transloco }}</p>
    </div>

    @if (matchService.liveMatches(); as live) {
      @if (live.length) {
        <section class="mb-8">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden="true"></span>
            {{ 'betNow.liveTitle' | transloco }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2">
            @for (match of live; track match.id) {
              <combi-match-card
                [match]="match"
                [bet]="bets.byMatch().get(match.id) ?? null"
                (placeBet)="betDialog.open($event)"
              />
            }
          </div>
        </section>
      }
    }

    <section>
      <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        {{ 'betNow.openTitle' | transloco }}
      </h2>
      @if (matchService.openForBetting(); as open) {
        @if (open.length) {
          <div class="grid gap-3 sm:grid-cols-2">
            @for (match of open; track match.id) {
              <combi-match-card
                [match]="match"
                [bet]="bets.byMatch().get(match.id) ?? null"
                (placeBet)="betDialog.open($event)"
              />
            }
          </div>
        } @else {
          <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            {{ 'betNow.empty' | transloco }}
          </p>
        }
      }
    </section>

    @if (history(); as past) {
      @if (past.length) {
        <section class="mt-10">
          <h2 class="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
            {{ 'betNow.historyTitle' | transloco }}
          </h2>
          <p class="mb-3 text-xs text-slate-500">{{ 'betNow.historySubtitle' | transloco }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            @for (match of past; track match.id) {
              <combi-match-card
                [match]="match"
                [bet]="bets.byMatch().get(match.id) ?? null"
                (placeBet)="betDialog.open($event)"
              />
            }
          </div>
        </section>
      }
    }

    <combi-bet-dialog #betDialog />
  `,
})
export class BetNow implements OnInit, OnDestroy {
  protected readonly matchService = inject(MatchService);
  protected readonly bets = inject(BetService);
  private readonly pendingTasks = inject(PendingTasks);

  /** Finished matches the user bet on — most recent first. */
  protected readonly history = computed(() =>
    this.matchService
      .matches()
      .filter((m) => m.status === 'finished' && this.bets.byMatch().has(m.id))
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

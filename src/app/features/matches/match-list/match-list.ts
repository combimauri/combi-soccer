import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  PendingTasks,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { TranslocoPipe } from '@jsverse/transloco';

import { MatchService } from '../../../core/services/match.service';
import { BetService } from '../../../core/services/bet.service';
import { MatchCard } from '../match-card/match-card';
import { BetDialog } from '../../betting/bet-dialog/bet-dialog';

@Component({
  selector: 'combi-match-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, BetDialog, TranslocoPipe],
  template: `
    <div class="mb-6">
      <h1 class="font-display text-3xl font-bold tracking-tight">{{ 'matches.title' | transloco }}</h1>
      <p class="text-sm text-slate-600">{{ 'matches.subtitle' | transloco }}</p>
    </div>

    @for (group of matchService.grouped(); track group.stage) {
      <section class="mb-8">
        <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          {{ 'stages.' + group.stage | transloco }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          @for (match of group.matches; track match.id) {
            <combi-match-card
              [match]="match"
              [bet]="bets.byMatch().get(match.id) ?? null"
              (placeBet)="betDialog.open($event)"
            />
          }
        </div>
      </section>
    } @empty {
      <p class="text-slate-500">{{ 'matches.empty' | transloco }}</p>
    }

    <combi-bet-dialog #betDialog />
  `,
})
export class MatchList implements OnInit, OnDestroy {
  protected readonly matchService = inject(MatchService);
  protected readonly bets = inject(BetService);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    // Tracked so SSR waits for the data before snapshotting the HTML.
    void this.pendingTasks.run(() => this.matchService.load());
    if (this.isBrowser) {
      this.matchService.subscribeLive();
      // Re-evaluate betting windows every 30 s without refetching.
      this.timer = setInterval(() => this.matchService.tick(), 30_000);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    void this.matchService.unsubscribe();
  }
}

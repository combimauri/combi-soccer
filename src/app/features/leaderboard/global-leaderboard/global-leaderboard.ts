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

import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { InfiniteScroll } from '../../../shared/infinite-scroll/infinite-scroll';
import { paginate } from '../../../shared/infinite-scroll/paginate';

@Component({
  selector: 'combi-global-leaderboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, InfiniteScroll],
  template: `
    <div class="mb-6">
      <h1 class="font-display text-3xl font-bold tracking-tight">{{ 'leaderboard.title' | transloco }}</h1>
      <p class="text-sm text-slate-600">{{ 'leaderboard.subtitle' | transloco }}</p>
    </div>

    @if (leaderboard.ranked(); as rows) {
      @if (rows.length) {
        <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full min-w-[32rem] text-sm">
            <caption class="sr-only">{{ 'leaderboard.caption' | transloco }}</caption>
            <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" class="px-4 py-3">{{ 'leaderboard.rank' | transloco }}</th>
                <th scope="col" class="px-4 py-3">{{ 'leaderboard.player' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-right">{{ 'leaderboard.points' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-right">{{ 'leaderboard.exact' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-right">{{ 'leaderboard.outcomes' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rowsPage.items(); track row.user_id; let i = $index) {
                <tr class="border-t border-slate-100" [class.bg-amber-50]="i === 0">
                  <td class="px-4 py-2.5">
                    <span
                      class="inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold tabular-nums"
                      [class]="rankChip(i)"
                    >
                      {{ i + 1 }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 font-medium">
                    {{ row.profile?.username ?? ('matchDetail.unknown' | transloco) }}
                  </td>
                  <td class="font-display px-4 py-2.5 text-right text-lg font-bold tabular-nums">
                    {{ row.total_points }}
                  </td>
                  <td class="px-4 py-2.5 text-right tabular-nums text-slate-600">{{ row.exact_scores }}</td>
                  <td class="px-4 py-2.5 text-right tabular-nums text-slate-600">{{ row.correct_outcomes }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (rowsPage.hasMore()) {
          <div combiInfiniteScroll (reached)="rowsPage.more()" aria-hidden="true" class="h-px"></div>
        }
      } @else {
        <p class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          {{ 'leaderboard.empty' | transloco }}
        </p>
      }
    }
  `,
})
export class GlobalLeaderboard implements OnInit, OnDestroy {
  protected readonly leaderboard = inject(LeaderboardService);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Reveal 25 players at a time as the user scrolls. */
  protected readonly rowsPage = paginate(this.leaderboard.ranked, 25);

  /** Medal tint for the top three ranks; plain numerals below that. */
  protected rankChip(index: number): string {
    switch (index) {
      case 0:
        return 'bg-amber-100 text-amber-700 ring-1 ring-amber-300';
      case 1:
        return 'bg-slate-200 text-slate-600 ring-1 ring-slate-300';
      case 2:
        return 'bg-orange-100 text-orange-700 ring-1 ring-orange-300';
      default:
        return 'text-slate-500';
    }
  }

  ngOnInit(): void {
    void this.pendingTasks.run(() => this.leaderboard.load());
    if (this.isBrowser) this.leaderboard.subscribe();
  }

  ngOnDestroy(): void {
    void this.leaderboard.unsubscribe();
  }
}

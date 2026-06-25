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

import { AuthService } from '../../../core/services/auth.service';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { InfiniteScroll } from '../../../shared/infinite-scroll/infinite-scroll';

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
              @for (row of rows; track row.user_id; let i = $index) {
                @let mine = row.user_id === currentUserId();
                <tr
                  class="border-t border-slate-100"
                  [class.bg-emerald-50]="mine"
                  [class.bg-amber-50]="!mine && i === 0"
                >
                  <td class="px-4 py-2.5">
                    <span
                      class="inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold tabular-nums"
                      [class]="rankChip(i)"
                    >
                      {{ i + 1 }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 font-medium" [class.text-emerald-800]="mine">
                    <span [class.font-bold]="mine">
                      {{ row.profile?.username ?? ('matchDetail.unknown' | transloco) }}
                    </span>
                    @if (mine) {
                      <span
                        class="ms-2 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
                      >
                        {{ 'leaderboard.you' | transloco }}
                      </span>
                    }
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
        @if (leaderboard.hasMore()) {
          <div combiInfiniteScroll (reached)="leaderboard.loadMore()" aria-hidden="true" class="h-px"></div>
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
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Id of the signed-in user, so their row stands out (null when anonymous). */
  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

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

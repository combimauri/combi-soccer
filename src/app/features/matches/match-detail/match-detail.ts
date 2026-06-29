import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PendingTasks,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../../core/services/auth.service';
import { MatchService } from '../../../core/services/match.service';
import { PredictionService } from '../../../core/services/prediction.service';
import {
  MatchGoal,
  MatchView,
  MatchWinnerEntry,
} from '../../../core/models/models';
import { LocalDatePipe } from '../../../shared/pipes/local-date.pipe';

@Component({
  selector: 'combi-match-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, LocalDatePipe, TranslocoPipe],
  template: `
    <a
      routerLink="/"
      class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-emerald-700"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      {{ 'matchDetail.back' | transloco }}
    </a>

    @if (match(); as m) {
      <article class="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {{ 'stages.' + m.stage | transloco }}
        </p>
        <time [attr.datetime]="m.start_time" class="text-xs text-slate-500">
          {{ m.start_time | localDate: 'EEEE d MMM y, HH:mm (z)' }}
        </time>

        <div class="mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4">
          <div class="flex min-w-0 flex-col items-center gap-2 text-center">
            @if (m.home?.flag_url; as flag) {
              <img [ngSrc]="flag" width="40" height="30" alt="" class="rounded-sm" />
            }
            <span class="min-w-0 break-words text-base font-semibold leading-tight sm:text-lg">
              @if (m.home; as home) {
                {{ 'countries.' + home.code | transloco }}
              } @else {
                {{ 'common.tbd' | transloco }}
              }
            </span>
          </div>
          <div class="font-display pt-1 text-center text-3xl font-bold tabular-nums sm:text-4xl">
            @if (hasScore()) {
              {{ m.home_score }}–{{ m.away_score }}
            } @else {
              <span class="text-lg font-semibold uppercase text-slate-400">{{ 'common.vs' | transloco }}</span>
            }
          </div>
          <div class="flex min-w-0 flex-col items-center gap-2 text-center">
            @if (m.away?.flag_url; as flag) {
              <img [ngSrc]="flag" width="40" height="30" alt="" class="rounded-sm" />
            }
            <span class="min-w-0 break-words text-base font-semibold leading-tight sm:text-lg">
              @if (m.away; as away) {
                {{ 'countries.' + away.code | transloco }}
              } @else {
                {{ 'common.tbd' | transloco }}
              }
            </span>
          </div>
        </div>

        @if (hasPenalties()) {
          <p class="mt-3 text-center text-sm font-medium text-slate-600">
            {{ 'matchDetail.penalties' | transloco }}: {{ m.home_penalties }}–{{ m.away_penalties }}
            @if (advancerCode(); as code) {
              · {{ 'matches.advances' | transloco: { team: 'countries.' + code | transloco } }}
            }
          </p>
        }
      </article>

      @if (goals().length) {
        <section class="mt-6">
          <h2 class="mb-3 text-lg font-bold">{{ 'matchDetail.goalsTitle' | transloco }}</h2>
          <ul class="overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-sm">
            @for (g of goals(); track $index) {
              <li class="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0">
                <span class="w-9 text-right font-mono tabular-nums text-slate-500">{{ g.minute }}'</span>
                <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8.5l3.3 2.4-1.3 3.9H10l-1.3-3.9z" />
                </svg>
                <span class="font-medium text-slate-800">{{ g.player }}</span>
                @if (g.assist) {
                  <span class="text-xs text-slate-400">
                    ({{ 'matchDetail.assist' | transloco }}: {{ g.assist }})
                  </span>
                }
                <span class="ms-auto text-xs font-semibold text-slate-500">
                  {{
                    'countries.' + (g.team === 'home' ? m.home?.code : m.away?.code)
                      | transloco
                  }}
                </span>
              </li>
            }
          </ul>
        </section>
      }

      <section class="mt-6">
        <h2 class="mb-3 text-lg font-bold">{{ 'matchDetail.board' | transloco }}</h2>
        @if (winners(); as rows) {
          @if (rows.length) {
            <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table class="w-full min-w-[28rem] text-sm">
                <caption class="sr-only">{{ 'matchDetail.caption' | transloco }}</caption>
                <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" class="px-4 py-3">{{ 'matchDetail.rank' | transloco }}</th>
                    <th scope="col" class="px-4 py-3">{{ 'matchDetail.player' | transloco }}</th>
                    <th scope="col" class="px-4 py-3 text-right">{{ 'matchDetail.points' | transloco }}</th>
                    <th scope="col" class="px-4 py-3 text-right">{{ 'matchDetail.predictionPlaced' | transloco }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows; track row.user_id) {
                    @let mine = row.user_id === currentUserId();
                    <tr
                      class="border-t border-slate-100"
                      [class.bg-emerald-50]="mine"
                      [class.bg-amber-50]="!mine && row.position === 1"
                    >
                      <td class="px-4 py-2.5">
                        @if (row.position === 1) {
                          <span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-300">
                            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" [attr.aria-label]="'matchDetail.winner' | transloco">
                              <path d="M5 4h14v2a4 4 0 0 1-4 4h-.35A3.99 3.99 0 0 1 13 11.86V14h2a1 1 0 0 1 1 1v2H8v-2a1 1 0 0 1 1-1h2v-2.14A3.99 3.99 0 0 1 9.35 10H9a4 4 0 0 1-4-4V4Zm-2 2h2a6 6 0 0 0 .2 1.5A2 2 0 0 1 3 5.5V6Zm16 0a6 6 0 0 1-.2 1.5A2 2 0 0 0 21 5.5V6h-2ZM7 19h10v1H7v-1Z" />
                            </svg>
                            1
                          </span>
                        } @else {
                          <span class="ms-2 font-mono tabular-nums text-slate-500">{{ row.position }}</span>
                        }
                      </td>
                      <td class="px-4 py-2.5 font-medium" [class.text-emerald-800]="mine">
                        <span [class.font-bold]="mine">
                          {{ row.profile?.username ?? ('matchDetail.unknown' | transloco) }}
                        </span>
                        @if (mine) {
                          <span class="ms-2 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                            {{ 'leaderboard.you' | transloco }}
                          </span>
                        }
                      </td>
                      <td class="font-display px-4 py-2.5 text-right text-lg font-bold tabular-nums">{{ row.points_awarded }}</td>
                      <td class="whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums text-slate-500">
                        {{ (row.manually_updated_at ?? row.placed_at) | localDate: 'd MMM, HH:mm' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
              {{ 'matchDetail.empty' | transloco }}
            </p>
          }
        }
      </section>
    } @else {
      <p class="mt-6 text-slate-500">{{ 'matchDetail.notFound' | transloco }}</p>
    }
  `,
})
export class MatchDetail implements OnInit {
  /** Bound from the `matches/:id` route param via component input binding. */
  readonly id = input.required<string>();

  private readonly matchService = inject(MatchService);
  private readonly predictions = inject(PredictionService);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly auth = inject(AuthService);

  protected readonly match = signal<MatchView | null>(null);
  protected readonly winners = signal<MatchWinnerEntry[] | null>(null);

  /** Id of the signed-in user, so their row stands out (null when anonymous). */
  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  protected readonly hasScore = computed(
    () =>
      this.match()?.home_score !== null &&
      this.match()?.away_score !== null,
  );

  protected readonly hasPenalties = computed(
    () =>
      this.match()?.home_penalties !== null &&
      this.match()?.away_penalties !== null,
  );

  /** Country code of the side that advanced (penalty winner, else regulation). */
  protected readonly advancerCode = computed(() => {
    const m = this.match();
    if (!m) return null;
    if (m.advancer === 'home') return m.home?.code ?? null;
    if (m.advancer === 'away') return m.away?.code ?? null;
    return null;
  });

  protected readonly goals = computed(() => {
    const m = this.match();
    return m ? ((m.goals as unknown as MatchGoal[] | null) ?? []) : [];
  });

  ngOnInit(): void {
    const matchId = Number(this.id());
    void this.pendingTasks.run(async () => {
      const [match, winners] = await Promise.all([
        this.matchService.getMatch(matchId),
        this.predictions.matchLeaderboard(matchId),
      ]);
      this.match.set(match);
      this.winners.set(winners);
    });
  }
}

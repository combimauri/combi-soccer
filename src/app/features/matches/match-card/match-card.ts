import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { Prediction, MatchGoal, MatchView } from '../../../core/models/models';
import { LocalDatePipe } from '../../../shared/pipes/local-date.pipe';

@Component({
  selector: 'combi-match-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  imports: [NgOptimizedImage, RouterLink, LocalDatePipe, TranslocoPipe],
  template: `
    <article
      class="flex min-h-48 flex-1 flex-col rounded-2xl border bg-white p-4 shadow-sm transition duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-md"
      [class.border-emerald-400]="match().predictionState === 'open'"
      [class.ring-2]="match().predictionState === 'open'"
      [class.ring-emerald-200]="match().predictionState === 'open'"
      [class.border-slate-200]="match().predictionState !== 'open'"
    >
      <header class="mb-3 flex items-center justify-between gap-2">
        <time
          [attr.datetime]="match().start_time"
          class="text-xs font-medium text-slate-500"
        >
          {{ match().start_time | localDate: 'EEE d MMM, HH:mm z' }}
        </time>
        <span
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
          [class]="badgeClass()"
        >
          @if (match().status === 'live') {
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" aria-hidden="true"></span>
          }
          {{ statusKey() | transloco }}
        </span>
      </header>

      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div class="flex min-w-0 items-center justify-end gap-2 text-right">
          <span class="min-w-0 break-words font-semibold leading-tight">
            @if (match().home; as home) {
              {{ 'countries.' + home.code | transloco }}
            } @else {
              {{ 'common.tbd' | transloco }}
            }
          </span>
          @if (match().home?.flag_url; as flag) {
            <img [ngSrc]="flag" width="32" height="24" alt="" class="shrink-0 rounded-sm" />
          }
        </div>

        <div class="font-display text-center text-2xl font-bold tabular-nums">
          @if (hasScore()) {
            {{ match().home_score }}–{{ match().away_score }}
          } @else {
            <span class="text-base font-semibold uppercase text-slate-400">{{ 'common.vs' | transloco }}</span>
          }
        </div>

        <div class="flex min-w-0 items-center gap-2">
          @if (match().away?.flag_url; as flag) {
            <img [ngSrc]="flag" width="32" height="24" alt="" class="shrink-0 rounded-sm" />
          }
          <span class="min-w-0 break-words font-semibold leading-tight">
            @if (match().away; as away) {
              {{ 'countries.' + away.code | transloco }}
            } @else {
              {{ 'common.tbd' | transloco }}
            }
          </span>
        </div>
      </div>

      @if (match().status === 'live') {
        <p class="mt-2 text-center text-xs font-semibold text-red-700" aria-live="polite">
          {{ livePhaseKey() | transloco }}@if (showMinute()) { · {{ match().minute }}'}
        </p>
      }

      @if (match().status === 'live' && goals().length) {
        <ul class="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
          @for (g of goals(); track $index) {
            <li class="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8.5l3.3 2.4-1.3 3.9H10l-1.3-3.9z" />
              </svg>
              <span class="font-mono tabular-nums text-slate-500">{{ g.minute }}'</span>
              <span class="font-medium text-slate-800">{{ g.player }}</span>
              <span class="text-slate-400">·
                {{
                  'countries.' +
                    (g.team === 'home' ? match().home?.code : match().away?.code)
                    | transloco
                }}
              </span>
            </li>
          }
        </ul>
      }

      @if (prediction(); as b) {
        <p class="mt-3 rounded-lg bg-emerald-50 px-3 py-1.5 text-center text-sm text-emerald-800">
          {{ 'matches.yourPrediction' | transloco }}:
          <span class="font-bold tabular-nums">{{ b.predicted_home_score }}–{{ b.predicted_away_score }}</span>
          @if (b.points_awarded !== null) {
            <span class="ms-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-bold text-amber-700">
              <svg viewBox="0 0 24 24" class="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M5 4h14v2a4 4 0 0 1-4 4h-.35A3.99 3.99 0 0 1 13 11.86V14h2a1 1 0 0 1 1 1v2H8v-2a1 1 0 0 1 1-1h2v-2.14A3.99 3.99 0 0 1 9.35 10H9a4 4 0 0 1-4-4V4Zm-2 2h2v0a6 6 0 0 0 .2 1.5A2 2 0 0 1 3 5.5V6Zm16 0v-.5a2 2 0 0 1-.2 3A6 6 0 0 0 19 6h2-2ZM7 19h10v1H7v-1Z" />
              </svg>
              {{ 'matches.points' | transloco: { points: b.points_awarded } }}
            </span>
          }
        </p>
      }

      <footer class="mt-auto flex items-center justify-between pt-4">
        <a
          [routerLink]="['/matches', match().id]"
          class="text-xs font-medium text-slate-500 hover:underline"
        >
          {{ 'matches.viewDetails' | transloco }}
        </a>
        @if (match().predictionState === 'open') {
          <button
            type="button"
            (click)="predict.emit(match())"
            class="cursor-pointer rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {{ (prediction() ? 'matches.editPrediction' : 'matches.makePrediction') | transloco }}
          </button>
        } @else if (match().predictionState === 'upcoming') {
          <span class="text-xs text-slate-500">{{ 'matches.opensBefore' | transloco }}</span>
        } @else {
          <span class="text-xs text-slate-500">{{ 'matches.predictionsClosed' | transloco }}</span>
        }
      </footer>
    </article>
  `,
})
export class MatchCard {
  readonly match = input.required<MatchView>();
  /** The signed-in user's existing prediction for this match, if any. */
  readonly prediction = input<Prediction | null>(null);
  readonly predict = output<MatchView>();

  protected readonly hasScore = computed(
    () => this.match().home_score !== null && this.match().away_score !== null,
  );

  protected readonly goals = computed(
    () => (this.match().goals as unknown as MatchGoal[] | null) ?? [],
  );

  /** Translation key for the current live period (1st/2nd half, ET, etc.). */
  protected readonly livePhaseKey = computed(() => {
    switch ((this.match().phase ?? '').toUpperCase()) {
      case '1H':
        return 'live.firstHalf';
      case '2H':
        return 'live.secondHalf';
      case 'HT':
        return 'live.halftime';
      case 'ET':
        return 'live.extraTime';
      case 'BT':
        return 'live.break';
      case 'P':
      case 'PEN':
      case 'PEN LIVE':
        return 'live.penalties';
      default:
        return 'status.live';
    }
  });

  protected readonly showMinute = computed(() => {
    const phase = (this.match().phase ?? '').toUpperCase();
    return !!this.match().minute && ['1H', '2H', 'ET'].includes(phase);
  });

  /** Translation key for the status badge; API-verified status takes priority. */
  protected readonly statusKey = computed(() => {
    const m = this.match();
    if (m.status === 'live') return 'status.live';
    if (m.status === 'finished') return 'status.finished';
    if (m.status === 'cancelled') return 'status.cancelled';
    switch (m.predictionState) {
      case 'open':
        return 'status.open';
      case 'closed':
        return 'status.closed';
      default:
        return 'status.upcoming';
    }
  });

  protected readonly badgeClass = computed(() => {
    const m = this.match();
    if (m.status === 'live') return 'bg-red-100 text-red-700';
    if (m.status === 'finished' || m.status === 'cancelled') {
      return 'bg-slate-200 text-slate-700';
    }
    switch (m.predictionState) {
      case 'open':
        return 'bg-emerald-100 text-emerald-800';
      case 'closed':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  });
}

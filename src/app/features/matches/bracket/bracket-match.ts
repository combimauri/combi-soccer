import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { Prediction, MatchView } from '../../../core/models/models';

/**
 * Compact match tile for the bracket: two team rows with the real score, the
 * signed-in user's prediction underneath, and a status cue. When the prediction
 * window is open the whole tile is a button that asks to predict; otherwise it
 * links to the match detail page.
 */
@Component({
  selector: 'combi-bracket-match',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [NgOptimizedImage, NgTemplateOutlet, RouterLink, TranslocoPipe],
  template: `
    @if (open()) {
      <button
        type="button"
        (click)="predict.emit(match())"
        [attr.aria-label]="
          ('matches.makePrediction' | transloco) +
          ': ' +
          (homeKey() | transloco) +
          ' ' +
          ('common.vs' | transloco) +
          ' ' +
          (awayKey() | transloco)
        "
        class="w-full cursor-pointer rounded-xl border border-emerald-400 bg-white p-2 text-left shadow-sm ring-2 ring-emerald-200 transition-colors hover:bg-emerald-50/50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <ng-container [ngTemplateOutlet]="body" />
      </button>
    } @else {
      <a
        [routerLink]="['/matches', match().id]"
        class="block rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    }

    <ng-template #body>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5">
            @if (match().home?.flag_url; as flag) {
              <img [ngSrc]="flag" width="20" height="15" alt="" class="shrink-0 rounded-[2px]" />
            } @else {
              <span class="h-[15px] w-5 shrink-0 rounded-[2px] bg-slate-100" aria-hidden="true"></span>
            }
            <span class="truncate text-xs font-semibold text-slate-800">{{ homeKey() | transloco }}</span>
          </span>
          <span class="font-display text-sm font-bold tabular-nums text-slate-900">
            {{ hasScore() ? match().home_score : '' }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5">
            @if (match().away?.flag_url; as flag) {
              <img [ngSrc]="flag" width="20" height="15" alt="" class="shrink-0 rounded-[2px]" />
            } @else {
              <span class="h-[15px] w-5 shrink-0 rounded-[2px] bg-slate-100" aria-hidden="true"></span>
            }
            <span class="truncate text-xs font-semibold text-slate-800">{{ awayKey() | transloco }}</span>
          </span>
          <span class="font-display text-sm font-bold tabular-nums text-slate-900">
            {{ hasScore() ? match().away_score : '' }}
          </span>
        </div>
      </div>

      @if (prediction(); as p) {
        <p class="mt-1.5 flex items-center gap-1 border-t border-slate-100 pt-1 text-[11px] text-slate-500">
          {{ 'matches.yourPrediction' | transloco }}:
          <span class="font-bold tabular-nums text-emerald-700">{{ p.predicted_home_score }}–{{ p.predicted_away_score }}</span>
          @if (p.points_awarded !== null) {
            <span class="ms-auto inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              {{ 'matches.points' | transloco: { points: p.points_awarded } }}
            </span>
          }
        </p>
      } @else if (open()) {
        <p class="mt-1.5 border-t border-slate-100 pt-1 text-[11px] font-semibold text-emerald-700">
          {{ 'matches.tapToPredict' | transloco }}
        </p>
      }
    </ng-template>
  `,
})
export class BracketMatch {
  readonly match = input.required<MatchView>();
  /** The signed-in user's existing prediction for this match, if any. */
  readonly prediction = input<Prediction | null>(null);
  readonly predict = output<MatchView>();

  protected readonly open = computed(() => this.match().predictionState === 'open');
  protected readonly hasScore = computed(
    () => this.match().home_score !== null && this.match().away_score !== null,
  );
  protected readonly homeKey = computed(() =>
    this.match().home ? 'countries.' + this.match().home!.code : 'common.tbd',
  );
  protected readonly awayKey = computed(() =>
    this.match().away ? 'countries.' + this.match().away!.code : 'common.tbd',
  );
}

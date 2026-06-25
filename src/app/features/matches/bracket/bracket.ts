import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PendingTasks,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { MatchStage, MatchView } from '../../../core/models/models';
import { MatchService } from '../../../core/services/match.service';
import { PredictionService } from '../../../core/services/prediction.service';
import { BracketMatch } from './bracket-match';

interface StageColumn {
  stage: MatchStage;
  matches: MatchView[];
}

const GROUP_STAGES: MatchStage[] = [
  'group_a', 'group_b', 'group_c', 'group_d',
  'group_e', 'group_f', 'group_g', 'group_h',
  'group_i', 'group_j', 'group_k', 'group_l',
];

/** Knockout rounds left-to-right; the third-place play-off is shown beside the final. */
const KNOCKOUT_STAGES: MatchStage[] = [
  'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final',
];

/**
 * Tournament bracket: the whole competition at a glance. The group stage is a
 * responsive grid of group cards; the knockout rounds are a horizontally
 * scrollable tree that narrows toward the final. Every tile shows the real
 * result and the user's prediction, and opens the prediction dialog when its
 * window is open (via the {@link predict} output, handled by the host page).
 */
@Component({
  selector: 'combi-bracket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BracketMatch, TranslocoPipe],
  template: `
    <section class="mb-10">
      <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        {{ 'matches.groupStage' | transloco }}
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (group of groups(); track group.stage) {
          <section class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 class="mb-2 font-display text-base font-bold tracking-tight">
              {{ 'stages.' + group.stage | transloco }}
            </h3>
            <div class="flex flex-col gap-2">
              @for (match of group.matches; track match.id) {
                <combi-bracket-match
                  [match]="match"
                  [prediction]="predictions.byMatch().get(match.id) ?? null"
                  (predict)="predict.emit($event)"
                />
              }
            </div>
          </section>
        }
      </div>
    </section>

    @if (knockout().length || thirdPlace().length) {
      <section>
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">
            {{ 'matches.knockout' | transloco }}
          </h2>
          <p class="text-xs text-slate-400 lg:hidden">{{ 'matches.bracketScrollHint' | transloco }}</p>
        </div>

        <div class="overflow-x-auto pb-3">
          <div class="flex min-w-max items-stretch gap-4 sm:gap-6">
            @for (round of knockout(); track round.stage) {
              <div class="flex w-40 flex-col">
                <h3 class="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  {{ 'stages.' + round.stage | transloco }}
                </h3>
                <div class="flex flex-1 flex-col justify-around gap-3">
                  @for (match of round.matches; track match.id) {
                    <combi-bracket-match
                      [match]="match"
                      [prediction]="predictions.byMatch().get(match.id) ?? null"
                      (predict)="predict.emit($event)"
                    />
                  }
                </div>
              </div>
            }
            @if (thirdPlace().length) {
              <div class="flex w-40 flex-col">
                <h3 class="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  {{ 'stages.third_place' | transloco }}
                </h3>
                <div class="flex flex-1 flex-col justify-around gap-3">
                  @for (match of thirdPlace(); track match.id) {
                    <combi-bracket-match
                      [match]="match"
                      [prediction]="predictions.byMatch().get(match.id) ?? null"
                      (predict)="predict.emit($event)"
                    />
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </section>
    }

    @if (!loaded() && !matches().length) {
      <p class="text-slate-500">{{ 'matches.empty' | transloco }}</p>
    }
  `,
})
export class Bracket implements OnInit {
  private readonly matchService = inject(MatchService);
  protected readonly predictions = inject(PredictionService);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly matches = signal<MatchView[]>([]);
  protected readonly loaded = signal(false);

  /** Bubbles up to the Matches page, which owns the prediction dialog. */
  readonly predict = output<MatchView>();

  private readonly byStage = computed(() => {
    const map = new Map<MatchStage, MatchView[]>();
    for (const match of this.matches()) {
      (map.get(match.stage) ?? map.set(match.stage, []).get(match.stage)!).push(match);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  });

  protected readonly groups = computed<StageColumn[]>(() =>
    GROUP_STAGES.filter((stage) => this.byStage().has(stage)).map((stage) => ({
      stage,
      matches: this.byStage().get(stage)!,
    })),
  );

  protected readonly knockout = computed<StageColumn[]>(() =>
    KNOCKOUT_STAGES.filter((stage) => this.byStage().has(stage)).map((stage) => ({
      stage,
      matches: this.byStage().get(stage)!,
    })),
  );

  protected readonly thirdPlace = computed(() => this.byStage().get('third_place') ?? []);

  ngOnInit(): void {
    void this.pendingTasks.run(async () => {
      this.matches.set(await this.matchService.getAll());
      this.loaded.set(true);
    });
  }
}

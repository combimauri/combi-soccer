import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { MatchView } from '../../../core/models/models';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import {
  PredictionService,
  PredictionClosedError,
} from '../../../core/services/prediction.service';

@Component({
  selector: 'combi-prediction-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <dialog
      #dlg
      (close)="onClose()"
      class="m-auto w-[min(28rem,92vw)] rounded-2xl p-0 backdrop:bg-slate-900/40"
      aria-labelledby="prediction-dialog-title"
    >
      @if (match(); as m) {
        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="flex flex-col gap-4 p-6"
        >
          <header class="flex items-start justify-between gap-4">
            <h2 id="prediction-dialog-title" class="font-display text-2xl font-bold">
              {{ 'prediction.title' | transloco }}
            </h2>
            <button
              type="button"
              (click)="close()"
              [attr.aria-label]="'prediction.close' | transloco"
              class="cursor-pointer rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <p class="text-sm text-slate-600">
            {{ 'countries.' + m.home?.code | transloco }}
            {{ 'common.vs' | transloco }}
            {{ 'countries.' + m.away?.code | transloco }}
          </p>

          <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <label for="home-score" class="mb-1 block truncate text-center text-sm font-medium">
                {{ 'countries.' + m.home?.code | transloco }}
              </label>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="adjust('home', -1)"
                  [disabled]="form.controls.home.value <= 0"
                  [attr.aria-label]="'prediction.decrease' | transloco"
                  class="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                </button>
                <input
                  id="home-score"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="30"
                  formControlName="home"
                  class="font-display w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-center text-2xl font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                />
                <button
                  type="button"
                  (click)="adjust('home', 1)"
                  [disabled]="form.controls.home.value >= 30"
                  [attr.aria-label]="'prediction.increase' | transloco"
                  class="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
            </div>
            <span class="pb-3 text-center text-xl text-slate-300" aria-hidden="true">–</span>
            <div>
              <label for="away-score" class="mb-1 block truncate text-center text-sm font-medium">
                {{ 'countries.' + m.away?.code | transloco }}
              </label>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="adjust('away', -1)"
                  [disabled]="form.controls.away.value <= 0"
                  [attr.aria-label]="'prediction.decrease' | transloco"
                  class="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                </button>
                <input
                  id="away-score"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="30"
                  formControlName="away"
                  class="font-display w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-center text-2xl font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                />
                <button
                  type="button"
                  (click)="adjust('away', 1)"
                  [disabled]="form.controls.away.value >= 30"
                  [attr.aria-label]="'prediction.increase' | transloco"
                  class="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
            </div>
          </div>

          <p
            class="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-900"
            aria-live="polite"
          >
            <span class="text-emerald-700/80">{{ 'prediction.outcome' | transloco }}:</span>
            <span class="font-semibold">
              @if (outcome() === 'draw') {
                {{ 'prediction.draw' | transloco }}
              } @else {
                {{ 'prediction.win' | transloco: { team: 'countries.' + winnerCode() | transloco } }}
              }
            </span>
          </p>

          @if (errorKey(); as e) {
            <p
              role="alert"
              class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {{ e | transloco }}
            </p>
          }

          <div class="mt-2 flex justify-end gap-2">
            <button
              type="button"
              (click)="close()"
              class="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {{ 'prediction.cancel' | transloco }}
            </button>
            <button
              type="submit"
              [disabled]="form.invalid || saving()"
              class="inline-flex cursor-pointer items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              @if (saving()) {
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
              }
              {{ (saving() ? 'prediction.saving' : 'prediction.place') | transloco }}
            </button>
          </div>
        </form>
      }
    </dialog>
  `,
})
export class PredictionDialog {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly predictions = inject(PredictionService);

  private readonly dlg =
    viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  /** Emitted after a prediction is successfully placed or updated. */
  readonly saved = output<void>();

  protected readonly match = signal<MatchView | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    home: [0, [Validators.required, Validators.min(0), Validators.max(30)]],
    away: [0, [Validators.required, Validators.min(0), Validators.max(30)]],
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly outcome = computed<'home' | 'away' | 'draw'>(() => {
    const { home, away } = this.value();
    if ((home ?? 0) === (away ?? 0)) return 'draw';
    return (home ?? 0) > (away ?? 0) ? 'home' : 'away';
  });

  protected readonly winnerCode = computed(() => {
    const m = this.match();
    return this.outcome() === 'home'
      ? (m?.home?.code ?? '')
      : (m?.away?.code ?? '');
  });

  /** Opens the dialog, gating on auth + username first. */
  async open(match: MatchView): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/auth/sign-in');
      return;
    }
    await this.profile.load();
    if (!this.profile.hasUsername()) {
      void this.router.navigateByUrl('/setup-username');
      return;
    }

    this.errorKey.set(null);
    const existing = await this.predictions.myPrediction(match.id);
    this.form.reset({
      home: existing?.predicted_home_score ?? 0,
      away: existing?.predicted_away_score ?? 0,
    });
    this.match.set(match);
    this.dlg().nativeElement.showModal();
  }

  /** Step a score field via the +/- buttons, clamped to the 0–30 range. */
  protected adjust(side: 'home' | 'away', delta: number): void {
    const ctrl = this.form.controls[side];
    const next = Math.min(30, Math.max(0, (ctrl.value ?? 0) + delta));
    ctrl.setValue(next);
  }

  close(): void {
    this.dlg().nativeElement.close();
  }

  protected onClose(): void {
    this.match.set(null);
  }

  protected async submit(): Promise<void> {
    const m = this.match();
    if (!m || this.form.invalid) return;

    this.saving.set(true);
    this.errorKey.set(null);
    try {
      const { home, away } = this.form.getRawValue();
      await this.predictions.placeOrUpdate(m.id, home, away);
      this.saved.emit();
      this.close();
    } catch (err) {
      this.errorKey.set(
        err instanceof PredictionClosedError
          ? 'prediction.errorClosed'
          : 'prediction.errorGeneric',
      );
    } finally {
      this.saving.set(false);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import {
  ProfileService,
  UsernameTakenError,
} from '../../../core/services/profile.service';

@Component({
  selector: 'combi-username-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <div class="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:mt-6 sm:p-8">
      <h1 class="mb-1 font-display text-3xl font-bold tracking-tight">{{ 'username.title' | transloco }}</h1>
      <p class="mb-6 text-sm text-slate-600">{{ 'username.subtitle' | transloco }}</p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-3">
        <label for="username" class="text-sm font-medium">{{ 'username.label' | transloco }}</label>
        <input
          id="username"
          type="text"
          formControlName="username"
          autocomplete="username"
          aria-describedby="username-hint"
          class="rounded-lg border border-slate-300 px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        />
        <p id="username-hint" class="text-xs text-slate-500">{{ 'username.hint' | transloco }}</p>

        @if (errorKey(); as e) {
          <p role="alert" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ e | transloco }}
          </p>
        }

        <button
          type="submit"
          [disabled]="form.invalid || saving()"
          class="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          {{ (saving() ? 'username.saving' : 'username.continue') | transloco }}
        </button>
      </form>
    </div>
  `,
})
export class UsernameSetup {
  private readonly fb = inject(FormBuilder);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);

  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(24),
      ],
    ],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorKey.set(null);
    try {
      await this.profile.createUsername(this.form.getRawValue().username);
      void this.router.navigateByUrl('/');
    } catch (err) {
      this.errorKey.set(
        err instanceof UsernameTakenError ? 'username.taken' : 'username.generic',
      );
    } finally {
      this.saving.set(false);
    }
  }
}

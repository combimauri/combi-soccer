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
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'combi-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <div class="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:mt-6 sm:p-8">
      <h1 class="mb-1 font-display text-3xl font-bold tracking-tight">{{ 'signIn.title' | transloco }}</h1>
      <p class="mb-6 text-sm text-slate-600">{{ 'signIn.subtitle' | transloco }}</p>

      <button
        type="button"
        (click)="google()"
        class="mb-4 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium transition-colors hover:bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
        </svg>
        {{ 'signIn.google' | transloco }}
      </button>

      <div class="my-4 flex items-center gap-3 text-xs text-slate-400">
        <hr class="flex-1 border-slate-200" />
        {{ 'signIn.or' | transloco }}
        <hr class="flex-1 border-slate-200" />
      </div>

      <form [formGroup]="form" (ngSubmit)="magicLink()" class="flex flex-col gap-3">
        <label for="email" class="text-sm font-medium">{{ 'signIn.emailLabel' | transloco }}</label>
        <input
          id="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          formControlName="email"
          [attr.placeholder]="'signIn.emailPlaceholder' | transloco"
          class="rounded-lg border border-slate-300 px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        />
        <button
          type="submit"
          [disabled]="form.invalid"
          class="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          {{ 'signIn.send' | transloco }}
        </button>
      </form>

      @if (messageKey(); as m) {
        <p role="status" class="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {{ m | transloco }}
        </p>
      }
    </div>
  `,
})
export class SignIn {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly messageKey = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async google(): Promise<void> {
    await this.auth.signInWithGoogle();
  }

  async magicLink(): Promise<void> {
    if (this.form.invalid) return;
    const { error } = await this.auth.signInWithMagicLink(
      this.form.getRawValue().email,
    );
    this.messageKey.set(error ? 'signIn.sendError' : 'signIn.sent');
  }
}

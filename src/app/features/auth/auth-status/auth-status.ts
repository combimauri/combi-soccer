import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

/**
 * Header auth widget. When signed in it shows a compact avatar button that
 * opens an account menu (full username + sign out), so long usernames can never
 * push the bar out of bounds. Loaded with `@defer` so the Supabase client stays
 * out of the initial bundle.
 */
@Component({
  selector: 'combi-auth-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (auth.isAuthenticated()) {
      <div class="relative">
        <button
          type="button"
          (click)="toggle()"
          [attr.aria-expanded]="open()"
          aria-haspopup="menu"
          [attr.aria-label]="'auth.account' | transloco"
          class="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-emerald-500 text-sm font-bold uppercase text-white ring-2 ring-transparent transition-shadow hover:ring-white/30 outline-none focus-visible:ring-amber-400"
        >
          {{ initial() }}
        </button>

        @if (open()) {
          <button
            type="button"
            (click)="close()"
            tabindex="-1"
            aria-hidden="true"
            class="fixed inset-0 z-40 cursor-default"
          ></button>
          <div
            role="menu"
            [attr.aria-label]="'auth.account' | transloco"
            class="absolute end-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg"
          >
            <div class="px-4 py-3">
              <p class="text-xs text-slate-500">{{ 'auth.signedInAs' | transloco }}</p>
              <p class="truncate text-sm font-semibold" [title]="name()">{{ name() }}</p>
            </div>
            <div class="h-px bg-slate-100"></div>
            <button
              role="menuitem"
              type="button"
              (click)="signOut()"
              class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 outline-none focus-visible:bg-red-50"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 12H4.5M8 8l-3.5 4L8 16" />
                <path d="M11 6V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-1" />
              </svg>
              {{ 'auth.signOut' | transloco }}
            </button>
          </div>
        }
      </div>
    } @else {
      <a
        routerLink="/auth/sign-in"
        class="rounded-full bg-emerald-500 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-emerald-400 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        {{ 'auth.signIn' | transloco }}
      </a>
    }
  `,
})
export class AuthStatus {
  protected readonly auth = inject(AuthService);
  protected readonly profile = inject(ProfileService);

  protected readonly open = signal(false);

  /** Display name: username if set, otherwise the account email. */
  protected readonly name = computed(
    () => this.profile.profile()?.username ?? this.auth.user()?.email ?? '',
  );

  /** First character for the avatar. */
  protected readonly initial = computed(() => {
    const n = this.name().trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  });

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.profile.load();
      }
    });
  }

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  signOut(): void {
    this.close();
    void this.auth.signOut();
  }
}

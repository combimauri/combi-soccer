import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

/**
 * Header auth widget. Extracted from the root shell and loaded with `@defer`
 * so the Supabase client (which it pulls in via AuthService) stays out of the
 * initial bundle.
 */
@Component({
  selector: 'combi-auth-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    @if (auth.isAuthenticated()) {
      <span class="hidden text-emerald-50/90 xl:inline">
        @if (profile.profile(); as p) {
          {{ 'auth.greeting' | transloco: { username: p.username } }}
        } @else {
          {{ auth.user()?.email }}
        }
      </span>
      <button
        type="button"
        (click)="signOut()"
        class="cursor-pointer rounded-full border border-white/25 px-3 py-1.5 font-medium text-white transition-colors hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        {{ 'auth.signOut' | transloco }}
      </button>
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

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.profile.load();
      }
    });
  }

  signOut() {
    void this.auth.signOut();
  }
}

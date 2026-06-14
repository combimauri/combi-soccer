import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  effect,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

/**
 * Landing page for the Google OAuth redirect and the email magic link.
 * The Supabase client (configured with `detectSessionInUrl`) consumes the URL
 * fragment automatically; once a session exists we route the user onward —
 * to username setup on first sign-in, otherwise home.
 */
@Component({
  selector: 'combi-auth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div class="mx-auto max-w-sm py-12 text-center">
      <p class="text-slate-600" role="status">{{ 'callback.signingIn' | transloco }}</p>
    </div>
  `,
})
export class AuthCallback {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private handled = false;

  constructor() {
    effect(() => {
      if (!this.isBrowser || this.handled) return;
      if (!this.auth.isAuthenticated()) return;
      this.handled = true;
      void this.redirect();
    });
  }

  private async redirect(): Promise<void> {
    await this.profile.load();
    await this.router.navigateByUrl(
      this.profile.hasUsername() ? '/' : '/setup-username',
    );
  }
}

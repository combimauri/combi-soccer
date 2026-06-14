import { Injectable, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import type { Session } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../supabase/supabase';

/**
 * Owns the Supabase auth session as a signal. Auth is only required to place a
 * bet — browsing matches and leaderboards stays anonymous.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _session = signal<Session | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  constructor() {
    if (!this.isBrowser) return;
    void this.sb.auth.getSession().then(({ data }) => this._session.set(data.session));
    this.sb.auth.onAuthStateChange((_event, session) => this._session.set(session));
  }

  signInWithGoogle() {
    return this.sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  signInWithMagicLink(email: string) {
    return this.sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
  }

  signOut() {
    return this.sb.auth.signOut();
  }
}

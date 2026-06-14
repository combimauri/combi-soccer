import { Injectable, computed, inject, signal } from '@angular/core';

import { SUPABASE_CLIENT } from '../supabase/supabase';
import { Profile } from '../models/models';
import { AuthService } from './auth.service';

/** Postgres unique-violation code, surfaced when a username is taken. */
const UNIQUE_VIOLATION = '23505';

/** Thrown when the chosen username is already in use. */
export class UsernameTakenError extends Error {
  constructor() {
    super('username_taken');
    this.name = 'UsernameTakenError';
  }
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  private readonly _profile = signal<Profile | null>(null);

  readonly profile = this._profile.asReadonly();
  readonly hasUsername = computed(() => !!this._profile()?.username);

  /** Loads the signed-in user's profile (null if none yet). */
  async load(): Promise<Profile | null> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this._profile.set(null);
      return null;
    }
    const { data } = await this.sb
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    this._profile.set(data);
    return data;
  }

  /**
   * Creates the mandatory unique username on first sign-in.
   * Throws a friendly error if the username is already taken.
   */
  async createUsername(username: string): Promise<Profile> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('You must be signed in to choose a username.');

    const { data, error } = await this.sb
      .from('profiles')
      .insert({ id: uid, username })
      .select()
      .single();

    if (error?.code === UNIQUE_VIOLATION) {
      throw new UsernameTakenError();
    }
    if (error) throw error;

    this._profile.set(data);
    return data;
  }
}

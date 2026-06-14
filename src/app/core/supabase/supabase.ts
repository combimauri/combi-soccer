import { InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';
import { Database } from './database.types';

/**
 * A single, app-wide Supabase client, provided through an injection token so the
 * concrete client (browser vs. server, anon vs. cookie-based) can be swapped
 * without touching any service.
 *
 * On the server we disable all session persistence/refresh so SSR never tries to
 * touch `localStorage` or leak a session between requests. For fully
 * authenticated SSR you would replace this factory with a `@supabase/ssr`
 * cookie-based client wired through `server.ts`.
 */
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient<Database>>(
  'SUPABASE_CLIENT',
  {
    providedIn: 'root',
    factory: () => {
      const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
      return createClient<Database>(
        environment.supabaseUrl,
        environment.supabaseKey,
        {
          auth: {
            persistSession: isBrowser,
            autoRefreshToken: isBrowser,
            detectSessionInUrl: isBrowser, // handles the magic-link / OAuth callback
          },
        },
      );
    },
  },
);

import {
  EnvironmentProviders,
  Injectable,
  PLATFORM_ID,
  REQUEST,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Translation,
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';

import { en } from './en';
import { es } from './es';

export const AVAILABLE_LANGS = ['en', 'es'] as const;
export type AppLang = (typeof AVAILABLE_LANGS)[number];

const STORAGE_KEY = 'app_lang';
const dictionaries: Record<string, Translation> = { en, es };

/** Serves bundled translations synchronously — no HTTP, SSR-safe. */
@Injectable({ providedIn: 'root' })
export class InlineTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(dictionaries[lang] ?? {});
  }
}

export function readStoredLang(): AppLang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'en' || value === 'es' ? value : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: AppLang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable (SSR / private mode) — ignore */
  }
}

function pickLang(tag: string | null | undefined): AppLang {
  return (tag ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

function resolveBrowserLang(): AppLang {
  return readStoredLang() ?? pickLang(navigator.language);
}

/** Server-side: honor the request's Accept-Language header. */
function resolveServerLang(request: Request | null): AppLang {
  return pickLang(request?.headers.get('accept-language'));
}

export function provideAppTransloco(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: [...AVAILABLE_LANGS],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { useFallbackTranslation: true, logMissingKey: false },
      },
      loader: InlineTranslocoLoader,
    }),
    // Preload the active language so the first (SSR) render is fully translated.
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
      const request = inject(REQUEST, { optional: true });
      const lang = isBrowser
        ? resolveBrowserLang()
        : resolveServerLang(request);
      transloco.setActiveLang(lang);
      return firstValueFrom(transloco.load(lang));
    }),
  ]);
}

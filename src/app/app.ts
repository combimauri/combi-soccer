import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthStatus } from './features/auth/auth-status/auth-status';
import { LanguageSwitcher } from './shared/language-switcher/language-switcher';
import { BottomNav } from './shared/nav/bottom-nav';
import { NAV_ITEMS } from './shared/nav/nav-items';

@Component({
  selector: 'combi-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AuthStatus,
    LanguageSwitcher,
    BottomNav,
    TranslocoPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);

  protected readonly navItems = NAV_ITEMS;
  protected readonly exactMatch = { exact: true } as const;
  protected readonly looseMatch = { exact: false } as const;

  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  constructor() {
    // Keep <html lang> in sync — set during SSR and on every language switch.
    effect(() => {
      this.document.documentElement.lang = this.activeLang();
    });
  }
}

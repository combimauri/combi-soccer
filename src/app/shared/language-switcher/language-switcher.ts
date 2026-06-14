import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AppLang, AVAILABLE_LANGS, storeLang } from '../../i18n/transloco';

@Component({
  selector: 'combi-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div
      class="flex items-center gap-1"
      role="group"
      [attr.aria-label]="'lang.label' | transloco"
    >
      @for (lang of langs; track lang) {
        <button
          type="button"
          (click)="setLang(lang)"
          [attr.aria-pressed]="active() === lang"
          [class]="
            active() === lang
              ? 'bg-emerald-500 text-white'
              : 'text-emerald-50/70 hover:bg-white/10 hover:text-white'
          "
          class="cursor-pointer rounded-full px-2 py-1 text-xs font-semibold uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {{ lang }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcher {
  private readonly transloco = inject(TranslocoService);
  protected readonly langs = AVAILABLE_LANGS;

  protected readonly active = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  setLang(lang: AppLang): void {
    this.transloco.setActiveLang(lang);
    storeLang(lang);
  }
}

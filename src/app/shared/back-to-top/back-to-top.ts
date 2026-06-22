import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Floating "scroll to top" button. Appears once the page is scrolled past a
 * threshold; sits above the mobile tab bar. Browser-only behaviour (hidden
 * during SSR until the first scroll).
 */
@Component({
  selector: 'combi-back-to-top',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { '(window:scroll)': 'onScroll()' },
  template: `
    @if (visible()) {
      <button
        type="button"
        (click)="scrollToTop()"
        [attr.aria-label]="'common.backToTop' | transloco"
        class="fixed end-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-pitch-900 text-white shadow-lg ring-1 ring-black/5 transition-colors hover:bg-pitch-800 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:bottom-6"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 19V6M6 12l6-6 6 6" />
        </svg>
      </button>
    }
  `,
})
export class BackToTop {
  protected readonly visible = signal(false);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected onScroll(): void {
    if (!this.isBrowser) return;
    this.visible.set(window.scrollY > 400);
  }

  protected scrollToTop(): void {
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
}

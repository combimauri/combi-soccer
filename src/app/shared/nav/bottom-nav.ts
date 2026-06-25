import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { NAV_ITEMS } from './nav-items';
import { NavIcon } from './nav-icon';

/**
 * Mobile-only primary navigation: a fixed bottom tab bar (icon + label, active
 * tab highlighted). Shown below `md`; the desktop bar in the header takes over
 * above it. When there are more than 5 destinations the bar keeps the first
 * four and folds the rest into a "More" sheet so it never overflows.
 */
@Component({
  selector: 'combi-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NavIcon, TranslocoPipe],
  host: { '(document:keydown.escape)': 'closeMore()' },
  template: `
    <!-- The box extends 50vh below the screen (offset by negative bottom, with
         matching bottom padding so the tabs stay put). Safari clips a fixed
         bar's layer to its own box during the toolbar-collapse animation, so
         the fill has to be part of the box — not overflow — to cover the strip
         the shrinking toolbar exposes underneath. -->
    <nav
      class="fixed inset-x-0 bottom-[-50vh] z-40 border-t border-slate-200 bg-white pb-[calc(50vh+env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Primary"
    >
      <ul class="mx-auto flex max-w-md items-stretch">
        @for (item of visible; track item.path) {
          <li class="flex-1">
            <a
              [routerLink]="item.path"
              routerLinkActive
              #rla="routerLinkActive"
              [routerLinkActiveOptions]="item.exact ? exactMatch : looseMatch"
              ariaCurrentWhenActive="page"
              class="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 outline-none transition-colors focus-visible:bg-slate-100"
              [class.text-emerald-700]="rla.isActive"
              [class.text-slate-600]="!rla.isActive"
            >
              <span
                class="grid h-8 w-12 place-items-center rounded-full transition-colors"
                [class.bg-emerald-50]="rla.isActive"
              >
                <combi-nav-icon [name]="item.icon" class="h-5 w-5" />
              </span>
              <span
                class="whitespace-nowrap text-[11px] leading-none"
                [class.font-semibold]="rla.isActive"
                [class.font-medium]="!rla.isActive"
              >
                {{ (item.shortLabelKey ?? item.labelKey) | transloco }}
              </span>
            </a>
          </li>
        }
        @if (overflow.length) {
          <li class="flex-1">
            <button
              type="button"
              (click)="toggleMore()"
              [attr.aria-expanded]="moreOpen()"
              aria-haspopup="menu"
              class="flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 px-1 py-2 outline-none transition-colors focus-visible:bg-slate-100"
              [class.text-emerald-700]="moreOpen()"
              [class.text-slate-600]="!moreOpen()"
            >
              <span
                class="grid h-8 w-12 place-items-center rounded-full transition-colors"
                [class.bg-emerald-50]="moreOpen()"
              >
                <combi-nav-icon name="more" class="h-5 w-5" />
              </span>
              <span class="text-[11px] font-medium leading-none">{{ 'nav.more' | transloco }}</span>
            </button>
          </li>
        }
      </ul>
    </nav>

    @if (moreOpen()) {
      <button
        type="button"
        (click)="closeMore()"
        tabindex="-1"
        aria-label="{{ 'nav.closeMenu' | transloco }}"
        class="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
      ></button>
      <div
        role="menu"
        aria-label="{{ 'nav.more' | transloco }}"
        class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-200 bg-white pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-2xl lg:hidden"
      >
        @for (item of overflow; track item.path) {
          <a
            role="menuitem"
            [routerLink]="item.path"
            routerLinkActive="text-emerald-700"
            #rla="routerLinkActive"
            [routerLinkActiveOptions]="item.exact ? exactMatch : looseMatch"
            ariaCurrentWhenActive="page"
            (click)="closeMore()"
            class="flex items-center gap-3 px-5 py-3 text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-100"
          >
            <combi-nav-icon [name]="item.icon" class="h-5 w-5 shrink-0" />
            <span class="text-sm font-medium">{{ item.labelKey | transloco }}</span>
          </a>
        }
      </div>
    }
  `,
})
export class BottomNav {
  /** Up to four primary tabs inline; the rest go to the "More" sheet. */
  protected readonly visible =
    NAV_ITEMS.length > 5 ? NAV_ITEMS.slice(0, 4) : NAV_ITEMS;
  protected readonly overflow =
    NAV_ITEMS.length > 5 ? NAV_ITEMS.slice(4) : [];

  protected readonly moreOpen = signal(false);

  protected readonly exactMatch = { exact: true } as const;
  protected readonly looseMatch = { exact: false } as const;

  protected toggleMore(): void {
    this.moreOpen.update((open) => !open);
  }

  protected closeMore(): void {
    this.moreOpen.set(false);
  }
}

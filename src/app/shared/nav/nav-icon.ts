import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

import { NavIconName } from './nav-items';

/** Renders one of the navigation glyphs. Size/colour come from the parent via `class`. */
@Component({
  selector: 'combi-nav-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.class]="class()"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('predict') {
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
        }
        @case ('matches') {
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
        }
        @case ('leaderboard') {
          <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
          <path d="M8 5.5H5.5A1.5 1.5 0 0 0 7 9M16 5.5h2.5A1.5 1.5 0 0 1 17 9" />
          <path d="M12 12v4M9 19.5h6M9.5 19.5l.6-3.5h3.8l.6 3.5" />
        }
        @case ('howto') {
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.3c-.7.4-1.1.9-1.1 1.8" />
          <circle cx="11.9" cy="16.3" r="0.75" fill="currentColor" stroke="none" />
        }
        @case ('more') {
          <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
        }
      }
    </svg>
  `,
})
export class NavIcon {
  readonly name = input.required<NavIconName | 'more'>();
  readonly class = input('h-5 w-5');
}

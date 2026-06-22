import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Accessible search input with a leading magnifier and a clear button.
 * Two-way bind the query via `[value]` / `(valueChange)` (a `model`).
 */
@Component({
  selector: 'combi-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div class="relative">
      <svg
        viewBox="0 0 24 24"
        class="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        [value]="value()"
        (input)="onInput($event)"
        [attr.aria-label]="label()"
        [placeholder]="placeholder()"
        class="w-full rounded-full border border-slate-300 bg-white py-2 pe-10 ps-10 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 [&::-webkit-search-cancel-button]:appearance-none"
      />
      @if (value()) {
        <button
          type="button"
          (click)="clear()"
          [attr.aria-label]="'search.clear' | transloco"
          class="absolute end-2 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      }
    </div>
  `,
})
export class SearchField {
  /** The current query text; two-way bindable. */
  readonly value = model<string>('');
  /** Accessible label for the input (visually hidden — there is no visible label). */
  readonly label = input<string>('');
  readonly placeholder = input<string>('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.value.set('');
  }
}

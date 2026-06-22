import { Signal, computed, signal } from '@angular/core';

export interface Pagination<T> {
  /** The source sliced to the current limit. */
  items: Signal<readonly T[]>;
  /** Whether more items remain beyond the current limit. */
  hasMore: Signal<boolean>;
  /** Reveal the next page. */
  more: () => void;
}

/**
 * Client-side pagination for an already-loaded list: exposes a windowed view
 * that grows by `step` each time {@link Pagination.more} is called. Pair with
 * the `combiInfiniteScroll` sentinel to reveal pages on scroll. Reactive — the
 * window recomputes when `source` changes (e.g. after filtering).
 */
export function paginate<T>(
  source: Signal<readonly T[]>,
  step: number,
): Pagination<T> {
  const limit = signal(step);
  return {
    items: computed(() => source().slice(0, limit())),
    hasMore: computed(() => source().length > limit()),
    more: () => limit.update((n) => n + step),
  };
}

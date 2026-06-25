import {
  Directive,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  output,
} from '@angular/core';

/** Nearest scrollable ancestor, or null (the viewport) if there isn't one. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Sentinel directive: emits `reached` when the host element scrolls near its
 * scroll container, so a list can reveal its next page. The observer roots on
 * the nearest scrollable ancestor (the app shell's `#app-scroll`), falling back
 * to the viewport. Browser-only (the observer is set up in `afterNextRender`,
 * which never runs during SSR).
 */
@Directive({ selector: '[combiInfiniteScroll]' })
export class InfiniteScroll implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly reached = output<void>();
  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.reached.emit();
              break;
            }
          }
        },
        { root: scrollParent(this.host.nativeElement), rootMargin: '300px 0px' },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

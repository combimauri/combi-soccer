import {
  Directive,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  output,
} from '@angular/core';

/**
 * Sentinel directive: emits `reached` when the host element scrolls near the
 * viewport, so a list can reveal its next page. Browser-only (the observer is
 * set up in `afterNextRender`, which never runs during SSR).
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
        { rootMargin: '300px 0px' },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

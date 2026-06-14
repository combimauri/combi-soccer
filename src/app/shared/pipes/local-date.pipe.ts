import { LOCALE_ID, PLATFORM_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { formatDate, isPlatformBrowser } from '@angular/common';

/**
 * Formats a UTC timestamp in the **viewer's local timezone**.
 *
 * In the browser `formatDate` with no explicit timezone uses the runtime zone —
 * i.e. the client's. During SSR the client zone is unknown, so we render a
 * deterministic UTC value; Angular hydration then updates the text to local
 * time on the client (text-content updates don't break hydration).
 */
@Pipe({ name: 'localDate' })
export class LocalDatePipe implements PipeTransform {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly locale = inject(LOCALE_ID);

  transform(
    value: string | Date | null | undefined,
    format = 'EEE d MMM, HH:mm',
  ): string {
    if (!value) return '';
    const timezone = isPlatformBrowser(this.platformId) ? undefined : 'UTC';
    return formatDate(value, format, this.locale, timezone);
  }
}

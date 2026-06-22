import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../supabase/supabase';
import { LeaderboardEntry } from '../models/models';

const PAGE_SIZE = 25;

/**
 * The global leaderboard: public, always visible, and updated in realtime as
 * matches are scored. Rows are fetched a page at a time from the server (ordered
 * with the tie-break baked into the query) and appended as the user scrolls, so
 * the whole table is never loaded up front.
 */
@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _rows = signal<LeaderboardEntry[]>([]);
  /** Loaded rows, already in rank order (points → exact → outcomes). */
  readonly ranked = this._rows.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  /** Whether another page might exist beyond what's loaded. */
  readonly hasMore = signal(true);

  private channel: RealtimeChannel | null = null;

  /** Fetch a slice ordered by points then the tie-breaks, so paging is stable. */
  private page(from: number, to: number) {
    return this.sb
      .from('leaderboard')
      .select('*, profile:user_id(username)')
      .order('total_points', { ascending: false })
      .order('exact_scores', { ascending: false })
      .order('correct_outcomes', { ascending: false })
      .range(from, to);
  }

  /** Load (or reload) the first page. */
  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.page(0, PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as LeaderboardEntry[];
      this._rows.set(rows);
      this.hasMore.set(rows.length === PAGE_SIZE);
    } finally {
      this._loading.set(false);
    }
  }

  /** Append the next page; no-op while loading or when nothing remains. */
  async loadMore(): Promise<void> {
    if (this._loading() || !this.hasMore()) return;
    this._loading.set(true);
    try {
      const from = this._rows().length;
      const { data, error } = await this.page(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as LeaderboardEntry[];
      this._rows.update((current) => [...current, ...rows]);
      this.hasMore.set(rows.length === PAGE_SIZE);
    } finally {
      this._loading.set(false);
    }
  }

  /** Subscribe to any leaderboard change and refresh the loaded rows in place. */
  subscribe(): void {
    if (!this.isBrowser || this.channel) return;
    this.channel = this.sb
      .channel('public:leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard' },
        () => void this.refreshLoaded(),
      )
      .subscribe();
  }

  /** Re-fetch exactly the rows already on screen so live scoring updates them. */
  private async refreshLoaded(): Promise<void> {
    const count = this._rows().length;
    if (!count) {
      void this.load();
      return;
    }
    const { data, error } = await this.page(0, count - 1);
    if (error) return;
    this._rows.set((data ?? []) as unknown as LeaderboardEntry[]);
  }

  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.sb.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

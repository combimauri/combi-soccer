import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../supabase/supabase';
import { LeaderboardEntry } from '../models/models';

/**
 * The global leaderboard: public, always visible, and updated in realtime as
 * matches are scored. No auth required.
 */
@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly rows = signal<LeaderboardEntry[]>([]);
  private channel: RealtimeChannel | null = null;

  /**
   * Ranked client-side so the time-weighting tie-break is explicit:
   * points → exact scores → correct outcomes.
   */
  readonly ranked = computed(() =>
    [...this.rows()].sort(
      (a, b) =>
        b.total_points - a.total_points ||
        b.exact_scores - a.exact_scores ||
        b.correct_outcomes - a.correct_outcomes,
    ),
  );

  async load(): Promise<void> {
    const { data, error } = await this.sb
      .from('leaderboard')
      .select('*, profile:user_id(username)')
      .order('total_points', { ascending: false });
    if (error) throw error;
    this.rows.set((data ?? []) as unknown as LeaderboardEntry[]);
  }

  /** Subscribe to any leaderboard change and refetch. Browser only. */
  subscribe(): void {
    if (!this.isBrowser || this.channel) return;
    this.channel = this.sb
      .channel('public:leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard' },
        () => void this.load(),
      )
      .subscribe();
  }

  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.sb.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

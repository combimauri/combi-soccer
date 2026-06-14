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
import {
  MatchRow,
  MatchStage,
  MatchView,
  Team,
  deriveBettingState,
} from '../models/models';

/** Display order: Groups A–H first, then knockout rounds. */
const STAGE_ORDER: MatchStage[] = [
  'group_a', 'group_b', 'group_c', 'group_d',
  'group_e', 'group_f', 'group_g', 'group_h',
  'group_i', 'group_j', 'group_k', 'group_l',
  'round_of_32', 'round_of_16', 'quarter_final',
  'semi_final', 'third_place', 'final',
];

interface MatchWithTeams extends MatchRow {
  home: Team | null;
  away: Team | null;
}

export interface StageGroup {
  stage: MatchStage;
  matches: MatchView[];
}

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Re-evaluated every tick so betting state stays current without a refetch. */
  private readonly now = signal(Date.now());
  private readonly rows = signal<MatchWithTeams[]>([]);
  private channel: RealtimeChannel | null = null;

  /** All matches as view models, chronological, with live betting state. */
  readonly matches = computed<MatchView[]>(() => {
    const now = this.now();
    return this.rows().map((row) => ({
      ...row,
      bettingState: deriveBettingState(row, now),
    }));
  });

  /** Grouped Group Stage A–H then knockout, each chronologically sorted. */
  readonly grouped = computed<StageGroup[]>(() => {
    const byStage = new Map<MatchStage, MatchView[]>();
    for (const match of this.matches()) {
      (byStage.get(match.stage) ?? byStage.set(match.stage, []).get(match.stage)!).push(match);
    }
    return STAGE_ORDER.filter((stage) => byStage.has(stage)).map((stage) => ({
      stage,
      matches: byStage
        .get(stage)!
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));
  });

  readonly openForBetting = computed(() =>
    this.matches().filter((m) => m.bettingState === 'open'),
  );

  /** Matches currently in play (API-verified live status), earliest first. */
  readonly liveMatches = computed(() =>
    this.matches()
      .filter((m) => m.status === 'live')
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  );

  /** Advance the internal clock; call from a component timer (browser only). */
  tick(): void {
    this.now.set(Date.now());
  }

  async load(): Promise<void> {
    const { data, error } = await this.sb
      .from('matches')
      .select('*, home:home_team_id(*), away:away_team_id(*)')
      .order('start_time');
    if (error) throw error;
    this.rows.set((data ?? []) as unknown as MatchWithTeams[]);
  }

  /** Fetch a single match (with teams) for the detail page. */
  async getMatch(id: number): Promise<MatchView | null> {
    const { data, error } = await this.sb
      .from('matches')
      .select('*, home:home_team_id(*), away:away_team_id(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as MatchWithTeams;
    return { ...row, bettingState: deriveBettingState(row, Date.now()) };
  }

  /** Subscribe to live match UPDATEs (scores/status). Browser only. */
  subscribeLive(): void {
    if (!this.isBrowser || this.channel) return;
    this.channel = this.sb
      .channel('public:matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        ({ new: row }) => this.upsert(row as MatchRow),
      )
      .subscribe();
  }

  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.sb.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /** Merge a realtime row, preserving the already-joined team objects. */
  private upsert(row: MatchRow): void {
    this.rows.update((list) => {
      const index = list.findIndex((m) => m.id === row.id);
      if (index === -1) return [...list, { ...row, home: null, away: null }];
      return list.map((m, i) => (i === index ? { ...m, ...row } : m));
    });
  }
}

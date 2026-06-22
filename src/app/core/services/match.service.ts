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
  MatchWithTeams,
  derivePredictionState,
} from '../models/models';

/** Display order: Groups A–L first, then knockout rounds. */
const STAGE_ORDER: MatchStage[] = [
  'group_a', 'group_b', 'group_c', 'group_d',
  'group_e', 'group_f', 'group_g', 'group_h',
  'group_i', 'group_j', 'group_k', 'group_l',
  'round_of_32', 'round_of_16', 'quarter_final',
  'semi_final', 'third_place', 'final',
];

/** Matches per page (a multiple of the 6-per-group size so group-stage pages align). */
const PAGE_SIZE = 24;

export interface StageGroup {
  stage: MatchStage;
  matches: MatchView[];
}

const SELECT = '*, home:home_team_id(*), away:away_team_id(*)';

/** Group matches by stage in display order, each group sorted chronologically. */
export function groupByStage(matches: readonly MatchView[]): StageGroup[] {
  const byStage = new Map<MatchStage, MatchView[]>();
  for (const match of matches) {
    (byStage.get(match.stage) ?? byStage.set(match.stage, []).get(match.stage)!).push(match);
  }
  return STAGE_ORDER.filter((stage) => byStage.has(stage)).map((stage) => ({
    stage,
    matches: byStage
      .get(stage)!
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));
}

/**
 * Source for the "All matches" list. Matches are fetched a page at a time in
 * stage then kickoff order and appended as the user scrolls, so the full
 * fixture list is never loaded up front. Rows accumulate and are grouped by
 * stage on the client.
 */
@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Re-evaluated every tick so prediction state stays current without a refetch. */
  private readonly now = signal(Date.now());
  private readonly rows = signal<MatchWithTeams[]>([]);
  private readonly _loading = signal(false);
  readonly hasMore = signal(true);
  private channel: RealtimeChannel | null = null;

  /** Loaded matches as view models with live prediction state. */
  readonly matches = computed<MatchView[]>(() => {
    const now = this.now();
    return this.rows().map((row) => ({
      ...row,
      predictionState: derivePredictionState(row, now),
    }));
  });

  /** Loaded matches grouped by stage in display order, each chronological. */
  readonly grouped = computed<StageGroup[]>(() => groupByStage(this.matches()));

  /** Advance the internal clock; call from a component timer (browser only). */
  tick(): void {
    this.now.set(Date.now());
  }

  private page(from: number, to: number) {
    return this.sb
      .from('matches')
      .select(SELECT)
      .order('stage')
      .order('start_time')
      .range(from, to);
  }

  /** Load (or reload) the first page. */
  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.page(0, PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MatchWithTeams[];
      this.rows.set(rows);
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
      const from = this.rows().length;
      const { data, error } = await this.page(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MatchWithTeams[];
      this.rows.update((current) => [...current, ...rows]);
      this.hasMore.set(rows.length === PAGE_SIZE);
    } finally {
      this._loading.set(false);
    }
  }

  /** Fetch a single match (with teams) for the detail page. */
  async getMatch(id: number): Promise<MatchView | null> {
    const { data, error } = await this.sb
      .from('matches')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as MatchWithTeams;
    return { ...row, predictionState: derivePredictionState(row, Date.now()) };
  }

  /** Subscribe to live match UPDATEs (scores/status) for already-loaded rows. */
  subscribeLive(): void {
    if (!this.isBrowser || this.channel) return;
    this.channel = this.sb
      .channel('public:matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        ({ new: row }) => this.applyUpdate(row as MatchRow),
      )
      .subscribe();
  }

  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.sb.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /** Merge a realtime row into the loaded set, preserving the joined teams.
   * Updates that target an as-yet-unloaded match are ignored — they arrive
   * fresh when that page is fetched. */
  private applyUpdate(row: MatchRow): void {
    this.rows.update((list) => {
      const index = list.findIndex((m) => m.id === row.id);
      if (index === -1) return list;
      return list.map((m, i) => (i === index ? { ...m, ...row } : m));
    });
  }
}

import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../supabase/supabase';
import {
  MatchRow,
  MatchView,
  MatchWithTeams,
  derivePredictionState,
} from '../models/models';
import { PredictionService } from './prediction.service';

const SELECT = '*, home:home_team_id(*), away:away_team_id(*)';
const HISTORY_PAGE = 8;
/** Upper bound of the prediction window (opens 24 h before kickoff). */
const OPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Data for the predict-now dashboard, fetched as targeted server queries rather
 * than loading the whole fixture list:
 * - live: matches with `status='live'`,
 * - open: scheduled matches kicking off within 24 h (the client derives which
 *   are actually inside the open window),
 * - history: finished matches the user predicted, paginated as they scroll.
 */
@Injectable({ providedIn: 'root' })
export class PredictNowService {
  private readonly sb = inject(SUPABASE_CLIENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly predictions = inject(PredictionService);

  /** Re-evaluated every tick so the open-window filter stays current. */
  private readonly now = signal(Date.now());
  private readonly liveRows = signal<MatchWithTeams[]>([]);
  private readonly upcomingRows = signal<MatchWithTeams[]>([]);
  private readonly historyRows = signal<MatchWithTeams[]>([]);

  readonly hasMoreHistory = signal(false);
  private historyLoading = false;
  private channel: RealtimeChannel | null = null;

  readonly liveMatches = computed<MatchView[]>(() => {
    const now = this.now();
    return this.liveRows()
      .map((r) => ({ ...r, predictionState: derivePredictionState(r, now) }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  readonly openForPredictions = computed<MatchView[]>(() => {
    const now = this.now();
    return this.upcomingRows()
      .map((r) => ({ ...r, predictionState: derivePredictionState(r, now) }))
      .filter((m) => m.predictionState === 'open');
  });

  readonly history = computed<MatchView[]>(() => {
    const now = this.now();
    return this.historyRows().map((r) => ({
      ...r,
      predictionState: derivePredictionState(r, now),
    }));
  });

  constructor() {
    // (Re)load history whenever the user's set of predictions changes.
    effect(() => {
      this.predictions.byMatch();
      if (this.isBrowser) void this.loadHistory();
    });
  }

  tick(): void {
    this.now.set(Date.now());
  }

  /** Live matches + near-term scheduled matches (open-window candidates). */
  async loadActive(): Promise<void> {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const horizonIso = new Date(nowMs + OPEN_WINDOW_MS).toISOString();
    const [live, upcoming] = await Promise.all([
      this.sb.from('matches').select(SELECT).eq('status', 'live').order('start_time'),
      this.sb
        .from('matches')
        .select(SELECT)
        .eq('status', 'scheduled')
        .gte('start_time', nowIso)
        .lte('start_time', horizonIso)
        .order('start_time'),
    ]);
    if (!live.error) this.liveRows.set((live.data ?? []) as unknown as MatchWithTeams[]);
    if (!upcoming.error) {
      this.upcomingRows.set((upcoming.data ?? []) as unknown as MatchWithTeams[]);
    }
  }

  /** Load (or reload) the first page of history. */
  loadHistory(): Promise<void> {
    return this.fetchHistory(true);
  }

  /** Append the next page of history; no-op while loading or when none remain. */
  async loadMoreHistory(): Promise<void> {
    if (this.historyLoading || !this.hasMoreHistory()) return;
    await this.fetchHistory(false);
  }

  private async fetchHistory(reset: boolean): Promise<void> {
    const ids = [...this.predictions.byMatch().keys()];
    if (!ids.length) {
      this.historyRows.set([]);
      this.hasMoreHistory.set(false);
      return;
    }
    this.historyLoading = true;
    try {
      const from = reset ? 0 : this.historyRows().length;
      const { data, error } = await this.sb
        .from('matches')
        .select(SELECT)
        .in('id', ids)
        .eq('status', 'finished')
        .order('start_time', { ascending: false })
        .range(from, from + HISTORY_PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MatchWithTeams[];
      this.historyRows.update((current) => (reset ? rows : [...current, ...rows]));
      this.hasMoreHistory.set(rows.length === HISTORY_PAGE);
    } finally {
      this.historyLoading = false;
    }
  }

  /** Realtime: a match changing status can move between sets, so refresh active. */
  subscribeLive(): void {
    if (!this.isBrowser || this.channel) return;
    this.channel = this.sb
      .channel('public:predict-now')
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

  private applyUpdate(row: MatchRow): void {
    void this.loadActive();
    this.historyRows.update((list) => {
      const index = list.findIndex((m) => m.id === row.id);
      if (index === -1) return list;
      return list.map((m, i) => (i === index ? { ...m, ...row } : m));
    });
  }
}

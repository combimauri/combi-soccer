-- Knockout penalty shoot-outs: capture the shoot-out result, let users pick which
-- team advances on penalties, and award a +3 bonus for a correct pick.
--
-- REVIEW-ONLY: not yet applied to the live database. Apply order: run this
-- migration FIRST, then deploy the matching app build (the client writes/reads
-- the new columns).
--
-- Background, verified against TheSportsDB on 2026-06-29 with historical
-- shoot-outs (2022 WC final Argentina–France, Netherlands–Argentina QF):
--   * intHomeScore / intAwayScore hold the score at the end of regulation/extra
--     time — i.e. the TIED score for a match decided on penalties.
--   * intHomeScoreExtra / intAwayScoreExtra hold the PENALTY shoot-out score and
--     are null when there was no shoot-out. The advancer is the side with the
--     higher penalty count (penalties can't tie).
--   * A finished shoot-out can report strStatus 'AP' (after penalties). The sync
--     previously did NOT treat 'AP' as finished, so such a match would have been
--     left 'scheduled' and never scored — fixed here. We also reclassify a bare
--     'PEN' as in-play (shoot-out in progress) rather than finished, so a match
--     is only finalized once a decisive status ('FT'/'AET'/'AP') arrives (or the
--     existing time-based safety net fires), never mid-shoot-out.

begin;

-- 1. Schema -----------------------------------------------------------------

-- Penalty shoot-out score on the match (null when the match didn't go to pens).
alter table public.matches
  add column if not exists home_penalties smallint,
  add column if not exists away_penalties smallint;

-- Who advances: the penalty winner when there was a shoot-out, otherwise the
-- regulation/ET winner. Null while the match is undecided or a non-knockout draw.
alter table public.matches
  drop column if exists advancer;
alter table public.matches
  add column advancer public.bet_outcome
  generated always as (
    case
      when home_penalties is not null and away_penalties is not null then
        case
          when home_penalties > away_penalties then 'home'::public.bet_outcome
          else 'away'::public.bet_outcome
        end
      when home_score is null or away_score is null then null
      when home_score > away_score then 'home'::public.bet_outcome
      when home_score < away_score then 'away'::public.bet_outcome
      else null
    end
  ) stored;

-- The user's pick for who wins a knockout shoot-out (null for group matches or
-- when not chosen). Constrained to a concrete side — never 'draw'.
alter table public.bets
  add column if not exists predicted_advancer public.bet_outcome;
alter table public.bets
  drop constraint if exists bets_predicted_advancer_check;
alter table public.bets
  add constraint bets_predicted_advancer_check
  check (predicted_advancer is null or predicted_advancer in ('home', 'away'));

-- 2. Scoring (single source of truth) ---------------------------------------

-- Recompute points for every bet on a finished match and refresh the leaderboard.
-- Formula (unchanged for group matches):
--   +3 correct outcome, +5 exact score, else +1 per correct team goal count,
--   +3 NEW: knockout advancer bonus — only when the match actually went to a
--   shoot-out and the user picked the side that advanced.
-- Previously this formula lived in two places (the score_match trigger and the
-- sync's post-finalization correction block); both now call this function.
create or replace function public.score_bets_for_match(p_match_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.bets b
     set points_awarded =
           (case when b.predicted_outcome = m.outcome then 3 else 0 end)
         + (case when b.predicted_home_score = m.home_score
                  and b.predicted_away_score = m.away_score then 5 else 0 end)
         + (case
              when b.predicted_home_score = m.home_score
               and b.predicted_away_score = m.away_score then 0
              else (case when b.predicted_home_score = m.home_score then 1 else 0 end)
                 + (case when b.predicted_away_score = m.away_score then 1 else 0 end)
            end)
         + (case
              when m.home_penalties is not null and m.away_penalties is not null
               and b.predicted_advancer is not null
               and b.predicted_advancer = m.advancer then 3 else 0
            end)
    from public.matches m
   where b.match_id = m.id
     and m.id = p_match_id
     and m.home_score is not null
     and m.away_score is not null;

  perform public.refresh_leaderboard_for_match(p_match_id);
end;
$function$;

-- Trigger now delegates to the shared scorer.
create or replace function public.score_match()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'finished'
     and new.home_score is not null and new.away_score is not null
     and old.status is distinct from 'finished'
  then
    perform public.score_bets_for_match(new.id);
  end if;
  return new;
end;
$function$;

-- 3. Sync ---------------------------------------------------------------------
-- Recreated with three changes vs. the live version:
--   (a) status maps: add 'AP' to the finished set; move bare 'PEN' to the live
--       set (shoot-out in progress) so we never finalize mid-shoot-out.
--   (b) capture intHomeScoreExtra/intAwayScoreExtra -> home_penalties/away_penalties
--       at every score-writing site (penalties mirror scores: direct in the bulk
--       feed, coalesced in the per-match loops so a manual override is preserved).
--   (c) the post-finalization correction block calls score_bets_for_match()
--       instead of an inlined copy of the points formula.
create or replace function public.sync_matches_from_api()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  resp jsonb;
  rec record;
  v_event jsonb;
  v_timeline jsonb;
  v_status text;
  v_updated integer := 0;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '8000');

  begin
    select (extensions.http_get(
      'https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026'
    )).content::jsonb into resp;
  exception when others then
    raise notice 'sync: season HTTP failed: %', sqlerrm;
    resp := null;
  end;

  if resp is not null and jsonb_typeof(resp->'events') = 'array' then
    with api as (
      select
        e->>'idEvent'                              as event_id,
        e->>'strHomeTeam'                          as home_name,
        e->>'strAwayTeam'                          as away_name,
        nullif(e->>'strTimestamp','')::timestamptz as ts,
        upper(coalesce(e->>'strStatus',''))        as st,
        nullif(e->>'intHomeScore','')::smallint    as hs,
        nullif(e->>'intAwayScore','')::smallint    as as_,
        nullif(e->>'intHomeScoreExtra','')::smallint as hp,
        nullif(e->>'intAwayScoreExtra','')::smallint as ap_,
        nullif(e->>'strProgress','')               as minute
      from jsonb_array_elements(resp->'events') as e
    ),
    mapped as (
      select
        m.id as match_id,
        a.event_id,
        case
          when a.st in ('FT','AET','AP','MATCH FINISHED','FINISHED') then 'finished'
          when a.st in ('1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY') then 'live'
          else 'scheduled'
        end::match_status as new_status,
        a.st as phase,
        a.minute, a.hs, a.as_, a.hp, a.ap_, a.ts
      from api a
      join public.teams th on coalesce(th.api_name, th.name) = a.home_name
      join public.teams ta on coalesce(ta.api_name, ta.name) = a.away_name
      join public.matches m on m.home_team_id = th.id and m.away_team_id = ta.id
    )
    update public.matches m
    set
      status            = md.new_status,
      start_time        = coalesce(md.ts, m.start_time),
      home_score        = case when md.new_status in ('finished','live') then md.hs else m.home_score end,
      away_score        = case when md.new_status in ('finished','live') then md.as_ else m.away_score end,
      home_penalties    = case when md.new_status in ('finished','live') then md.hp else m.home_penalties end,
      away_penalties    = case when md.new_status in ('finished','live') then md.ap_ else m.away_penalties end,
      provider_event_id = md.event_id,
      phase             = md.phase,
      minute            = case when md.new_status = 'live' then md.minute else null end
    from mapped md
    where m.id = md.match_id
      and (
        m.status is distinct from md.new_status
        or (md.ts is not null and m.start_time is distinct from md.ts)
        or (md.new_status in ('finished','live')
            and (m.home_score is distinct from md.hs or m.away_score is distinct from md.as_))
        or (md.new_status in ('finished','live')
            and (m.home_penalties is distinct from md.hp or m.away_penalties is distinct from md.ap_))
        or m.provider_event_id is distinct from md.event_id
        or m.phase is distinct from md.phase
        or m.minute is distinct from (case when md.new_status = 'live' then md.minute else null end)
      );

    get diagnostics v_updated = row_count;
  end if;

  -- Per-match discovery by name. Neither eventsseason.php nor eventsday.php reliably lists a
  -- given match on the free tier: both return only a small rolling subset, so a match can be
  -- absent from both while still existing in TheSportsDB (seen 2026-06-17: Portugal vs DR Congo,
  -- already FT, in neither feed). Such a match keeps provider_event_id = NULL and is unreachable
  -- by every id-based loop below, staying stuck 'scheduled' past kickoff. searchevents.php looks
  -- the event up directly by name (<Home>_vs_<Away>, season 2026) and returns its current
  -- status/score, so we can discover the id regardless of any window. Bounded to matches still
  -- missing an id whose kickoff is within now() +/- 1 day, so a small number of calls per run;
  -- once discovered they gain an id and drop out of this loop. Sets status/score so a finished
  -- match scores immediately; reconciliation + goals loops below refine anything still live.
  --
  -- Team names MUST be percent-encoded before going into the URL: a raw multibyte character
  -- (e.g. the cedilla in 'Curaçao', or 'Türkiye') makes http_get send a malformed query that
  -- TheSportsDB cannot match, so the event is never found and the match stays stuck 'scheduled'
  -- forever (seen 2026-06-25: Curaçao vs Ivory Coast id 28, already FT 0-2, never discovered).
  -- Spaces become '_' first (the endpoint's <Home>_vs_<Away> convention), then url_encode keeps
  -- '_' but percent-encodes everything else.
  for rec in
    select m.id,
           public.url_encode(replace(coalesce(th.api_name, th.name), ' ', '_')) as home_q,
           public.url_encode(replace(coalesce(ta.api_name, ta.name), ' ', '_')) as away_q
    from public.matches m
    join public.teams th on th.id = m.home_team_id
    join public.teams ta on ta.id = m.away_team_id
    where m.provider_event_id is null
      and m.status in ('scheduled','live')
      and m.start_time between now() - interval '1 day' and now() + interval '1 day'
  loop
    begin
      select (extensions.http_get(
        'https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e='
          || rec.home_q || '_vs_' || rec.away_q || '&s=2026'
      )).content::jsonb -> 'event' -> 0
      into v_event;
    exception when others then
      continue;
    end;

    if v_event is null then
      continue;
    end if;

    v_status := upper(coalesce(v_event->>'strStatus',''));

    update public.matches m
    set
      provider_event_id = v_event->>'idEvent',
      start_time        = coalesce(nullif(v_event->>'strTimestamp','')::timestamptz, m.start_time),
      status            = case
                            when v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED') then 'finished'
                            when v_status in ('1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY') then 'live'
                            else m.status
                          end::match_status,
      home_score        = case when v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED','1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY')
                               then coalesce(nullif(v_event->>'intHomeScore','')::smallint, m.home_score) else m.home_score end,
      away_score        = case when v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED','1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY')
                               then coalesce(nullif(v_event->>'intAwayScore','')::smallint, m.away_score) else m.away_score end,
      home_penalties    = case when v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED','1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY')
                               then coalesce(nullif(v_event->>'intHomeScoreExtra','')::smallint, m.home_penalties) else m.home_penalties end,
      away_penalties    = case when v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED','1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY')
                               then coalesce(nullif(v_event->>'intAwayScoreExtra','')::smallint, m.away_penalties) else m.away_penalties end,
      phase             = case when v_status <> '' then v_status else m.phase end,
      minute            = case when v_status in ('1H','2H','ET') then nullif(v_event->>'strProgress','') else null end
    where m.id = rec.id;
  end loop;

  -- Reconcile matches the rolling season-feed window can no longer reach against the
  -- authoritative single-event endpoint. eventsseason.php returns only a small window
  -- of events on the free tier, so a match can drop out of it while still flagged
  -- 'live', OR 'scheduled' even though its kickoff has already passed (it was never
  -- caught live). lookupevent.php always reports a match's current/final status.
  for rec in
    select id, provider_event_id
    from public.matches
    where provider_event_id is not null
      and (
        status = 'live'
        or (status = 'scheduled' and start_time <= now())
      )
  loop
    begin
      select (extensions.http_get(
        'https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=' || rec.provider_event_id
      )).content::jsonb -> 'events' -> 0
      into v_event;
    exception when others then
      continue;
    end;

    if v_event is null then
      continue;
    end if;

    v_status := upper(coalesce(v_event->>'strStatus',''));

    -- Only act on a recognised in-play/finished status; ignore NS/empty/unknown so we
    -- never clobber a genuinely-not-started match.
    if v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED','1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY') then
      update public.matches m
      set
        status         = case
                           when v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED') then 'finished'
                           else 'live'
                         end::match_status,
        home_score     = coalesce(nullif(v_event->>'intHomeScore','')::smallint, m.home_score),
        away_score     = coalesce(nullif(v_event->>'intAwayScore','')::smallint, m.away_score),
        home_penalties = coalesce(nullif(v_event->>'intHomeScoreExtra','')::smallint, m.home_penalties),
        away_penalties = coalesce(nullif(v_event->>'intAwayScoreExtra','')::smallint, m.away_penalties),
        phase          = v_status,
        minute         = case when v_status in ('1H','2H','ET') then nullif(v_event->>'strProgress','') else null end
      where m.id = rec.id
        and (
          m.status is distinct from (case when v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED') then 'finished' else 'live' end)::match_status
          or m.home_score is distinct from coalesce(nullif(v_event->>'intHomeScore','')::smallint, m.home_score)
          or m.away_score is distinct from coalesce(nullif(v_event->>'intAwayScore','')::smallint, m.away_score)
          or m.home_penalties is distinct from coalesce(nullif(v_event->>'intHomeScoreExtra','')::smallint, m.home_penalties)
          or m.away_penalties is distinct from coalesce(nullif(v_event->>'intAwayScoreExtra','')::smallint, m.away_penalties)
          or m.phase is distinct from v_status
          or m.minute is distinct from (case when v_status in ('1H','2H','ET') then nullif(v_event->>'strProgress','') else null end)
        );
    end if;
  end loop;

  -- Time-based safety net. TheSportsDB's free tier routinely lags the real final whistle:
  -- it keeps reporting an in-play status (commonly '2H') for up to ~1h after a match has
  -- actually ended, so reconciliation above — which faithfully mirrors the source — leaves
  -- the row 'live' the whole time (seen 2026-06-18: Czechia vs South Africa stuck '2H' ~1h
  -- after FT). The net finalizes such rows with their last-known score so bets get scored.
  --
  -- Threshold is PHASE-AWARE so we cut the visible lag for the common case without ever
  -- finalizing a genuinely-running knockout match:
  --   * Regulation phases (1H/2H/HT/LIVE/INPLAY/unknown) cannot legitimately run beyond
  --     ~2h past kickoff (90' + generous stoppage + 15' halftime ≈ 2h). Finalize at 2.5h.
  --   * Extra time / penalties (ET/BT/P/PEN/PEN LIVE) can push a knockout to ~3h, so they
  --     keep the conservative 3.5h window.
  -- A genuine late FT from the API is applied by reconciliation first and takes the row out
  -- of 'live' before this runs. Finalizing fires trg_score_match (guarded), so it scores once.
  update public.matches m
  set status = 'finished',
      phase  = 'FT',
      minute = null
  where m.status = 'live'
    and m.home_score is not null
    and m.away_score is not null
    and (
      case
        when coalesce(upper(m.phase), '') in ('ET','BT','P','PEN','PEN LIVE','AET')
          then m.start_time < now() - interval '3.5 hours'
        else m.start_time < now() - interval '2.5 hours'
      end
    );

  -- Post-finalization score correction. A match finalized while the source still lagged the
  -- real result — the time net force-finalizing with the last-known live score, or the API
  -- briefly publishing FT with a wrong/partial score and correcting it later — is otherwise
  -- frozen forever, because every reconciliation loop above skips 'finished' rows (seen
  -- 2026-06-22: France vs Iraq id 53 stuck 1-0 while the authoritative event reported the true
  -- FT 3-0). Re-read each recently-finished match's event once and, if the API now reports a
  -- different concrete score (or penalty result), apply it and re-score the bets. The
  -- score_match trigger is a no-op for a finished->finished update, so the re-scoring and the
  -- leaderboard refresh are done explicitly via score_bets_for_match(). Bounded to an 8h-from-
  -- kickoff window so steady state is only a few calls per run.
  for rec in
    select id, provider_event_id
    from public.matches
    where provider_event_id is not null
      and status = 'finished'
      and start_time between now() - interval '8 hours' and now()
  loop
    begin
      select (extensions.http_get(
        'https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=' || rec.provider_event_id
      )).content::jsonb -> 'events' -> 0
      into v_event;
    exception when others then
      continue;
    end;

    if v_event is null then
      continue;
    end if;

    v_status := upper(coalesce(v_event->>'strStatus',''));

    if v_status in ('FT','AET','AP','MATCH FINISHED','FINISHED','1H','2H','HT','ET','BT','P','PEN','PEN LIVE','LIVE','INPLAY')
       and nullif(v_event->>'intHomeScore','') is not null
       and nullif(v_event->>'intAwayScore','') is not null
    then
      update public.matches m
      set home_score     = (v_event->>'intHomeScore')::smallint,
          away_score     = (v_event->>'intAwayScore')::smallint,
          home_penalties = coalesce(nullif(v_event->>'intHomeScoreExtra','')::smallint, m.home_penalties),
          away_penalties = coalesce(nullif(v_event->>'intAwayScoreExtra','')::smallint, m.away_penalties)
      where m.id = rec.id
        and (
          m.home_score is distinct from (v_event->>'intHomeScore')::smallint
          or m.away_score is distinct from (v_event->>'intAwayScore')::smallint
          or m.home_penalties is distinct from coalesce(nullif(v_event->>'intHomeScoreExtra','')::smallint, m.home_penalties)
          or m.away_penalties is distinct from coalesce(nullif(v_event->>'intAwayScoreExtra','')::smallint, m.away_penalties)
        );

      if found then
        perform public.score_bets_for_match(rec.id);
      end if;
    end if;
  end loop;

  -- Goals: fetch the event timeline for in-play matches and newly-finished ones.
  for rec in
    select id, provider_event_id
    from public.matches
    where provider_event_id is not null
      and (status = 'live' or (status = 'finished' and goals is null))
  loop
    begin
      select (extensions.http_get(
        'https://www.thesportsdb.com/api/v1/json/3/lookuptimeline.php?id=' || rec.provider_event_id
      )).content::jsonb into v_timeline;
    exception when others then
      continue;
    end;

    if v_timeline is null or jsonb_typeof(v_timeline->'timeline') is distinct from 'array' then
      continue;
    end if;

    update public.matches m
    set goals = coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'minute', t->>'intTime',
          'player', t->>'strPlayer',
          'assist', nullif(t->>'strAssist',''),
          'team',   case when t->>'strHome' = 'Yes' then 'home' else 'away' end
        )
        order by nullif(substring(coalesce(t->>'intTime','') from '^[0-9]+'), '')::int nulls last
      )
      from jsonb_array_elements(v_timeline->'timeline') t
      where lower(coalesce(t->>'strTimeline','')) like '%goal%'
        and coalesce(t->>'strPlayer','') <> ''
    ), '[]'::jsonb)
    where m.id = rec.id;
  end loop;

  return v_updated;
end;
$function$;

commit;

-- Backfill note: existing finished matches keep home_penalties/away_penalties =
-- NULL (all current fixtures are group-stage, which never go to penalties). The
-- post-finalization correction loop will populate penalties for any knockout that
-- finished within the last 8h on its next run; older knockouts (none yet) would
-- need a one-off re-read or a manual UPDATE of home_penalties/away_penalties
-- followed by `select public.score_bets_for_match(<id>);`.

create extension if not exists pgcrypto;

create table if not exists public.championships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season_year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blind_structures (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blind_levels (
  id uuid primary key default gen_random_uuid(),
  blind_structure_id uuid not null references public.blind_structures(id) on delete cascade,
  level_number integer not null,
  small_blind integer not null,
  big_blind integer not null,
  duration_minutes integer not null,
  ante integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  title text not null,
  stage_date date not null,
  blind_structure_id uuid references public.blind_structures(id),
  status text not null check (status in ('scheduled', 'active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stage_player_status (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  paid_annual boolean not null default false,
  paid_daily boolean not null default false,
  left_stage_early boolean not null default false,
  is_active_for_stage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage_id, player_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id) on delete cascade,
  match_number integer not null,
  status text not null check (status in ('pending', 'active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage_id, match_number)
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  final_position integer,
  day_points_awarded integer not null default 0,
  elimination_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(match_id, player_id)
);

create table if not exists public.annual_points_history (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  annual_points_awarded integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.chip_sets (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chip_set_items (
  id uuid primary key default gen_random_uuid(),
  chip_set_id uuid not null references public.chip_sets(id) on delete cascade,
  chip_value integer not null,
  chip_color text not null,
  chip_quantity integer not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  points_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stage_live_runtime (
  stage_id uuid primary key references public.stages(id) on delete cascade,
  current_level_index integer not null default 0,
  current_blind_label text,
  current_match_number integer not null default 1,
  current_match_started_at timestamptz,
  current_match_closed boolean not null default false,
  stage_closed boolean not null default false,
  seat_assignments jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_stream_sessions (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id) on delete cascade,
  stage_title text not null,
  stage_date_label text,
  match_label text,
  blind_label text,
  status text not null check (status in ('running', 'paused', 'finished')),
  started_at timestamptz not null,
  ended_at timestamptz,
  seat_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_stream_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_stream_sessions(id) on delete cascade,
  stage_id uuid not null references public.stages(id) on delete cascade,
  title text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  line_count integer not null default 0,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_stream_hand_clips (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.live_stream_sessions(id) on delete set null,
  stage_id uuid references public.stages(id) on delete set null,
  title text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null,
  match_label text,
  blind_label text,
  start_trigger text,
  end_trigger text,
  transcript_log jsonb not null default '[]'::jsonb,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_stream_sessions_stage_id
  on public.live_stream_sessions(stage_id);

create index if not exists idx_live_stream_transcripts_stage_id
  on public.live_stream_transcripts(stage_id);

create index if not exists idx_live_stream_hand_clips_stage_id
  on public.live_stream_hand_clips(stage_id);

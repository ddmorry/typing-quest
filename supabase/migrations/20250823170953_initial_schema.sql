-- Initial schema for Typing RPG Game
-- Based on PRD section 8: Data Model

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- profiles table
-- User profiles linked to auth.users
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- word_packs table  
-- Selectable word sets (NGSL, TOEIC, etc.)
create table if not exists public.word_packs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  lang text not null default 'en',
  level_min int2 default 1 check (level_min between 1 and 5),
  level_max int2 default 5 check (level_max between 1 and 5),
  tags text[] default '{}',
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure level_min <= level_max
  constraint word_packs_level_range_check check (level_min <= level_max)
);

-- words table
-- Individual words with difficulty levels L1-L5
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.word_packs(id) on delete cascade,
  text text not null,
  level int2 not null check (level between 1 and 5),
  length int2 generated always as (char_length(text)) stored,
  pronunciation text, -- Optional phonetic transcription
  meaning text, -- Optional meaning/definition
  created_at timestamptz default now(),
  
  -- Ensure uniqueness within a pack
  unique(pack_id, text)
);

-- sessions table
-- Game play sessions with stats
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id), -- null for guest sessions
  pack_id uuid not null references public.word_packs(id),
  difficulty text not null check (difficulty in ('EASY','NORMAL','HARD')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_sec int2,
  result text check (result in ('WIN','LOSE','ABORT')),
  -- JSON stats: {wpm,acc,comboMax,atkCount,healCount,guardRate,damage,damageTaken}
  stats jsonb default '{}',
  -- Session configuration snapshot
  settings jsonb default '{}',
  created_at timestamptz default now(),
  
  -- Constraints for data integrity  
  constraint sessions_duration_positive check (duration_sec is null or duration_sec > 0),
  constraint sessions_ended_after_started check (ended_at is null or ended_at >= started_at)
);

-- attempts table
-- Individual word typing attempts with metrics
create table if not exists public.attempts (
  id bigserial primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null check (type in ('ATTACK','HEAL','GUARD')),
  word_id uuid not null references public.words(id),
  target_text text not null,
  ms int not null check (ms > 0), -- Input time in milliseconds
  errors int not null default 0 check (errors >= 0),
  -- WPM calculation: (characters / 5) / (milliseconds / 60000)
  wpm numeric(6,2) generated always as (
    case 
      when ms > 0 then (char_length(target_text)::numeric / 5) / (ms::numeric / 60000)
      else 0 
    end
  ) stored,
  accuracy numeric(5,4) not null default 1.0 check (accuracy >= 0 and accuracy <= 1),
  score int not null default 0,
  combo int not null default 0 check (combo >= 0),
  created_at timestamptz default now()
);

-- Create indexes for performance
create index if not exists idx_words_pack_id on public.words(pack_id);
create index if not exists idx_words_pack_level on public.words(pack_id, level);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_created_at on public.sessions(created_at desc);
create index if not exists idx_attempts_session_id on public.attempts(session_id);
create index if not exists idx_attempts_word_id on public.attempts(word_id);
create index if not exists idx_attempts_created_at on public.attempts(created_at desc);

-- session_summary view
-- Aggregated session statistics
create or replace view public.session_summary as
select 
  s.id as session_id,
  s.user_id,
  s.pack_id,
  wp.title as pack_title,
  s.difficulty,
  s.started_at,
  s.ended_at,
  s.duration_sec,
  s.result,
  -- Use stats JSON if available, otherwise calculate from attempts
  coalesce((s.stats->>'wpm')::numeric, avg(a.wpm)) as avg_wpm,
  coalesce((s.stats->>'acc')::numeric, avg(a.accuracy)) as avg_acc,
  coalesce((s.stats->>'comboMax')::int, max(a.combo)) as max_combo,
  -- Calculated metrics from attempts
  sum(case when a.type = 'ATTACK' then a.score else 0 end) as total_damage,
  sum(case when a.type = 'HEAL' then a.score else 0 end) as total_healing,
  count(*) filter (where a.type = 'ATTACK') as attack_count,
  count(*) filter (where a.type = 'HEAL') as heal_count,
  count(*) filter (where a.type = 'GUARD') as guard_count,
  count(*) as total_attempts,
  avg(a.ms) as avg_time_ms
from public.sessions s
left join public.attempts a on a.session_id = s.id
left join public.word_packs wp on wp.id = s.pack_id
group by s.id, wp.title;

-- Enable Row Level Security (RLS)
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.profiles enable row level security;

-- RLS Policies

-- Profiles: Users can only access their own profile
create policy "profiles_select_own" on public.profiles for select
  using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert
  with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sessions: Users can access their own sessions + guest sessions (user_id is null)
-- For guests: user_id is null, allowing anonymous play
create policy "sessions_select_own" on public.sessions for select
  using (auth.uid() = user_id or user_id is null);
create policy "sessions_insert_own" on public.sessions for insert
  with check (auth.uid() = user_id or user_id is null);
create policy "sessions_update_own" on public.sessions for update
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

-- Attempts: Users can access attempts for sessions they own
create policy "attempts_select_via_session" on public.attempts for select
  using (
    exists (
      select 1 from public.sessions s 
      where s.id = session_id 
      and (s.user_id = auth.uid() or s.user_id is null)
    )
  );
create policy "attempts_insert_via_session" on public.attempts for insert
  with check (
    exists (
      select 1 from public.sessions s 
      where s.id = session_id 
      and (s.user_id = auth.uid() or s.user_id is null)
    )
  );
create policy "attempts_update_via_session" on public.attempts for update
  using (
    exists (
      select 1 from public.sessions s 
      where s.id = session_id 
      and (s.user_id = auth.uid() or s.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.sessions s 
      where s.id = session_id 
      and (s.user_id = auth.uid() or s.user_id is null)
    )
  );

-- Word packs and words: Public read access (no RLS needed for read)
-- These tables contain public educational content
-- Future: Could add policies for user-created packs

-- Create triggers for updated_at timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger handle_word_packs_updated_at
  before update on public.word_packs  
  for each row execute function public.handle_updated_at();

-- Comments for documentation
comment on table public.profiles is 'User profiles linked to auth.users';
comment on table public.word_packs is 'Selectable word sets (NGSL, TOEIC, etc.)';
comment on table public.words is 'Individual words with difficulty levels L1-L5';
comment on table public.sessions is 'Game play sessions with stats and settings';
comment on table public.attempts is 'Individual word typing attempts with metrics';
comment on view public.session_summary is 'Aggregated session statistics for dashboard';

-- Grant permissions for authenticated users
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant select on all tables in schema public to anon;
grant select on public.session_summary to authenticated, anon;
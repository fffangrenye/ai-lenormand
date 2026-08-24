-- Deep Reading Phase 1: readings + reading_cards
-- DATABASE.md is currently empty in the provided docs, so this migration follows
-- PROJECT_SPEC.md / DEEP_READING_SPEC.md field requirements conservatively.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'deep',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  spread_type text not null check (spread_type in ('three_card', 'five_card_linear')),
  status text not null default 'drawing' check (status in ('drawing', 'generating', 'completed', 'failed')),
  core_conclusion text,
  interpretation text,
  time_window text,
  uncertainty text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.reading_cards (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.readings(id) on delete cascade,
  card_number integer not null,
  card_slug text not null,
  position text not null,
  created_at timestamptz not null default now(),
  unique (reading_id, card_number),
  unique (reading_id, card_slug)
);

create index if not exists readings_project_created_idx
  on public.readings(project_id, created_at);

create index if not exists reading_cards_reading_number_idx
  on public.reading_cards(reading_id, card_number);

alter table public.readings enable row level security;
alter table public.reading_cards enable row level security;

create policy "Users can read own readings"
  on public.readings for select
  using (auth.uid() = user_id);

create policy "Users can insert own readings"
  on public.readings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own readings"
  on public.readings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own readings"
  on public.readings for delete
  using (auth.uid() = user_id);

create policy "Users can read own reading cards"
  on public.reading_cards for select
  using (
    exists (
      select 1 from public.readings
      where readings.id = reading_cards.reading_id
      and readings.user_id = auth.uid()
    )
  );

create policy "Users can insert own reading cards"
  on public.reading_cards for insert
  with check (
    exists (
      select 1 from public.readings
      where readings.id = reading_cards.reading_id
      and readings.user_id = auth.uid()
    )
  );

create policy "Users can delete own reading cards"
  on public.reading_cards for delete
  using (
    exists (
      select 1 from public.readings
      where readings.id = reading_cards.reading_id
      and readings.user_id = auth.uid()
    )
  );

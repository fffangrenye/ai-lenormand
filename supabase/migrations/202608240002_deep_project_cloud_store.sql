create table if not exists public.deep_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  background text not null default '',
  memory_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now()
);

create table if not exists public.deep_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.deep_projects(id) on delete cascade,
  question text not null,
  spread_type text not null check (spread_type in ('three_card', 'five_card_linear')),
  status text not null default 'drawing' check (status in ('drawing', 'generating', 'completed', 'failed', 'quota_limited')),
  core_conclusion text not null default '',
  interpretation text not null default '',
  time_window text,
  uncertainty text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.deep_reading_cards (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.deep_readings(id) on delete cascade,
  card_number integer not null,
  card_slug text not null,
  position text not null,
  name_en text not null,
  name_zh text not null,
  created_at timestamptz not null default now(),
  unique (reading_id, card_number),
  unique (reading_id, card_slug)
);

create table if not exists public.deep_follow_up_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.deep_projects(id) on delete cascade,
  reading_id uuid not null references public.deep_readings(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists deep_projects_user_opened_idx
  on public.deep_projects(user_id, last_opened_at desc);

create index if not exists deep_readings_project_created_idx
  on public.deep_readings(project_id, created_at desc);

create index if not exists deep_reading_cards_reading_number_idx
  on public.deep_reading_cards(reading_id, card_number);

create index if not exists deep_follow_up_messages_reading_created_idx
  on public.deep_follow_up_messages(reading_id, created_at);

alter table public.deep_projects enable row level security;
alter table public.deep_readings enable row level security;
alter table public.deep_reading_cards enable row level security;
alter table public.deep_follow_up_messages enable row level security;

create policy "Users can manage own deep projects"
  on public.deep_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own deep readings"
  on public.deep_readings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own deep reading cards"
  on public.deep_reading_cards for all
  using (
    exists (
      select 1 from public.deep_readings
      where deep_readings.id = deep_reading_cards.reading_id
      and deep_readings.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.deep_readings
      where deep_readings.id = deep_reading_cards.reading_id
      and deep_readings.user_id = auth.uid()
    )
  );

create policy "Users can manage own deep follow-up messages"
  on public.deep_follow_up_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

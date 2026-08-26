create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists user_profiles_last_seen_idx
  on public.user_profiles(last_seen_at desc);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

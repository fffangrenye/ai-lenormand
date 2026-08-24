create table if not exists public.daily_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  deep_reading_used integer not null default 0 check (deep_reading_used >= 0),
  follow_up_used integer not null default 0 check (follow_up_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.daily_ai_usage enable row level security;

create policy "Users can read own daily AI usage"
  on public.daily_ai_usage for select
  using (auth.uid() = user_id);

create or replace function public.reserve_daily_ai_quota(
  p_user_id uuid,
  p_date_key text,
  p_kind text,
  p_limit integer
)
returns table (allowed boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_used integer;
begin
  if p_kind not in ('deep_reading', 'follow_up') then
    raise exception 'Invalid quota kind: %', p_kind;
  end if;

  insert into public.daily_ai_usage (user_id, date_key)
  values (p_user_id, p_date_key)
  on conflict (user_id, date_key) do nothing;

  if p_kind = 'deep_reading' then
    update public.daily_ai_usage
    set deep_reading_used = deep_reading_used + 1,
        updated_at = now()
    where user_id = p_user_id
      and date_key = p_date_key
      and deep_reading_used < p_limit
    returning deep_reading_used into current_used;
  else
    update public.daily_ai_usage
    set follow_up_used = follow_up_used + 1,
        updated_at = now()
    where user_id = p_user_id
      and date_key = p_date_key
      and follow_up_used < p_limit
    returning follow_up_used into current_used;
  end if;

  if current_used is null then
    select case when p_kind = 'deep_reading' then deep_reading_used else follow_up_used end
    into current_used
    from public.daily_ai_usage
    where user_id = p_user_id and date_key = p_date_key;

    return query select false, current_used, greatest(p_limit - current_used, 0);
    return;
  end if;

  return query select true, current_used, greatest(p_limit - current_used, 0);
end;
$$;

revoke all on function public.reserve_daily_ai_quota(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_daily_ai_quota(uuid, text, text, integer) to service_role;

create or replace function public.refund_daily_ai_quota(
  p_user_id uuid,
  p_date_key text,
  p_kind text
)
returns table (allowed boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_used integer;
begin
  if p_kind not in ('deep_reading', 'follow_up') then
    raise exception 'Invalid quota kind: %', p_kind;
  end if;

  insert into public.daily_ai_usage (user_id, date_key)
  values (p_user_id, p_date_key)
  on conflict (user_id, date_key) do nothing;

  if p_kind = 'deep_reading' then
    update public.daily_ai_usage
    set deep_reading_used = greatest(deep_reading_used - 1, 0),
        updated_at = now()
    where user_id = p_user_id and date_key = p_date_key
    returning deep_reading_used into current_used;
  else
    update public.daily_ai_usage
    set follow_up_used = greatest(follow_up_used - 1, 0),
        updated_at = now()
    where user_id = p_user_id and date_key = p_date_key
    returning follow_up_used into current_used;
  end if;

  return query select true, current_used, 0;
end;
$$;

revoke all on function public.refund_daily_ai_quota(uuid, text, text) from public, anon, authenticated;
grant execute on function public.refund_daily_ai_quota(uuid, text, text) to service_role;

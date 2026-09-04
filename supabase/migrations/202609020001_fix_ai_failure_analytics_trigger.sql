create or replace function public.analytics_capture_reading_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latency_ms bigint;
begin
  if new.completed_at is not null and old.completed_at is null then
    v_latency_ms := greatest(0, (extract(epoch from (new.completed_at - new.created_at)) * 1000)::bigint);

    if not exists (
      select 1
      from public.analytics_events
      where event_name = 'ai_completed'
        and reading_id = new.id
    ) then
      insert into public.analytics_events(user_id, event_name, reading_id, spread_type, properties, created_at)
      values(
        new.user_id,
        'ai_completed',
        new.id,
        new.spread_type,
        jsonb_build_object('source', 'db_trigger', 'latency_ms', v_latency_ms, 'status', new.status),
        new.completed_at
      );
    end if;
  elsif new.status is distinct from old.status and new.status = 'quota_limited' then
    if not exists (
      select 1
      from public.analytics_events
      where event_name = 'quota_exceeded'
        and reading_id = new.id
        and properties->>'source' = 'db_trigger'
    ) then
      insert into public.analytics_events(user_id, event_name, reading_id, spread_type, properties, created_at)
      values(
        new.user_id,
        'quota_exceeded',
        new.id,
        new.spread_type,
        jsonb_build_object('source', 'db_trigger', 'kind', 'deep_reading', 'status', new.status),
        now()
      );
    end if;
  elsif new.status is distinct from old.status and new.status = 'failed' then
    if not exists (
      select 1
      from public.analytics_events
      where event_name = 'reading_generation_failed'
        and reading_id = new.id
        and properties->>'source' = 'db_trigger'
    ) then
      insert into public.analytics_events(user_id, event_name, reading_id, spread_type, properties, created_at)
      values(
        new.user_id,
        'reading_generation_failed',
        new.id,
        new.spread_type,
        jsonb_build_object('source', 'db_trigger', 'failure_reason', coalesce(new.failure_reason, 'failed'), 'status', new.status),
        now()
      );
    end if;
  end if;

  return new;
end;
$$;

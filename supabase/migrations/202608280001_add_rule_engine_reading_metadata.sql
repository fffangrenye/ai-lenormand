alter table public.deep_readings
  add column if not exists interpretation_source text,
  add column if not exists rule_engine_version text,
  add column if not exists rule_engine_schema_version text,
  add column if not exists rule_engine_result jsonb,
  add column if not exists generation_error_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deep_readings_interpretation_source_check'
      and conrelid = 'public.deep_readings'::regclass
  ) then
    alter table public.deep_readings
      add constraint deep_readings_interpretation_source_check
      check (interpretation_source is null or interpretation_source in ('ai', 'rule_engine'));
  end if;
end;
$$;

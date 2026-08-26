alter table public.deep_readings
  add column if not exists failure_reason text;

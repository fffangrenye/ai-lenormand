create index if not exists analytics_events_properties_host_created_idx
  on public.analytics_events ((properties ->> 'host'), created_at desc);

create index if not exists analytics_events_properties_site_created_idx
  on public.analytics_events ((properties ->> 'site'), created_at desc);

create index if not exists analytics_events_event_name_host_created_idx
  on public.analytics_events (event_name, (properties ->> 'host'), created_at desc);

create index if not exists analytics_events_channel_created_idx
  on public.analytics_events (channel, created_at desc);

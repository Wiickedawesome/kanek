-- Enable pg_cron extension (already enabled on hosted Supabase)
create extension if not exists pg_cron with schema pg_catalog;

-- Grant usage to postgres role
grant usage on schema cron to postgres;

-- Schedule expire-posts: every 15 minutes
-- Calls the edge function via pg_net to expire posts past their departure time
select cron.schedule(
  'expire-posts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/expire-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule check-route-activation: every 5 minutes
-- Activates route posts when departure time is approaching
select cron.schedule(
  'check-route-activation',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-route-activation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

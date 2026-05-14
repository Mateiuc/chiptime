create table public.rate_limit_buckets (
  bucket_key text not null,
  ip text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket_key, ip, window_start)
);
create index rate_limit_buckets_window_start_idx on public.rate_limit_buckets (window_start);
alter table public.rate_limit_buckets enable row level security;
-- No policies — only the SECURITY DEFINER function below touches this table.

create or replace function public.consume_rate_limit(
  _key text,
  _ip text,
  _window_sec int,
  _max int
) returns table(allowed boolean, retry_after int)
language plpgsql
security definer
set search_path = public
as $$
declare
  _epoch int := extract(epoch from now())::int;
  _ws timestamptz := to_timestamp(_epoch - (_epoch % _window_sec));
  _count int;
begin
  insert into public.rate_limit_buckets(bucket_key, ip, window_start, count)
    values (_key, _ip, _ws, 1)
    on conflict (bucket_key, ip, window_start)
    do update set count = rate_limit_buckets.count + 1
    returning count into _count;

  -- Opportunistic GC: prune anything older than 1 hour. Cheap because
  -- the window_start index makes the range delete fast.
  delete from public.rate_limit_buckets where window_start < now() - interval '1 hour';

  if _count > _max then
    return query select false, greatest(1, (_window_sec - extract(epoch from (now() - _ws))::int)::int);
  else
    return query select true, 0;
  end if;
end$$;
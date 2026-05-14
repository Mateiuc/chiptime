revoke execute on function public.consume_rate_limit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, int, int) to service_role;
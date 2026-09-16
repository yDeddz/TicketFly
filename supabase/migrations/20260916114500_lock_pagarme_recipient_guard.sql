-- Trigger-only function: callers must not invoke it through the Data API.
revoke execute on function public.organizers_sanitize_self_write()
  from public, anon, authenticated;

-- The automatic-RLS event trigger is internal database infrastructure.
-- It does not need callable API permissions for browser roles.
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
 end if;
end $$;

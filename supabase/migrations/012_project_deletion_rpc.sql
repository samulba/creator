-- Repair: allow a user to soft-delete their own project.
--
-- The `projects_select_own_not_deleted` policy filters `deleted_at is null`.
-- PostgreSQL applies a table's SELECT policy as an implicit check on the row
-- produced by an UPDATE, so an authenticated UPDATE that sets `deleted_at`
-- makes the new row fail the SELECT policy and is rejected with
-- "new row violates row-level security policy". Archiving works (it does not
-- touch deleted_at); deletion did not.
--
-- Fix: a SECURITY DEFINER function performs the soft delete (bypassing RLS)
-- while enforcing ownership itself (user_id = auth.uid()). This mirrors how the
-- job-queue RPCs are structured. Purely additive.

create or replace function public.request_project_deletion(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.projects
    set delete_requested_at = now(),
        deleted_at = now()
    where id = p_project_id
      and user_id = auth.uid()
      and deleted_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.request_project_deletion(uuid) from public;
grant execute on function public.request_project_deletion(uuid) to authenticated;

comment on function public.request_project_deletion(uuid) is
  'Owner-scoped soft delete for a project. SECURITY DEFINER so the soft delete is not blocked by the deleted_at SELECT policy; ownership is enforced inside via auth.uid().';

-- 015_output_approval.sql
--
-- User approval of the finished video (Phase 10 wrap-up). output_versions is
-- read-only for users (the worker owns writes), so approval goes through a
-- SECURITY DEFINER RPC that enforces ownership itself: it approves the
-- project's current, QC-passed output version and moves the project to
-- 'approved'.

create or replace function public.approve_current_output(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_output public.output_versions;
begin
  -- Ownership + liveness. auth.uid() is null for service calls; reject.
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.projects
    where id = p_project_id
      and user_id = auth.uid()
      and deleted_at is null
      and archived_at is null
  ) then
    return false;
  end if;

  select * into v_output
  from public.output_versions
  where project_id = p_project_id
    and is_current
    and status = 'rendered'
    and qc_status = 'passed'
  for update;

  if not found then
    return false;
  end if;

  -- One approved version per project (partial unique index): clear first.
  update public.output_versions
  set is_approved = false, approved_by = null, approved_at = null
  where project_id = p_project_id
    and is_approved
    and id <> v_output.id;

  update public.output_versions
  set is_approved = true,
      approved_by = auth.uid(),
      approved_at = now()
  where id = v_output.id;

  update public.projects
  set pipeline_state = 'approved'
  where id = p_project_id;

  return true;
end;
$$;

revoke all on function public.approve_current_output(uuid) from public, anon;
grant execute on function public.approve_current_output(uuid) to authenticated;

-- NOT YET APPLIED: needs approval because it removes a teacher-student link.
-- Run in Supabase -> SQL Editor to let admins move a student to another teacher.
create or replace function public.admin_unassign(student uuid, teacher uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  delete from public.links where teacher_id = teacher and student_id = student;
  update public.teacher_requests set status = 'waiting', teacher_id = null, assigned_at = null where student_id = student and teacher_id = teacher;
end; $$;

grant execute on function public.admin_unassign(uuid, uuid) to authenticated;

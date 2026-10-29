-- Security hardening (from the 29 Oct 2026 review). Safe to run more than once; deletes no data.
-- Applied to the live project on 29 Oct 2026 (as security_hardening_alter_policies + join_teacher_rate_limit,
-- using ALTER POLICY on the existing policy names).

-- 1. Calls: only the teacher updates a call (start/end); portions must be page numbers.
drop policy if exists "calls: either side updates" on public.calls;
drop policy if exists "calls: teacher updates" on public.calls;
create policy "calls: teacher updates" on public.calls for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()) and private.is_teacher_of(student_id));

create or replace function private.valid_portions(p jsonb) returns boolean
language sql immutable set search_path to '' as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) between 1 and 40
     and not exists (
       select 1 from jsonb_array_elements(p) e
       where jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e->'page') <> 'number'
          or (e->>'page')::numeric <> floor((e->>'page')::numeric)
          or (e->>'page')::numeric not between 1 and 604
          or coalesce(e->>'part', 'all') not in ('all', '1/2', '2/2')
     );
$$;
alter table public.calls drop constraint if exists calls_portions_shape;
alter table public.calls add constraint calls_portions_shape check (private.valid_portions(portions)) not valid;
alter table public.calls drop constraint if exists calls_status_known;
alter table public.calls add constraint calls_status_known check (status in ('ringing', 'active', 'ended', 'missed', 'declined')) not valid;

-- 2. Sessions: safe ids; a student writes only their own practice, a teacher only their own sessions.
alter table public.sessions drop constraint if exists sessions_id_shape;
alter table public.sessions add constraint sessions_id_shape check (id ~ '^[A-Za-z0-9_-]{6,40}$') not valid;
alter table public.sessions drop constraint if exists sessions_kind_known;
alter table public.sessions add constraint sessions_kind_known check (kind in ('practice', 'teacher', 'online')) not valid;

drop policy if exists "sessions: insert" on public.sessions;
create policy "sessions: insert" on public.sessions for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and (
      (kind = 'practice' and teacher_id is null and student_id = (select auth.uid()))
      or (kind <> 'practice' and teacher_id = (select auth.uid()) and (student_id is null or private.is_teacher_of(student_id)))
    )
  );
drop policy if exists "sessions: owner updates" on public.sessions;
create policy "sessions: owner updates" on public.sessions for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid()) and (
      (kind = 'practice' and teacher_id is null and student_id = (select auth.uid()))
      or (kind <> 'practice' and teacher_id = (select auth.uid()) and (student_id is null or private.is_teacher_of(student_id)))
    )
  );
-- A teacher sees a linked student's practice and their own sessions, not another teacher's grades.
drop policy if exists "sessions: read" on public.sessions;
create policy "sessions: read" on public.sessions for select to authenticated
  using (
    owner_id = (select auth.uid()) or student_id = (select auth.uid()) or teacher_id = (select auth.uid())
    or (private.is_teacher_of(student_id) and teacher_id is null)
  );

-- 3. Recordings: each person writes only in their own folder; reading follows the session row.
drop policy if exists "recordings: upload" on storage.objects;
drop policy if exists "recordings: replace" on storage.objects;
drop policy if exists "recordings: delete" on storage.objects;
drop policy if exists "recordings: read" on storage.objects;
create policy "recordings: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "recordings: replace" on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "recordings: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "recordings: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.sessions s where s.audio_path = storage.objects.name)
    )
  );

-- 4. Class codes: limit guessing (20 tries per hour per account).
create table if not exists private.join_attempts (user_id uuid not null, at timestamptz not null default now());
create index if not exists join_attempts_user_at on private.join_attempts (user_id, at);
create or replace function public.join_teacher(code text)
 returns table(teacher_id uuid, teacher_name text)
 language plpgsql security definer set search_path to ''
as $function$
declare t public.profiles; tries int;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  delete from private.join_attempts where at < now() - interval '1 day';
  select count(*) into tries from private.join_attempts a where a.user_id = (select auth.uid()) and a.at > now() - interval '1 hour';
  if tries >= 20 then raise exception 'Too many tries. Please wait an hour and ask your teacher for the code again.'; end if;
  insert into private.join_attempts (user_id) values ((select auth.uid()));
  select * into t from public.profiles p where p.invite_code = upper(trim(code)) and p.role = 'teacher';
  if t.id is null then raise exception 'No teacher has this code'; end if;
  if t.id = (select auth.uid()) then raise exception 'This is your own code'; end if;
  insert into public.links (teacher_id, student_id) values (t.id, (select auth.uid())) on conflict do nothing;
  return query select t.id, t.name;
end;
$function$;

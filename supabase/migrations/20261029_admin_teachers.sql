-- Admin panel: teacher applications, approved teacher profiles, and students waiting for a teacher.
-- Applied to the live project on 29 Oct 2026 (as admin_tables + admin_functions).

-- Admins are named by their Google account email (verified by Google sign-in).
create table if not exists private.admin_emails (email text primary key);
insert into private.admin_emails (email) values ('afzal5555@gmail.com') on conflict do nothing;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from private.admin_emails a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path to '' as $$ select private.is_admin(); $$;

-- Teacher applications (anyone signed in can apply, from anywhere).
create table if not exists public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  country text not null default '' check (char_length(country) <= 60),
  gender text not null check (gender in ('male', 'female')),
  languages text[] not null check (array_length(languages, 1) between 1 and 8),
  years_experience int not null check (years_experience between 0 and 70),
  ijazah text not null default '' check (char_length(ijazah) <= 400),
  qualifications text not null default '' check (char_length(qualifications) <= 600),
  teaches text[] not null default '{}',
  bio text not null default '' check (char_length(bio) <= 1200),
  availability text not null default '' check (char_length(availability) <= 400),
  hours_per_week int not null default 5 check (hours_per_week between 1 and 80),
  phone text not null default '' check (char_length(phone) <= 30),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create unique index if not exists teacher_applications_one_per_user on public.teacher_applications (user_id);
alter table public.teacher_applications enable row level security;

create policy "applications: apply" on public.teacher_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and admin_note = '' and reviewed_at is null);
create policy "applications: edit while pending" on public.teacher_applications for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null);
create policy "applications: read own or admin" on public.teacher_applications for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

-- Approved teachers: the profile card students and parents see.
create table if not exists public.teacher_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  country text not null default '',
  gender text not null check (gender in ('male', 'female')),
  languages text[] not null,
  years_experience int not null default 0,
  ijazah text not null default '',
  qualifications text not null default '',
  teaches text[] not null default '{}',
  bio text not null default '',
  availability text not null default '',
  capacity int not null default 10 check (capacity between 0 and 200),
  accepting boolean not null default true,
  approved_at timestamptz not null default now()
);
alter table public.teacher_profiles enable row level security;
create policy "teacher profiles: signed-in read" on public.teacher_profiles for select to authenticated using (true);
create policy "teacher profiles: teacher pauses" on public.teacher_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Teachers may only change "accepting" and their bio/availability themselves; the rest is set by an admin.
create or replace function private.guard_teacher_profile() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if private.is_admin() then return new; end if;
  new.user_id := old.user_id; new.name := old.name; new.gender := old.gender; new.languages := old.languages;
  new.years_experience := old.years_experience; new.ijazah := old.ijazah; new.qualifications := old.qualifications;
  new.capacity := old.capacity; new.approved_at := old.approved_at; new.country := old.country; new.teaches := old.teaches;
  new.bio := left(new.bio, 1200); new.availability := left(new.availability, 400);
  return new;
end; $$;
create trigger guard_teacher_profile before update on public.teacher_profiles for each row execute function private.guard_teacher_profile();

-- Students asking the academy for a teacher.
create table if not exists public.teacher_requests (
  student_id uuid primary key references auth.users (id) on delete cascade,
  student_name text not null default '' check (char_length(student_name) <= 80),
  languages text[] not null check (array_length(languages, 1) between 1 and 6),
  teacher_gender text not null default 'any' check (teacher_gender in ('any', 'male', 'female')),
  age_group text not null default 'adult' check (age_group in ('child', 'teen', 'adult')),
  level text not null default '' check (char_length(level) <= 80),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'waiting' check (status in ('waiting', 'assigned', 'cancelled')),
  teacher_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  assigned_at timestamptz
);
alter table public.teacher_requests enable row level security;
create policy "requests: student asks" on public.teacher_requests for insert to authenticated
  with check (student_id = (select auth.uid()) and status = 'waiting' and teacher_id is null);
create policy "requests: student edits while waiting" on public.teacher_requests for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) and status in ('waiting', 'cancelled') and teacher_id is null);
create policy "requests: read" on public.teacher_requests for select to authenticated
  using (student_id = (select auth.uid()) or teacher_id = (select auth.uid()) or private.is_admin());

-- Admins can read every profile (to see who applied and who is waiting).
create policy "profiles: admin reads" on public.profiles for select to authenticated using (private.is_admin());
create policy "links: admin reads" on public.links for select to authenticated using (private.is_admin());

-- Admin actions.
create or replace function public.admin_review_application(app_id uuid, decision text, note text default '', cap int default 10)
returns void language plpgsql security definer set search_path to '' as $$
declare a public.teacher_applications;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if decision not in ('approved', 'declined', 'pending') then raise exception 'Unknown decision'; end if;
  select * into a from public.teacher_applications where id = app_id;
  if a.id is null then raise exception 'Application not found'; end if;
  update public.teacher_applications set status = decision, admin_note = left(coalesce(note, ''), 600),
    reviewed_at = now(), reviewed_by = (select auth.uid()), updated_at = now() where id = app_id;
  if decision = 'approved' then
    insert into public.teacher_profiles (user_id, name, country, gender, languages, years_experience, ijazah, qualifications, teaches, bio, availability, capacity)
    values (a.user_id, a.name, a.country, a.gender, a.languages, a.years_experience, a.ijazah, a.qualifications, a.teaches, a.bio, a.availability, greatest(0, least(200, coalesce(cap, 10))))
    on conflict (user_id) do update set name = excluded.name, country = excluded.country, gender = excluded.gender,
      languages = excluded.languages, years_experience = excluded.years_experience, ijazah = excluded.ijazah,
      qualifications = excluded.qualifications, teaches = excluded.teaches, bio = excluded.bio,
      availability = excluded.availability, capacity = excluded.capacity;
    update public.profiles set role = 'teacher' where id = a.user_id;
  else
    update public.teacher_profiles set accepting = false, capacity = 0 where user_id = a.user_id;
  end if;
end; $$;

create or replace function public.admin_update_teacher(teacher uuid, cap int, is_accepting boolean)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  update public.teacher_profiles set capacity = greatest(0, least(200, cap)), accepting = is_accepting where user_id = teacher;
end; $$;

create or replace function public.admin_assign(student uuid, teacher uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if not exists (select 1 from public.teacher_profiles t where t.user_id = teacher) then raise exception 'Not an approved teacher'; end if;
  if student = teacher then raise exception 'A teacher cannot be their own student'; end if;
  insert into public.links (teacher_id, student_id) values (teacher, student) on conflict do nothing;
  update public.teacher_requests set status = 'assigned', teacher_id = teacher, assigned_at = now() where student_id = student;
end; $$;

-- Students per teacher (for capacity), readable by admins and the teacher.
create or replace function public.teacher_load() returns table (teacher_id uuid, students bigint)
language sql stable security definer set search_path to '' as $$
  select l.teacher_id, count(*) from public.links l
  where private.is_admin() or l.teacher_id = (select auth.uid())
  group by l.teacher_id;
$$;


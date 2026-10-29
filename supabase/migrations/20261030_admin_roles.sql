-- Applied 30 Oct 2026 (admin_roles_management). Admin access is a list of Google emails.
-- Owners add, change or switch off admins; admins run the academy but cannot change the list.
-- The last active owner can never be removed. Removing access is a switch (active = false), not a delete.
alter table private.admin_emails add column if not exists role text not null default 'admin' check (role in ('owner', 'admin'));
alter table private.admin_emails add column if not exists active boolean not null default true;
alter table private.admin_emails add column if not exists added_by text not null default '';
alter table private.admin_emails add column if not exists added_at timestamptz not null default now();
update private.admin_emails set role = 'owner' where lower(email) = 'afzal5555@gmail.com';
-- Functions: private.admin_role(), private.is_admin(), public.my_admin_role(), public.admin_list(), public.admin_set(email, role, active)

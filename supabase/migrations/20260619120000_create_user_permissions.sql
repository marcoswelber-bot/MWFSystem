create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.is_adm_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'adm_master'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'adm_master'
    or exists (
      select 1
      from public.employees
      where lower(public.employees.email) = lower(auth.jwt() ->> 'email')
        and lower(replace(public.employees.role, ' ', '_')) = 'adm_master'
    );
$$;

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  module_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_toggle boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, module_key)
);

create index if not exists user_permissions_employee_idx
on public.user_permissions(employee_id);

create index if not exists user_permissions_module_idx
on public.user_permissions(module_key);

drop trigger if exists set_user_permissions_updated_at
on public.user_permissions;

create trigger set_user_permissions_updated_at
before update on public.user_permissions
for each row
execute function public.set_updated_at();

alter table public.user_permissions enable row level security;

drop policy if exists "Authenticated users can read user_permissions"
on public.user_permissions;
create policy "Authenticated users can read user_permissions"
on public.user_permissions
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "ADM can insert user_permissions"
on public.user_permissions;
create policy "ADM can insert user_permissions"
on public.user_permissions
for insert
to authenticated
with check (public.is_adm_master());

drop policy if exists "ADM can update user_permissions"
on public.user_permissions;
create policy "ADM can update user_permissions"
on public.user_permissions
for update
to authenticated
using (public.is_adm_master())
with check (public.is_adm_master());

drop policy if exists "ADM can delete user_permissions"
on public.user_permissions;
create policy "ADM can delete user_permissions"
on public.user_permissions
for delete
to authenticated
using (public.is_adm_master());

notify pgrst, 'reload schema';

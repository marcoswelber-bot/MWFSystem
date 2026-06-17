create extension if not exists "pgcrypto";

create type public.user_role as enum ('adm_master', 'clinic_admin', 'staff');

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  full_name text not null,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;

create or replace function public.is_adm_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'adm_master'
  );
$$;

create policy "ADM Master can manage all clinics"
on public.clinics
for all
to authenticated
using (public.is_adm_master())
with check (public.is_adm_master());

create policy "Users can read their clinic"
on public.clinics
for select
to authenticated
using (
  public.is_adm_master()
  or id in (
    select clinic_id
    from public.profiles
    where profiles.id = auth.uid()
  )
);

create policy "ADM Master can manage all profiles"
on public.profiles
for all
to authenticated
using (public.is_adm_master())
with check (public.is_adm_master());

create policy "Users can read profiles from their clinic"
on public.profiles
for select
to authenticated
using (
  public.is_adm_master()
  or clinic_id in (
    select clinic_id
    from public.profiles current_profile
    where current_profile.id = auth.uid()
  )
  or id = auth.uid()
);

create index if not exists profiles_clinic_id_idx on public.profiles(clinic_id);
create index if not exists profiles_role_idx on public.profiles(role);

create extension if not exists "pgcrypto";

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  name text not null,
  type text null,
  price numeric null,
  duration_minutes integer null,
  allows_package boolean not null default true,
  commission_type text null,
  commission_value numeric null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services add column if not exists internal_code text null;
alter table public.services add column if not exists category_id uuid null;
alter table public.services add column if not exists category text null;
alter table public.services add column if not exists description text null;
alter table public.services add column if not exists default_duration_minutes integer null;
alter table public.services add column if not exists break_minutes integer null;
alter table public.services add column if not exists default_price numeric null;
alter table public.services add column if not exists promotional_price numeric null;
alter table public.services add column if not exists required_credits integer not null default 0;
alter table public.services add column if not exists attendance_type text not null default 'presencial';
alter table public.services add column if not exists color text null;
alter table public.services add column if not exists image_url text null;
alter table public.services add column if not exists is_group boolean not null default false;
alter table public.services add column if not exists participant_limit integer null;
alter table public.services add column if not exists requires_medical_record boolean not null default false;
alter table public.services add column if not exists requires_authorization boolean not null default false;
alter table public.services add column if not exists pre_service_instructions text null;
alter table public.services add column if not exists post_service_instructions text null;
alter table public.services add column if not exists required_materials text null;
alter table public.services add column if not exists billing_type text not null default 'particular';
alter table public.services add column if not exists service_mode text not null default 'individual';
alter table public.services add column if not exists priority text not null default 'normal';
alter table public.services add column if not exists classification text null;
alter table public.services add column if not exists requires_consent_form boolean not null default false;
alter table public.services add column if not exists requires_photos boolean not null default false;
alter table public.services add column if not exists requires_attachment boolean not null default false;
alter table public.services add column if not exists is_initial_assessment boolean not null default false;
alter table public.services add column if not exists suggested_sessions integer null;
alter table public.services add column if not exists suggested_price numeric null;
alter table public.services add column if not exists suggested_discount numeric null;
alter table public.services add column if not exists room_required text null;
alter table public.services add column if not exists equipment_required text null;
alter table public.services add column if not exists preparation_minutes integer null;
alter table public.services add column if not exists cleanup_minutes integer null;
alter table public.services add column if not exists created_by uuid null;
alter table public.services add column if not exists updated_by uuid null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

alter table public.services enable row level security;

drop policy if exists "Authenticated users can read services" on public.services;
create policy "Authenticated users can read services"
on public.services
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert services" on public.services;
create policy "Authenticated users can insert services"
on public.services
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update services" on public.services;
create policy "Authenticated users can update services"
on public.services
for update
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete services" on public.services;
create policy "Authenticated users can delete services"
on public.services
for delete
to authenticated
using (auth.role() = 'authenticated');

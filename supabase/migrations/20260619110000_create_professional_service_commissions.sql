create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.professional_service_commissions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  attendance_type text not null default 'presencial',
  service_mode text not null default 'individual',
  group_commission_basis text not null default 'per_patient',
  base_price numeric null,
  commission_type text not null default 'percent',
  commission_value numeric not null default 0,
  estimated_amount numeric not null default 0,
  status text not null default 'active',
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    employee_id,
    service_id,
    attendance_type,
    service_mode,
    group_commission_basis
  )
);

create table if not exists public.professional_service_commission_history (
  id uuid primary key default gen_random_uuid(),
  commission_rule_id uuid null references public.professional_service_commissions(id) on delete set null,
  employee_id uuid null references public.employees(id) on delete set null,
  service_id uuid null references public.services(id) on delete set null,
  action text not null,
  old_commission_type text null,
  old_commission_value numeric null,
  old_estimated_amount numeric null,
  old_status text null,
  new_commission_type text null,
  new_commission_value numeric null,
  new_estimated_amount numeric null,
  new_status text null,
  change_reason text null,
  changed_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists professional_service_commissions_employee_idx
on public.professional_service_commissions(employee_id);

create index if not exists professional_service_commissions_service_idx
on public.professional_service_commissions(service_id);

create index if not exists professional_service_commissions_lookup_idx
on public.professional_service_commissions(
  employee_id,
  service_id,
  attendance_type,
  service_mode,
  status
);

create index if not exists professional_service_commission_history_rule_idx
on public.professional_service_commission_history(commission_rule_id);

create index if not exists professional_service_commission_history_employee_idx
on public.professional_service_commission_history(employee_id);

drop trigger if exists set_professional_service_commissions_updated_at
on public.professional_service_commissions;

create trigger set_professional_service_commissions_updated_at
before update on public.professional_service_commissions
for each row
execute function public.set_updated_at();

alter table public.professional_service_commissions enable row level security;
alter table public.professional_service_commission_history enable row level security;

drop policy if exists "Authenticated users can read professional service commissions"
on public.professional_service_commissions;
create policy "Authenticated users can read professional service commissions"
on public.professional_service_commissions
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert professional service commissions"
on public.professional_service_commissions;
create policy "Authenticated users can insert professional service commissions"
on public.professional_service_commissions
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update professional service commissions"
on public.professional_service_commissions;
create policy "Authenticated users can update professional service commissions"
on public.professional_service_commissions
for update
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete professional service commissions"
on public.professional_service_commissions;
create policy "Authenticated users can delete professional service commissions"
on public.professional_service_commissions
for delete
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read professional service commission history"
on public.professional_service_commission_history;
create policy "Authenticated users can read professional service commission history"
on public.professional_service_commission_history
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert professional service commission history"
on public.professional_service_commission_history;
create policy "Authenticated users can insert professional service commission history"
on public.professional_service_commission_history
for insert
to authenticated
with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';

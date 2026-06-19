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
  professional_id uuid null,
  service_id uuid null,
  attendance_type text not null default 'presencial',
  modality text not null default 'individual',
  commission_type text not null default 'percentual',
  commission_value numeric not null default 0,
  group_calculation_mode text not null default 'por_paciente',
  base_price numeric null,
  estimated_amount numeric not null default 0,
  active boolean not null default true,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_service_commission_history (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid null,
  professional_id uuid null,
  service_id uuid null,
  old_value numeric null,
  new_value numeric null,
  changed_by uuid null,
  reason text null,
  created_at timestamptz not null default now()
);

alter table public.professional_service_commissions
  add column if not exists professional_id uuid null,
  add column if not exists service_id uuid null,
  add column if not exists attendance_type text not null default 'presencial',
  add column if not exists modality text not null default 'individual',
  add column if not exists commission_type text not null default 'percentual',
  add column if not exists commission_value numeric not null default 0,
  add column if not exists group_calculation_mode text not null default 'por_paciente',
  add column if not exists base_price numeric null,
  add column if not exists estimated_amount numeric not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists notes text null,
  add column if not exists created_by uuid null,
  add column if not exists updated_by uuid null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.professional_service_commission_history
  add column if not exists commission_id uuid null,
  add column if not exists professional_id uuid null,
  add column if not exists service_id uuid null,
  add column if not exists old_value numeric null,
  add column if not exists new_value numeric null,
  add column if not exists changed_by uuid null,
  add column if not exists reason text null,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commissions'
      and column_name = 'employee_id'
  ) then
    execute 'alter table public.professional_service_commissions alter column employee_id drop not null';
    execute 'update public.professional_service_commissions set professional_id = coalesce(professional_id, employee_id)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commissions'
      and column_name = 'service_mode'
  ) then
    execute 'alter table public.professional_service_commissions alter column service_mode drop not null';
    execute $sql$
      update public.professional_service_commissions
      set modality = coalesce(
        modality,
        case service_mode
          when 'group' then 'grupo'
          else 'individual'
        end
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commissions'
      and column_name = 'group_commission_basis'
  ) then
    execute 'alter table public.professional_service_commissions alter column group_commission_basis drop not null';
    execute $sql$
      update public.professional_service_commissions
      set group_calculation_mode = coalesce(
        group_calculation_mode,
        case group_commission_basis
          when 'per_group' then 'por_turma'
          else 'por_paciente'
        end
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commissions'
      and column_name = 'status'
  ) then
    execute 'alter table public.professional_service_commissions alter column status drop not null';
    execute $sql$
      update public.professional_service_commissions
      set active = coalesce(active, status <> 'inactive')
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commissions'
      and column_name = 'commission_type'
  ) then
    execute $sql$
      update public.professional_service_commissions
      set commission_type = case commission_type
        when 'percent' then 'percentual'
        when 'fixed' then 'valor_fixo'
        else commission_type
      end
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commission_history'
      and column_name = 'commission_rule_id'
  ) then
    execute 'update public.professional_service_commission_history set commission_id = coalesce(commission_id, commission_rule_id)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commission_history'
      and column_name = 'employee_id'
  ) then
    execute 'update public.professional_service_commission_history set professional_id = coalesce(professional_id, employee_id)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commission_history'
      and column_name = 'new_commission_value'
  ) then
    execute 'update public.professional_service_commission_history set new_value = coalesce(new_value, new_commission_value)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commission_history'
      and column_name = 'old_commission_value'
  ) then
    execute 'update public.professional_service_commission_history set old_value = coalesce(old_value, old_commission_value)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commission_history'
      and column_name = 'change_reason'
  ) then
    execute 'update public.professional_service_commission_history set reason = coalesce(reason, change_reason)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_service_commission_history'
      and column_name = 'action'
  ) then
    execute 'alter table public.professional_service_commission_history alter column action drop not null';
  end if;
end $$;

alter table public.professional_service_commissions
  alter column professional_id set not null,
  alter column service_id set not null,
  alter column attendance_type set not null,
  alter column modality set not null,
  alter column commission_type set not null,
  alter column commission_value set not null,
  alter column group_calculation_mode set not null,
  alter column active set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.professional_service_commissions
  drop constraint if exists professional_service_commissions_employee_id_fkey,
  drop constraint if exists professional_service_commissions_service_id_fkey,
  drop constraint if exists professional_service_commissions_professional_id_fkey,
  add constraint professional_service_commissions_professional_id_fkey
    foreign key (professional_id) references public.employees(id) on delete cascade,
  add constraint professional_service_commissions_service_id_fkey
    foreign key (service_id) references public.services(id) on delete cascade;

alter table public.professional_service_commission_history
  drop constraint if exists professional_service_commission_history_rule_id_fkey,
  drop constraint if exists professional_service_commission_history_commission_id_fkey,
  drop constraint if exists professional_service_commission_history_employee_id_fkey,
  drop constraint if exists professional_service_commission_history_professional_id_fkey,
  drop constraint if exists professional_service_commission_history_service_id_fkey,
  add constraint professional_service_commission_history_commission_id_fkey
    foreign key (commission_id) references public.professional_service_commissions(id) on delete set null,
  add constraint professional_service_commission_history_professional_id_fkey
    foreign key (professional_id) references public.employees(id) on delete set null,
  add constraint professional_service_commission_history_service_id_fkey
    foreign key (service_id) references public.services(id) on delete set null;

alter table public.professional_service_commissions
  drop constraint if exists professional_service_commissions_attendance_type_check,
  add constraint professional_service_commissions_attendance_type_check
    check (attendance_type in ('presencial', 'online', 'domiciliar')),
  drop constraint if exists professional_service_commissions_modality_check,
  add constraint professional_service_commissions_modality_check
    check (modality in ('individual', 'grupo')),
  drop constraint if exists professional_service_commissions_commission_type_check,
  add constraint professional_service_commissions_commission_type_check
    check (commission_type in ('percentual', 'valor_fixo')),
  drop constraint if exists professional_service_commissions_group_calculation_mode_check,
  add constraint professional_service_commissions_group_calculation_mode_check
    check (group_calculation_mode in ('por_paciente', 'por_turma'));

alter table public.professional_service_commissions
  drop constraint if exists professional_service_commissions_employee_service_unique,
  drop constraint if exists professional_service_commissions_professional_service_unique,
  add constraint professional_service_commissions_professional_service_unique
    unique (
      professional_id,
      service_id,
      attendance_type,
      modality,
      group_calculation_mode
    );

create index if not exists professional_service_commissions_professional_idx
on public.professional_service_commissions(professional_id);

create index if not exists professional_service_commissions_service_idx
on public.professional_service_commissions(service_id);

create index if not exists professional_service_commissions_lookup_idx
on public.professional_service_commissions(
  professional_id,
  service_id,
  attendance_type,
  modality,
  active
);

create index if not exists professional_service_commission_history_commission_idx
on public.professional_service_commission_history(commission_id);

create index if not exists professional_service_commission_history_professional_idx
on public.professional_service_commission_history(professional_id);

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

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  name text not null,
  description text null,
  color text null,
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

update public.services
set default_duration_minutes = coalesce(default_duration_minutes, duration_minutes),
    default_price = coalesce(default_price, price),
    category = coalesce(category, type)
where default_duration_minutes is null
   or default_price is null
   or category is null;

create table if not exists public.service_professionals (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  is_primary boolean not null default false,
  commission_type text null,
  commission_value numeric null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, employee_id)
);

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  name text not null,
  description text null,
  sessions_quantity integer not null default 1,
  total_price numeric null,
  price_per_session numeric null,
  validity_days integer null,
  allow_freeze boolean not null default true,
  allow_renewal boolean not null default true,
  allow_custom_patient_package boolean not null default true,
  uses_credits boolean not null default false,
  contracted_credits integer not null default 0,
  used_credits integer not null default 0,
  available_credits integer not null default 0,
  reversed_credits integer not null default 0,
  expired_credits integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  sessions_quantity integer not null default 1,
  credits_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  unique (package_id, service_id)
);

create table if not exists public.service_discounts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  service_id uuid null references public.services(id) on delete cascade,
  package_id uuid null references public.service_packages(id) on delete cascade,
  name text not null,
  sessions_quantity integer not null default 1,
  discount_type text not null default 'percent',
  discount_value numeric not null default 0,
  original_price numeric null,
  final_price numeric null,
  price_per_session numeric null,
  total_savings numeric null,
  can_override_during_sale boolean not null default true,
  visible_to_professional boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  name text not null,
  rule_type text not null,
  coupon_code text null,
  discount_type text null,
  discount_value numeric null,
  max_discount_admin numeric null,
  max_discount_manager numeric null,
  max_discount_professional numeric null,
  start_date date null,
  end_date date null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treatment_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists treatment_goals_name_unique
on public.treatment_goals (lower(name));

insert into public.treatment_goals (name)
values
  ('Avaliacao inicial'),
  ('Reabilitacao'),
  ('Estetica facial'),
  ('Estetica corporal'),
  ('Emagrecimento'),
  ('Pos-operatorio'),
  ('Retorno'),
  ('Manutencao'),
  ('Prevencao'),
  ('Outro')
on conflict do nothing;

create table if not exists public.treatment_protocols (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  name text not null,
  objective text null,
  goal_id uuid null references public.treatment_goals(id) on delete set null,
  recommended_sessions integer null,
  recommended_interval_days integer null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treatment_protocol_steps (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.treatment_protocols(id) on delete cascade,
  service_id uuid null references public.services(id) on delete set null,
  step_order integer not null default 1,
  title text not null,
  recommended_sessions integer null,
  recommended_interval_days integer null,
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_required_documents (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  requires_consent_form boolean not null default false,
  requires_authorization boolean not null default false,
  requires_before_after_photos boolean not null default false,
  requires_attachment boolean not null default false,
  requires_medical_record boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_resources (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  room text null,
  equipment text null,
  stretcher_required boolean not null default false,
  specific_device text null,
  materials text null,
  preparation_minutes integer null,
  cleanup_minutes integer null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  service_id uuid null references public.services(id) on delete cascade,
  employee_id uuid null references public.employees(id) on delete set null,
  title text not null,
  message text not null,
  notification_type text not null default 'internal',
  whatsapp_template text null,
  status text not null default 'unread',
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create table if not exists public.service_audit_logs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid null references public.services(id) on delete cascade,
  action text not null,
  field_name text null,
  old_value text null,
  new_value text null,
  changed_by uuid null,
  created_at timestamptz not null default now()
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'service_categories',
    'services',
    'service_professionals',
    'service_packages',
    'service_package_items',
    'service_discounts',
    'commercial_rules',
    'treatment_goals',
    'treatment_protocols',
    'treatment_protocol_steps',
    'service_required_documents',
    'service_resources',
    'internal_notifications',
    'service_audit_logs'
  ]
  loop
    execute format('drop trigger if exists set_%s_updated_at on public.%I', target_table, target_table);
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'updated_at'
    ) then
      execute format(
        'create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()',
        target_table,
        target_table
      );
    end if;
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'service_categories',
    'services',
    'service_professionals',
    'service_packages',
    'service_package_items',
    'service_discounts',
    'commercial_rules',
    'treatment_goals',
    'treatment_protocols',
    'treatment_protocol_steps',
    'service_required_documents',
    'service_resources',
    'internal_notifications',
    'service_audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('drop policy if exists "Authenticated users can read %s" on public.%I', target_table, target_table);
    execute format('create policy "Authenticated users can read %s" on public.%I for select to authenticated using (auth.role() = ''authenticated'')', target_table, target_table);
    execute format('drop policy if exists "Authenticated users can insert %s" on public.%I', target_table, target_table);
    execute format('create policy "Authenticated users can insert %s" on public.%I for insert to authenticated with check (auth.role() = ''authenticated'')', target_table, target_table);
    execute format('drop policy if exists "Authenticated users can update %s" on public.%I', target_table, target_table);
    execute format('create policy "Authenticated users can update %s" on public.%I for update to authenticated using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', target_table, target_table);
    execute format('drop policy if exists "Authenticated users can delete %s" on public.%I', target_table, target_table);
    execute format('create policy "Authenticated users can delete %s" on public.%I for delete to authenticated using (auth.role() = ''authenticated'')', target_table, target_table);
  end loop;
end $$;

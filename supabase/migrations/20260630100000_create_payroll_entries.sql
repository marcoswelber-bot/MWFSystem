alter table public.financial_transactions
  drop constraint if exists financial_transactions_origin_check;

alter table public.financial_transactions
  add constraint financial_transactions_origin_check check (
    origin is null or origin in ('avulso', 'pacote', 'manual', 'folha')
  );

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  employee_id uuid not null,
  financial_transaction_id uuid null references public.financial_transactions(id) on delete set null,
  competence_month integer not null,
  competence_year integer not null,
  entry_type text not null,
  nature text not null,
  amount numeric not null default 0,
  due_date date not null default current_date,
  paid_at date null,
  status text not null default 'pendente',
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

alter table public.payroll_entries
  add column if not exists clinic_id uuid,
  add column if not exists employee_id uuid,
  add column if not exists financial_transaction_id uuid references public.financial_transactions(id) on delete set null,
  add column if not exists competence_month integer not null default extract(month from current_date)::integer,
  add column if not exists competence_year integer not null default extract(year from current_date)::integer,
  add column if not exists entry_type text not null default 'outros',
  add column if not exists nature text not null default 'credito',
  add column if not exists amount numeric not null default 0,
  add column if not exists due_date date not null default current_date,
  add column if not exists paid_at date null,
  add column if not exists status text not null default 'pendente',
  add column if not exists notes text null,
  add column if not exists created_by uuid null,
  add column if not exists created_at timestamptz not null default now();

alter table public.payroll_entries
  alter column clinic_id set not null,
  alter column employee_id set not null,
  alter column competence_month set not null,
  alter column competence_year set not null,
  alter column entry_type set not null,
  alter column nature set not null,
  alter column amount set not null,
  alter column due_date set not null,
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_entries_competence_month_check'
      and conrelid = 'public.payroll_entries'::regclass
  ) then
    alter table public.payroll_entries
      add constraint payroll_entries_competence_month_check check (
        competence_month between 1 and 12
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_entries_competence_year_check'
      and conrelid = 'public.payroll_entries'::regclass
  ) then
    alter table public.payroll_entries
      add constraint payroll_entries_competence_year_check check (
        competence_year >= 2000
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_entries_entry_type_check'
      and conrelid = 'public.payroll_entries'::regclass
  ) then
    alter table public.payroll_entries
      add constraint payroll_entries_entry_type_check check (
        entry_type in (
          'salario_fixo',
          'comissao_manual',
          'vale_transporte',
          'vale_alimentacao',
          'ajuda_custo',
          'bonus',
          'desconto',
          'adiantamento',
          'inss',
          'fgts',
          'irrf',
          'outros'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_entries_nature_check'
      and conrelid = 'public.payroll_entries'::regclass
  ) then
    alter table public.payroll_entries
      add constraint payroll_entries_nature_check check (
        nature in ('credito', 'debito')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_entries_status_check'
      and conrelid = 'public.payroll_entries'::regclass
  ) then
    alter table public.payroll_entries
      add constraint payroll_entries_status_check check (
        status in ('pendente', 'parcial', 'pago', 'cancelado')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_entries_amount_check'
      and conrelid = 'public.payroll_entries'::regclass
  ) then
    alter table public.payroll_entries
      add constraint payroll_entries_amount_check check (amount >= 0);
  end if;
end $$;

create index if not exists payroll_entries_clinic_idx
  on public.payroll_entries(clinic_id);

create index if not exists payroll_entries_employee_idx
  on public.payroll_entries(employee_id);

create index if not exists payroll_entries_financial_transaction_idx
  on public.payroll_entries(financial_transaction_id);

create index if not exists payroll_entries_competence_idx
  on public.payroll_entries(competence_year, competence_month);

create index if not exists payroll_entries_status_idx
  on public.payroll_entries(status);

alter table public.payroll_entries enable row level security;

drop policy if exists "Authenticated users can read payroll entries"
  on public.payroll_entries;
create policy "Authenticated users can read payroll entries"
on public.payroll_entries for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert payroll entries"
  on public.payroll_entries;
create policy "Authenticated users can insert payroll entries"
on public.payroll_entries for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update payroll entries"
  on public.payroll_entries;
create policy "Authenticated users can update payroll entries"
on public.payroll_entries for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete payroll entries"
  on public.payroll_entries;
create policy "Authenticated users can delete payroll entries"
on public.payroll_entries for delete
to authenticated
using (true);

notify pgrst, 'reload schema';

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  transaction_type text not null default 'receita',
  patient_id uuid null,
  service_id uuid null,
  origin text null,
  category text null,
  description text null,
  amount numeric not null default 0,
  payment_method text null,
  due_date date not null default current_date,
  payment_date date null,
  status text not null default 'pendente',
  notes text null,
  future_agenda_source_id uuid null,
  future_package_source_id uuid null,
  commission_status text not null default 'not_applicable',
  whatsapp_status text not null default 'not_applicable',
  report_visibility text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_transactions
  add column if not exists clinic_id uuid,
  add column if not exists transaction_type text not null default 'receita',
  add column if not exists patient_id uuid null,
  add column if not exists service_id uuid null,
  add column if not exists origin text null,
  add column if not exists category text null,
  add column if not exists description text null,
  add column if not exists amount numeric not null default 0,
  add column if not exists payment_method text null,
  add column if not exists due_date date not null default current_date,
  add column if not exists payment_date date null,
  add column if not exists status text not null default 'pendente',
  add column if not exists notes text null,
  add column if not exists future_agenda_source_id uuid null,
  add column if not exists future_package_source_id uuid null,
  add column if not exists commission_status text not null default 'not_applicable',
  add column if not exists whatsapp_status text not null default 'not_applicable',
  add column if not exists report_visibility text not null default 'ready',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.financial_transactions
  alter column clinic_id set not null,
  alter column transaction_type set not null,
  alter column amount set not null,
  alter column due_date set not null,
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_type_check'
      and conrelid = 'public.financial_transactions'::regclass
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_type_check check (
        transaction_type in ('receita', 'despesa')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_origin_check'
      and conrelid = 'public.financial_transactions'::regclass
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_origin_check check (
        origin is null or origin in ('avulso', 'pacote', 'manual')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_payment_method_check'
      and conrelid = 'public.financial_transactions'::regclass
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_payment_method_check check (
        payment_method is null
        or payment_method in ('pix', 'dinheiro', 'cartao', 'boleto', 'parcelado')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_status_check'
      and conrelid = 'public.financial_transactions'::regclass
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_status_check check (
        status in ('pendente', 'pago', 'vencido', 'cancelado')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_amount_check'
      and conrelid = 'public.financial_transactions'::regclass
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_amount_check check (amount >= 0);
  end if;
end $$;

create index if not exists financial_transactions_clinic_idx
  on public.financial_transactions(clinic_id);

create index if not exists financial_transactions_type_idx
  on public.financial_transactions(transaction_type);

create index if not exists financial_transactions_status_idx
  on public.financial_transactions(status);

create index if not exists financial_transactions_due_date_idx
  on public.financial_transactions(due_date);

create index if not exists financial_transactions_patient_idx
  on public.financial_transactions(patient_id);

create index if not exists financial_transactions_service_idx
  on public.financial_transactions(service_id);

drop trigger if exists set_financial_transactions_updated_at on public.financial_transactions;
create trigger set_financial_transactions_updated_at
before update on public.financial_transactions
for each row execute function public.set_updated_at();

alter table public.financial_transactions enable row level security;

drop policy if exists "Authenticated users can read financial transactions"
  on public.financial_transactions;
create policy "Authenticated users can read financial transactions"
on public.financial_transactions for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert financial transactions"
  on public.financial_transactions;
create policy "Authenticated users can insert financial transactions"
on public.financial_transactions for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update financial transactions"
  on public.financial_transactions;
create policy "Authenticated users can update financial transactions"
on public.financial_transactions for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete financial transactions"
  on public.financial_transactions;
create policy "Authenticated users can delete financial transactions"
on public.financial_transactions for delete
to authenticated
using (true);

notify pgrst, 'reload schema';

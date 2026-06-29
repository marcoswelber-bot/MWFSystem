alter table public.financial_transactions
  drop constraint if exists financial_transactions_status_check;

alter table public.financial_transactions
  add constraint financial_transactions_status_check check (
    status in ('pendente', 'pago', 'vencido', 'parcial', 'cancelado')
  );

alter table public.financial_transactions
  drop constraint if exists financial_transactions_payment_method_check;

alter table public.financial_transactions
  add constraint financial_transactions_payment_method_check check (
    payment_method is null
    or payment_method in ('pix', 'dinheiro', 'cartao', 'boleto', 'parcelado', 'transferencia', 'outro')
  );

alter table public.financial_transactions
  add column if not exists paid_amount numeric(12,2) not null default 0;

alter table public.financial_transactions
  add column if not exists open_amount numeric(12,2) generated always as (
    case
      when status = 'cancelado' then 0
      when amount - paid_amount < 0 then 0
      else amount - paid_amount
    end
  ) stored;

update public.financial_transactions
set paid_amount = amount
where status = 'pago'
  and paid_amount = 0;

create table if not exists public.payment_settlements (
  id uuid primary key default gen_random_uuid(),
  financial_transaction_id uuid not null references public.financial_transactions(id) on delete cascade,
  settlement_type text not null,
  amount numeric(12,2) not null,
  payment_method text null,
  paid_at date not null,
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

alter table public.payment_settlements
  add column if not exists financial_transaction_id uuid references public.financial_transactions(id) on delete cascade,
  add column if not exists settlement_type text,
  add column if not exists amount numeric(12,2),
  add column if not exists payment_method text,
  add column if not exists paid_at date,
  add column if not exists notes text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now();

alter table public.payment_settlements
  alter column financial_transaction_id set not null,
  alter column settlement_type set not null,
  alter column amount set not null,
  alter column paid_at set not null;

alter table public.payment_settlements
  drop constraint if exists payment_settlements_type_check;

alter table public.payment_settlements
  add constraint payment_settlements_type_check check (
    settlement_type in ('patient_payment', 'staff_payout')
  );

alter table public.payment_settlements
  drop constraint if exists payment_settlements_amount_check;

alter table public.payment_settlements
  add constraint payment_settlements_amount_check check (amount > 0);

alter table public.payment_settlements
  drop constraint if exists payment_settlements_payment_method_check;

alter table public.payment_settlements
  add constraint payment_settlements_payment_method_check check (
    payment_method is null
    or payment_method in ('pix', 'dinheiro', 'cartao', 'boleto', 'parcelado', 'transferencia', 'outro')
  );

create index if not exists payment_settlements_transaction_idx
  on public.payment_settlements(financial_transaction_id);

create index if not exists payment_settlements_type_idx
  on public.payment_settlements(settlement_type);

create index if not exists payment_settlements_paid_at_idx
  on public.payment_settlements(paid_at);

alter table public.payment_settlements enable row level security;

drop policy if exists "Authenticated users can read payment settlements" on public.payment_settlements;
create policy "Authenticated users can read payment settlements"
on public.payment_settlements for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert payment settlements" on public.payment_settlements;
create policy "Authenticated users can insert payment settlements"
on public.payment_settlements for insert
to authenticated
with check (true);

select pg_notify('pgrst', 'reload schema');

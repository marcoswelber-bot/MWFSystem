
alter table public.financial_transactions
  drop constraint if exists financial_transactions_status_check,
  add constraint financial_transactions_status_check check (
    status in ('pendente', 'pago', 'vencido', 'parcial', 'cancelado')
  );

alter table public.financial_transactions
  add column if not exists paid_amount numeric(12,2) not null default 0,
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
  created_at timestamptz not null default now(),
  constraint payment_settlements_type_check check (
    settlement_type in ('patient_payment', 'staff_payout')
  ),
  constraint payment_settlements_amount_check check (amount > 0),
  constraint payment_settlements_payment_method_check check (
    payment_method is null
    or payment_method in ('pix', 'dinheiro', 'cartao', 'boleto', 'parcelado')
  )
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

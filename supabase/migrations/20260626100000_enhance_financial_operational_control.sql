alter table public.financial_transactions
  add column if not exists employee_id uuid null,
  add column if not exists appointment_date date null,
  add column if not exists base_amount numeric null,
  add column if not exists commission_type text null,
  add column if not exists commission_rule_id uuid null;

create index if not exists financial_transactions_employee_idx
  on public.financial_transactions(employee_id);

create index if not exists financial_transactions_appointment_date_idx
  on public.financial_transactions(appointment_date);

create unique index if not exists financial_transactions_revenue_appointment_unique_idx
  on public.financial_transactions(future_agenda_source_id)
  where future_agenda_source_id is not null
    and transaction_type = 'receita'
    and origin = 'avulso';

create unique index if not exists financial_transactions_commission_appointment_unique_idx
  on public.financial_transactions(future_agenda_source_id)
  where future_agenda_source_id is not null
    and transaction_type = 'despesa'
    and category in ('Comissões', 'Comissoes')
    and commission_status = 'generated';

notify pgrst, 'reload schema';

create unique index if not exists financial_transactions_commission_appointment_unique_idx
  on public.financial_transactions(future_agenda_source_id)
  where future_agenda_source_id is not null
    and transaction_type = 'despesa'
    and category in ('Comissões', 'Comissoes')
    and commission_status = 'generated';

notify pgrst, 'reload schema';

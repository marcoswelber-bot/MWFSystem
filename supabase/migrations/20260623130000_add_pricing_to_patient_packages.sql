alter table public.patient_packages
  add column if not exists unit_session_value numeric not null default 0,
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists subtotal_value numeric not null default 0,
  add column if not exists discount_value numeric not null default 0,
  add column if not exists sale_responsible_id uuid null;

update public.patient_packages
set unit_session_value = case
      when contracted_sessions > 0 and unit_session_value = 0
        then coalesce(total_value, 0) / contracted_sessions
      else unit_session_value
    end,
    subtotal_value = case
      when subtotal_value = 0
        then contracted_sessions * case
          when unit_session_value > 0 then unit_session_value
          when contracted_sessions > 0 then coalesce(total_value, 0) / contracted_sessions
          else 0
        end
      else subtotal_value
    end,
    discount_percent = greatest(0, least(discount_percent, 100)),
    discount_value = case
      when discount_value = 0 and subtotal_value > 0
        then subtotal_value * greatest(0, least(discount_percent, 100)) / 100
      else greatest(discount_value, 0)
    end,
    total_value = greatest(coalesce(total_value, 0), 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_packages_pricing_check'
      and conrelid = 'public.patient_packages'::regclass
  ) then
    alter table public.patient_packages
      add constraint patient_packages_pricing_check check (
        unit_session_value >= 0
        and discount_percent >= 0
        and discount_percent <= 100
        and subtotal_value >= 0
        and discount_value >= 0
        and total_value >= 0
      );
  end if;
end $$;

create index if not exists patient_packages_sale_responsible_idx
  on public.patient_packages(sale_responsible_id);

notify pgrst, 'reload schema';

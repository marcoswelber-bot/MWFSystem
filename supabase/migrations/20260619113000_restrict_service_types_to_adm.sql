create or replace function public.is_adm_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@clinica.com'
    or lower(replace(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''), ' ', '_')) in ('adm_master', 'admin_master')
    or lower(replace(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', ''), ' ', '_')) in ('adm_master', 'admin_master')
    or exists (
      select 1
      from public.employees
      where lower(public.employees.email) = lower(auth.jwt() ->> 'email')
        and lower(replace(public.employees.role, ' ', '_')) in ('adm_master', 'admin_master')
    );
$$;

alter table public.service_categories enable row level security;

drop policy if exists "Authenticated users can read service_categories"
on public.service_categories;
create policy "Authenticated users can read service_categories"
on public.service_categories
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert service_categories"
on public.service_categories;
drop policy if exists "ADM can insert service_categories"
on public.service_categories;
create policy "ADM can insert service_categories"
on public.service_categories
for insert
to authenticated
with check (public.is_adm_master());

drop policy if exists "Authenticated users can update service_categories"
on public.service_categories;
drop policy if exists "ADM can update service_categories"
on public.service_categories;
create policy "ADM can update service_categories"
on public.service_categories
for update
to authenticated
using (public.is_adm_master())
with check (public.is_adm_master());

drop policy if exists "Authenticated users can delete service_categories"
on public.service_categories;
drop policy if exists "ADM can delete service_categories"
on public.service_categories;
create policy "ADM can delete service_categories"
on public.service_categories
for delete
to authenticated
using (public.is_adm_master());

notify pgrst, 'reload schema';

create or replace function public.is_adm_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'adm_master'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'adm_master'
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'adm_master'
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

alter table public.employees
  add column if not exists system_access boolean not null default false,
  add column if not exists login_email text null,
  add column if not exists temporary_password text null;

alter table public.patients
  add column if not exists portal_access boolean not null default false,
  add column if not exists login_email text null,
  add column if not exists temporary_password text null;

create index if not exists employees_login_email_idx
on public.employees(lower(login_email));

create index if not exists patients_login_email_idx
on public.patients(lower(login_email));

notify pgrst, 'reload schema';

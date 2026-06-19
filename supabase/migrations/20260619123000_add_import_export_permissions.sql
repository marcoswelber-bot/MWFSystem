alter table public.user_permissions
  add column if not exists can_export boolean not null default false,
  add column if not exists can_import boolean not null default false;

notify pgrst, 'reload schema';

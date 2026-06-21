insert into public.service_categories (name, description, color, status)
select seed.name, seed.description, seed.color, 'active'
from (
  values
    ('Fisioterapia', 'Tipo de servico para atendimentos de fisioterapia.', '#2563eb'),
    ('Pilates', 'Tipo de servico para aulas e sessoes de pilates.', '#16a34a'),
    ('Massagem', 'Tipo de servico para massagem e terapias manuais.', '#f97316'),
    ('Psicologia', 'Tipo de servico para atendimentos de psicologia.', '#7c3aed'),
    ('Nutricao', 'Tipo de servico para atendimentos de nutricao.', '#0f766e'),
    ('Atendimento em Grupo', 'Tipo de servico realizado em grupo.', '#dc2626'),
    ('Atendimento Individual', 'Tipo de servico realizado individualmente.', '#0891b2'),
    ('Avaliacao', 'Tipo de servico para avaliacoes iniciais e retornos.', '#4b5563')
) as seed(name, description, color)
where not exists (
  select 1
  from public.service_categories existing
  where lower(existing.name) = lower(seed.name)
    and existing.clinic_id is null
);

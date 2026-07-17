# MWFSystem - mapa real auditado

Fonte de verdade: migrations em ordem cronologica, types/database.ts, Server Actions e componentes atuais. supabase/schema.sql e apenas um bootstrap antigo e nao cobre os modulos recentes.

## Modulos e implementacao

| Modulo | Tabelas principais | Interface e operacoes | Regras e dependencias |
|---|---|---|---|
| Clinicas | clinics | /clinicas, CRUD generico e seletor de clinica ativa | ADM Master pode alternar escopo; demais perfis ficam na clinica vinculada |
| Funcionarios | employees, professional_service_commissions, professional_service_commission_history, user_permissions | /funcionarios, cadastro, ativacao, comissoes e historico | Login depende de auth_user_id, system_access e status ativo |
| Pacientes | patients | /pacientes, CRUD, busca, filtros e ficha integrada | Portal depende de auth_user_id, portal_access e status ativo |
| Servicos | services, service_categories, service_professionals, service_packages, service_discounts, commercial_rules, treatment_goals, treatment_protocols, service_resources, internal_notifications, service_audit_logs | /servicos, cadastros basicos e avancados | Grupo e definido por services.is_group e participant_limit; categorias globais sao restritas ao ADM |
| Agenda | appointments, appointment_participants, schedule_blocks, patient_session_history, appointment_reopen_audits | /agenda; criar, editar, confirmar, falta, cancelar, restaurar, finalizar e reabrir | Conflito por profissional/data/hora; bloqueios; capacidade de grupo; integracao com pacote, financeiro, comissao e prontuario |
| Pacotes de paciente | patient_packages | /pacotes; criar, editar, finalizar e cancelar | contratadas = realizadas + restantes; status active, finished, cancelled, expired |
| Financeiro | financial_transactions, payment_settlements | /financeiro e /financeiro/baixas; receitas, despesas, baixas totais/parciais e cancelamento | Status pendente, pago, vencido, parcial, cancelado; sete formas de pagamento implementadas |
| Folha | payroll_entries, financial_transactions | /financeiro/folha, contracheque e detalhe de comissoes | Salario, comissao, vales, ajuda, bonus, desconto, adiantamento, INSS, FGTS, IRRF e outros |
| Prontuario | medical_records | /prontuarios e ficha integrada; criar, editar, ativar/inativar, excluir e imprimir pelo navegador | Pode ser criado automaticamente ao finalizar atendimento |
| Relatorios | consultas de Agenda, Financeiro, Pacientes, Servicos e Participantes | financeiro, pagamentos, operacional, multiclinica e detalhe de comissoes | CSV e impressao usam dados carregados; nao foi encontrada geracao dedicada de PDF no servidor |
| Autenticacao | auth.users, employees, patients, profiles legado | /login, /portal, middleware | Nenhum usuario Auth deve ser criado pelo seed demo |
| Permissoes | user_permissions | /configuracoes/permissoes | Acoes view, create, edit, delete, toggle, export, import; ADM Master recebe acesso total |
| Alertas | appointments e financial_transactions | Dashboard e paineis de alertas | Alertas de agenda sem baixa, faltas e financeiro pendente/vencido |

## Agenda: valores realmente aceitos

- Status: agendado, confirmado, realizado, cancelado, faltou.
- Tipos: avulso, pacote, grupo, avaliacao, retorno, encaixe, cortesia, convenio, particular, reposicao, experimental, reposicao_extra.
- Origens: os mesmos valores operacionais, incluindo grupo, pacote e reposicoes.
- Bloqueios: dia_inteiro, periodo, horario.
- Nao existem status persistidos em atendimento ou reagendado.
- Reposicao exige original_appointment_id, nao e faturavel e e vinculada ao atendimento original.

## Grupo: alcance real

O sistema representa um grupo como um appointment com varias linhas em appointment_participants. A capacidade e verificada contra services.participant_limit. A implementacao atual nao possui colunas de presenca, falta, cancelamento, pacote, baixa, financeiro ou comissao por participante. Finalizacao, falta e cancelamento operam no appointment; portanto, cenarios individuais nao podem ser afirmados como suportados sem uma nova regra de negocio e uma alteracao de schema.

## Integracoes reais

- Finalizacao cria/atualiza prontuario e historico de sessao.
- Atendimento avulso faturavel gera receita unica por agendamento.
- Comissao usa primeiro a regra profissional/servico e depois o padrao do funcionario.
- Atendimento de pacote consome uma sessao se o pacote ativo corresponder a clinica, paciente e servico.
- Reabertura usa a funcao SQL reopen_appointment(uuid,text) para reverter financeiro/comissao, devolver sessao e registrar auditoria.
- Categorias financeiras de folha geram ou sincronizam payroll_entries.
- Nao foi encontrada integracao externa de WhatsApp; existem apenas links wa.me.

## Relacionamentos e protecoes

- FKs fisicas explicitas: perfis/usuarios Auth, identidades Auth de funcionarios e pacientes, vinculos de servicos, regras de comissao, participantes, liquidacoes, folha, reposicao e auditoria de reabertura.
- Parte dos relacionamentos de Agenda, Pacotes e Financeiro e validada pela aplicacao e por RLS, mas migrations antigas nao criam FK fisica para todas as colunas clinic_id, patient_id, employee_id e service_id.
- RLS usa identidade Auth, clinica ativa e user_permissions.
- Indices unicos impedem duplicidade de participantes, historico por atendimento/paciente, receita avulsa por atendimento e comissao gerada por atendimento.

## Limitacoes da auditoria

O arquivo local .env.reset.local contem valores vazios, nao existe psql, Docker, Supabase CLI, gh ou vinculo .vercel. Assim, clinicas e contagens remotas nao puderam ser consultadas e os scripts nao foram aplicados. A URL publica documentada responde e redireciona para login, mas nao ha credencial de homologacao local.

# Relatório de homologação — MWF_DEMO_V1

Status: **scripts preparados e não aplicados**. Ambiente remoto, dados existentes e testes interativos ainda não foram validados.

## A. Dados planejados

| Tabela | Quantidade esperada |
|---|---:|
| clinics | 2 |
| employees | 13 (8 profissionais, 3 recepção, 2 administradores lógicos) |
| patients | 40 |
| services | 10 |
| professional_service_commissions | 8 |
| patient_packages | 20 |
| appointments | 150 |
| appointment_participants | 161 |
| schedule_blocks | 8 |
| patient_session_history | 36 |
| medical_records | 20 |
| financial_transactions | 100 |
| payment_settlements | 25 |
| payroll_entries | 13 |

Clínicas planejadas: `DEMO — Clínica Horizonte MWF_DEMO_V1` e `DEMO — Clínica Integra MWF_DEMO_V1`. Período da agenda: de `current_date - 30` a `current_date + 59`. Todos os IDs são determinísticos a partir de `MWF_DEMO_V1`.

## B. Testes aprovados

| Módulo | Fluxo | Resultado |
|---|---|---|
| Scripts | Revisão estática de marcadores, transações e idempotência | Pendente de validação SQL em PostgreSQL real |
| Aplicação | lint, typecheck e build | Pendente |
| Funcional/visual | Plano preparado | Não executado |

## C. Erros e riscos encontrados

| Achado | Reprodução | Impacto | Prioridade |
|---|---|---|---|
| `supabase/schema.sql` não representa todas as migrações | Comparar o arquivo com migrações de agenda/financeiro | Fonte de verdade ambígua para tooling | Média |
| Agenda não suporta status “Em atendimento”/“Reagendado” | Ver constraint de `appointments.status` | Cenários não podem ser semeados literalmente sem mudar regra | Média |
| Conflito ativo do mesmo profissional é bloqueado | Ver índice parcial único de agenda | Teste deve esperar rejeição, não coexistência | Baixa |
| Sem framework E2E/browser | Ver `package.json` e ausência de configs | Teste visual requer execução manual | Média |

## D. Correções aplicadas

Nenhuma regra de negócio ou tela foi alterada. Foram adicionados apenas scripts e documentação em `supabase/demo/`.

## E. Pendências

- Inspecionar o banco alvo para identificar dados reais e ambiente demo existente; o repositório local não prova o estado remoto.
- Validar sintaxe/executar em PostgreSQL/Supabase de homologação e registrar as contagens reais.
- Testar perfis com contas de homologação preexistentes; nenhuma conta Auth foi criada.
- Executar os fluxos funcionais, visuais, exportações e impressão.
- Preencher resultados, evidências, erros comprovados e retestes neste relatório.

## F. Segurança e limpeza

`clear_demo.sql` exige confirmação por `SET LOCAL`, apresenta contagens antes da exclusão, usa ordem filha→pai e filtra cada exclusão pelo lote. Não contém `TRUNCATE`, `DROP`, alteração estrutural ou manipulação de `auth.users`. As clínicas removíveis são exclusivamente as explicitamente marcadas `DEMO — ... MWF_DEMO_V1`.

Confirmação definitiva de “zero dados reais removidos” depende de executar primeiro `verify_demo.sql`, revisar as contagens no ambiente alvo e fazer backup. Até essa validação, nenhuma limpeza deve ser autorizada ou executada.

## G. Resultado desta execucao local

- Mapeamento integral documentado em SYSTEM_MAP.md.
- Seed revisado para 2 clinicas, 13 colaboradores, 40 pacientes, 10 servicos, 20 pacotes, 150 agendamentos, 161 participantes, 100 lancamentos, 25 baixas, prontuarios, sessoes e folha.
- Grupos preparados: atendimento 24 com 3 pacientes, atendimento 27 com 6 pacientes e atendimento 64 com 5 de 6 vagas.
- Agenda de hoje da clinica 1 preparada com atendimentos 121, 122 e 123 as 10:00; atendimento 124 representa conflito cancelado.
- O banco remoto nao foi alterado: as variaveis Supabase locais estao vazias e nao existe CLI/psql disponivel.
- A URL publica documentada respondeu HTTP 200 e redirecionou para /login.

## H. Matriz de cobertura

| Modulo | Cenario | Resultado local | Pendencia remota |
|---|---|---|---|
| Agenda | status, tipos, bloqueios, simultaneidade e conflito | SQL e regras auditados | Aplicar seed e validar interface |
| Agenda em grupo | grupos de 3, 6 e 5 participantes | Dados preparados | Fluxos individuais nao existem no schema atual |
| Pacotes | ativos, vencidos, finalizados, cancelados, integrais e parciais | Consistencia matematica protegida no seed/verify | Consumo e reabertura exigem banco e login |
| Financeiro | receitas, despesas, parciais, vencidos, comissoes, repasses e folha | Dados e vinculos revisados | Baixas interativas exigem banco e login |
| Pacientes | ativos/inativos e ficha integrada | Dados preparados | CRUD interativo exige login |
| Prontuarios | evolucoes genericas | Dados preparados | Impressao interativa exige login |
| Permissoes | ADM, administrador, funcionario e paciente | RLS e codigo mapeados | Contas Auth de homologacao nao existem localmente |
| Relatorios | financeiro, pagamentos, operacional, multiclinica e comissoes | Consultas e exportacao auditadas | Totais/CSV/impressao exigem dados aplicados |
| Visual | larguras e temas previstos no plano | Nao executado | Sem credencial e sem ferramenta de navegador |

## I. Erros comprovados e correcoes

| Erro | Causa raiz | Gravidade | Correcao |
|---|---|---|---|
| Mensagem de horario bloqueado corrompida | Texto fonte com mojibake | Media | Corrigido em actions.ts da Agenda |
| Mensagem de atendimento obrigatorio corrompida | Texto fonte com mojibake | Baixa | Corrigido em actions.ts da Agenda |
| Categoria/descricao de comissao corrompidas | Texto fonte com mojibake | Alta, pois afeta categorizacao financeira | Corrigido no motor financeiro |
| Pacote demo 12 violava contratadas = realizadas + restantes | Formula fixa incompatível com pacote de 10 sessoes | Alta, seed abortaria | Formula reescrita e pos-validacao adicionada |
| Vínculos demo atravessavam clinicas | Geradores independentes de paciente/profissional/servico | Alta | Geradores alinhados por clinica |
| Baixas de repasse apontavam para receitas | Faixa de IDs incorreta | Alta | Baixas separadas por tipo e valor pago |

## J. Validacoes tecnicas finais

- npm run lint: aprovado, zero erros e dois warnings preexistentes de funcoes Auth nao utilizadas.
- npm run typecheck: aprovado.
- npm run build: aprovado; 24 paginas geradas.
- Testes automatizados de navegador: inexistentes no projeto.
- Teste visual interativo: nao executado; sem credencial Supabase/Auth e sem Playwright/Cypress.
- clear_demo.sql: revisado sem TRUNCATE, DROP, ALTER estrutural ou DELETE sem predicado do lote.
- Commit, push e deploy: nao executados, pois o requisito de dados visiveis e homologacao remota permanece bloqueado.

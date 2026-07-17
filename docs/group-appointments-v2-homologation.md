# Agendamento em Grupo V2 — relatório técnico

## Resultado implementado

O horário coletivo continua sendo um único registro em `appointments`. O controle operacional passa a ser individual em `appointment_participants`, sem reescrever valores históricos e sem consumir ou devolver sessões retroativamente.

Antes, a tabela de participantes continha apenas `id`, `appointment_id`, `patient_id` e `created_at`; falta, cancelamento, finalização, pacote, receita, comissão e prontuário eram efeitos do agendamento inteiro. Agora os campos individuais são opcionais e os registros antigos recebem apenas status derivado e a marca `legacy_aggregate=true`.

## Arquivos e regras

- `supabase/migrations/20260717120000_group_appointments_v2.sql`: schema, backfill conservador, índices, RLS de auditoria e RPCs transacionais.
- `app/(app)/agenda/actions.ts`: ações individuais, ações em lote e sincronização que preserva participantes processados.
- `components/agenda/agenda-manager.tsx`: painel responsivo por participante dentro do modal atual.
- `app/(app)/agenda/page.tsx`: carrega os detalhes individuais.
- `app/(app)/relatorios/operacional/page.tsx` e `components/reports/operational-report.tsx`: discriminam status por participante e legado.
- `types/database.ts`: tipos dos campos e RPCs.
- `supabase/demo/*.sql`: grupos V2 visíveis, verificação e limpeza protegida.
- `tests/group-appointments-v2.test.mjs`: 24 contratos obrigatórios e 2 contratos de segurança do lote.

Status individuais persistidos: `agendado`, `confirmado`, `realizado`, `faltou` e `cancelado`. Estado misto não cria status novo: é exibido por contagens na interface; o status geral permanece dentro da constraint antiga.

Pacote é validado por clínica, paciente, serviço, status, validade e saldo. Finalização e reabertura usam bloqueio de linha e alteração atômica de uma sessão. Receita avulsa e comissão `por_paciente` são únicas por participante. Comissão `por_turma` permanece única no agendamento e é revertida somente quando não resta participante realizado.

## Compatibilidade

- Campos novos começam opcionais.
- O backfill não divide receita ou comissão antiga.
- Lançamentos antigos de grupo recebem `legacy_group_aggregate=true`.
- Somente o pacote do paciente principal é vinculado no backfill, quando já constava no agendamento.
- Não há consumo/devolução retroativa.
- A edição do grupo não apaga mais todos os participantes; participantes com efeitos concluídos só podem ser retirados depois da reabertura/reversão.

## Validações executadas em 17/07/2026

- `npm test`: 26/26 aprovados.
- `npm run lint`: aprovado, com 2 warnings preexistentes fora do escopo.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `git diff --check`: aprovado; somente avisos de normalização LF/CRLF.

Não há Playwright, Cypress ou ferramenta equivalente configurada. Não foi executado teste interativo de navegador. Também não foi executada integração real contra Supabase porque o workspace não contém URL/chaves de homologação nem cliente PostgreSQL/Supabase configurado. Portanto, concorrência, RLS e RPCs foram validados por contrato estático, não por transações reais.

## Dados demo para validação visual

Após aplicar primeiro a migration e depois `supabase/demo/seed_demo.sql` em homologação:

- clínica `DEMO — Clínica Horizonte MWF_DEMO_V1`: grupos 24 e 64, profissional 04, serviço coletivo 04;
- clínica `DEMO — Clínica Integra MWF_DEMO_V1`: grupo 27, profissional 08, serviço coletivo 09;
- grupo 24: confirmação, falta, cancelamento, receita e comissão por participante;
- grupo 27: seis participantes, realizado parcial, falta, cancelamento, agendado, confirmado e comissão por turma;
- grupo 64: próximo ao limite, pacote ativo, pacote vencido e cenário reaberto;
- período geral: `current_date - 30` a `current_date + 59`, com agenda cheia em `current_date` às 10:00.

Execute `supabase/demo/verify_demo.sql` depois do seed. Não execute `clear_demo.sql` até existir autorização explícita.

## Aplicação e rollback

Antes de aplicar, faça backup e execute a migration em homologação. Depois execute o seed e a verificação, teste as ações individuais e confira saldos, receitas e comissões.

Rollback funcional seguro: reabra participantes finalizados pela interface/RPC para reverter efeitos individuais. Rollback estrutural não deve ser feito enquanto houver dados V2: primeiro exporte auditorias, reverta efeitos, confirme que não há vínculos individuais e só então prepare uma migration separada para remover RPCs/índices/colunas. Não use `clear_demo.sql` como rollback de schema; ele remove exclusivamente o lote `MWF_DEMO_V1` quando a confirmação local exata é fornecida.

## Riscos e pendências

- A migration e o seed foram validados pelo PostgreSQL do projeto conectado; ainda falta teste interativo dos fluxos pela interface.
- RLS deve ser exercitada com contas reais já existentes para Recepção, Profissional, Administrador e ADM Master; nenhuma conta Auth foi criada.
- O layout precisa ser conferido interativamente em 320, 375, 390, 430, 768 px e desktop, nos temas claro/escuro.
- Não houve commit, push, deploy nem limpeza.

## Execução no Supabase conectado — 17/07/2026

- Projeto: `MWFSystem`, ref `eksqrgqofjuxzzhebyei`, região `us-west-1`.
- Snapshot anterior: 2 clínicas, 3 pacientes, 3 funcionários, 3 serviços, 21 agendamentos, 21 participantes, 1 pacote, 19 lançamentos, 15 históricos e 17 prontuários.
- As 2 clínicas e os 3 pacientes anteriores foram preservados pelos mesmos IDs.
- Migration V2 aplicada. A primeira tentativa foi revertida por ausência do helper avançado de RLS; a migration foi adaptada às políticas reais e reaplicada com sucesso.
- Seed aplicado e reaplicado idempotentemente após completar consumo/devolução individual.
- Verify executado: zero duplicidades, órfãos, saldos negativos, pacotes inconsistentes ou dados não marcados dentro das clínicas demo.
- Totais demo: 2 clínicas, 13 funcionários, 40 pacientes, 10 serviços, 8 regras de comissão, 20 pacotes, 150 agendamentos, 162 participantes, 8 bloqueios, 38 históricos, 22 prontuários, 100 lançamentos, 25 baixas e 13 lançamentos de folha.
- Período demo: 17/06/2026 a 14/09/2026.
- Aplicação local ativa em `http://localhost:3000` e `/login` respondeu HTTP 200.
- Nenhuma limpeza, commit, push ou deploy foi executado.

# Plano de homologação — MWF_DEMO_V1

Registre executor, data, ambiente, evidência e resultado (`Aprovado`, `Reprovado`, `Bloqueado`) para cada item. Nunca use produção sem aprovação explícita.

## Pré-condições

- [ ] URL/projeto Supabase alvo conferido e classificado como homologação.
- [ ] Backup criado e restauração testada ou documentada.
- [ ] `verify_demo.sql` antes do seed sem lote pré-existente inesperado.
- [ ] Seed aplicado manualmente e transação concluída sem erro.
- [ ] `verify_demo.sql` após seed: órfãos, mistura e pacotes inconsistentes iguais a zero.
- [ ] Contagens comparadas com o relatório esperado.

## Agenda

- [ ] Criar, editar e confirmar um agendamento demo.
- [ ] Finalizar/dar baixa; validar sessão, receita e comissão uma única vez.
- [ ] Registrar e desfazer falta.
- [ ] Reagendar e verificar vínculo/histórico suportado pela aplicação.
- [ ] Cancelar e restaurar cancelamento.
- [ ] Reabrir realizado; validar devolução de sessão e reversões financeiras.
- [ ] Validar ação WhatsApp sem enviar para número real.
- [ ] Validar múltiplos atendimentos no mesmo horário e atualização sem F5.
- [ ] Validar bloqueios, horários livres, passado, hoje e futuro.

## Pacientes, pacotes e prontuário

- [ ] Pesquisar, abrir e editar paciente demo; navegar por Agenda, Financeiro, Pacotes e Prontuário.
- [ ] Validar pacientes ativos/inativos, com/sem telefone, e-mail, pacote, histórico e pendência.
- [ ] Criar, renovar, consumir e devolver sessão de pacote.
- [ ] Validar pacotes ativos, próximos do vencimento, vencidos, finalizados e cancelados.
- [ ] Criar/editar/imprimir evolução e gerar PDF, se disponível.
- [ ] Confirmar que todo conteúdo clínico permanece genérico e fictício.

## Financeiro e relatórios

- [ ] Baixa total e parcial; recibo e cobrança.
- [ ] Receitas/despesas pagas, abertas e vencidas.
- [ ] Comissão, repasse, folha e contracheque.
- [ ] Conferir totais contra `financial_transactions`, `payment_settlements` e `payroll_entries`.
- [ ] Aplicar filtros e testar CSV, PDF e impressão.

## Perfis e permissões

- [ ] ADM Master, Administrador, Gerente, Recepção, Profissional e Paciente com contas de homologação já existentes.
- [ ] Confirmar isolamento por clínica e negação das ações sem permissão.
- [ ] Não criar credencial em SQL; registrar como bloqueado se as contas não existirem.

## Matriz visual

Em tema claro e escuro, validar Dashboard, Agenda cheia, tabelas, cards, filtros, modais e painel lateral nas larguras 320, 375, 390, 430, 768 px e desktop.

Procurar corte de texto, sobreposição, rolagem horizontal indevida, botão inacessível, modal fora da tela, contraste ruim, caracteres corrompidos e informações duplicadas. Incluir nomes longos, valores altos/baixos e vários atendimentos no mesmo horário nas evidências.

## Automação e encerramento

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [x] `npm test` — 26 testes de contrato aprovados.
- [x] Revisar diff e criar commit após aprovação explícita; push/deploy permanecem pendentes.
- [ ] Após autorização de limpeza, registrar contagens antes/depois e executar novamente `verify_demo.sql`.

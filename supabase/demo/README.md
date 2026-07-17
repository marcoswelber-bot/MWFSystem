# Homologação MWFSystem — MWF_DEMO_V1

Estes artefatos foram preparados para homologação protegida. Nenhum deles foi executado em banco remoto durante sua criação.

## Ordem segura

1. Faça backup verificável do banco alvo (Supabase Dashboard ou `pg_dump`).
2. Confirme que o alvo não é produção ou obtenha aprovação explícita do proprietário.
3. Execute `verify_demo.sql` antes do seed e investigue qualquer lote já existente.
4. Revise e execute `seed_demo.sql` manualmente com uma função privilegiada.
5. Execute `verify_demo.sql` e registre as contagens.
6. Faça a homologação conforme `TEST_PLAN.md`.
7. Execute `clear_demo.sql` somente após autorização explícita e novo backup.

O seed é transacional, idempotente por IDs determinísticos e usa uma trava consultiva por lote. Ele não cria registros em `auth.users`, não armazena senhas e não altera registros já existentes.

## Limpeza protegida

Em `psql`, após autorização explícita:

```sql
begin;
set local mwf_demo.clear_confirm = 'MWF_DEMO_V1_CLEAR_CONFIRMED';
\i supabase/demo/clear_demo.sql
```

Sem o `SET LOCAL` correto, a limpeza mostra a prévia e aborta. PostgreSQL exige ponto em parâmetros customizados; por isso a forma executável é `mwf_demo.clear_confirm`, e não o identificador simples `mwf_demo_clear_confirm`. Não há `TRUNCATE`, `DROP` nem `DELETE` sem predicado de lote.

## Limitações conhecidas do esquema

- `profiles.id` depende de `auth.users`; portanto, nenhum perfil/login foi semeado. Os 13 colaboradores representam 8 profissionais, 3 recepcionistas e 2 administradores apenas no domínio da aplicação, todos com `system_access = false`.
- O status de agenda aceita `agendado`, `confirmado`, `realizado`, `cancelado` e `faltou`. “Em atendimento” e “Reagendado” não são persistidos como status porque isso alteraria regra de negócio; os cenários são anotados para teste lógico.
- O índice `appointments_professional_time_active_idx` impede conflito ativo do mesmo profissional. Há horários simultâneos entre profissionais e conflito cancelado para visualização, sem violar a restrição.
- Não há Playwright, Cypress ou ferramenta equivalente configurada no projeto. Testes visuais interativos permanecem manuais.

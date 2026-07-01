# MWFSystem

Sistema de gestão para clínicas de Pilates e Fisioterapia.

Sistema web multiclínica para gestão clínica, operacional e financeira.

## Stack

- Next.js 15 com App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database + RLS)
- Shadcn/UI como padrão de componentes
- Tema claro e escuro
- Layout responsivo com sidebar recolhível
- Deploy na Vercel

## Módulos

- Autenticação (funcionários e pacientes)
- Dashboard
- Clínicas/unidades
- Funcionários
- Pacientes
- Prontuários
- Agenda (com bloqueios)
- Serviços e Tipos de Serviço
- Pacotes
- Financeiro (receitas, despesas, folha, comissões)
- Relatórios (financeiro, operacional, pagamentos, multiclínica)
- Configurações e Permissões
- Portal do paciente

## Como rodar

```bash
npm install
npm run dev
```

Crie um arquivo `.env.local` baseado no `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://mwf-system.vercel.app
```

## Supabase

O schema está em `supabase/schema.sql`. Ele cria:

- `clinics`
- `profiles`
- `patients`
- Papel `adm_master`
- Políticas RLS para ADM Master e usuários vinculados à clínica

## Deploy na Vercel

1. Conecte o repositório na Vercel.
2. Configure as variáveis de ambiente do Supabase.
3. Use o comando padrão `npm run build`.

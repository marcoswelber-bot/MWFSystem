# MWFSystem

Fundacao do MWFSystem, um sistema web multiclinica para gestao clinica, operacional e financeira.

Sistema de gestao para clinicas de Pilates e Fisioterapia.

## Stack

- Next.js 15 com App Router
- TypeScript
- Tailwind CSS
- Supabase Auth e estrutura inicial de banco
- Shadcn/UI como padrao de componentes
- Tema claro e escuro
- Layout responsivo com sidebar recolhivel

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
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Supabase

O schema inicial esta em `supabase/schema.sql`. Ele cria:

- `clinics`
- `profiles`
- papel `adm_master`
- politicas RLS para ADM Master e usuarios vinculados a clinica

Depois de criar o projeto no Supabase, execute esse SQL no SQL Editor ou adapte para migrations do Supabase CLI.

## Paginas iniciais

- `/dashboard`
- `/pacientes`
- `/agenda`
- `/funcionarios`
- `/financeiro`
- `/servicos`
- `/prontuarios`
- `/relatorios`
- `/configuracoes`
- `/login`

## Deploy na Vercel

1. Conecte o repositorio na Vercel.
2. Configure as variaveis de ambiente do Supabase.
3. Use o comando padrao `npm run build`.

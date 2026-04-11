# SHPL Manager

Aplicativo web em Next.js para gerenciamento de campeonato anual de poker, com foco em login, jogadores, etapas, partidas, ranking e histórico.

## Stack

- Next.js 16 com App Router
- TypeScript
- Tailwind CSS 4
- Supabase para banco, autenticação e persistência

## Rodando localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie seu `.env.local` a partir de `.env.example`.

3. Rode o projeto:

```bash
npm run dev
```

Sem variáveis do Supabase, o app funciona em modo demonstração usando um snapshot local baseado nas regras do documento funcional.

## Estrutura principal

- `src/app`: rotas do App Router
- `src/components`: componentes de interface
- `src/lib/domain`: regras de negócio e tipos
- `src/lib/data`: snapshot mockado e repositório
- `src/lib/supabase`: clientes de integração
- `supabase/schema.sql`: modelagem inicial do banco

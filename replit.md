# Desenrasca

Marketplace em português de Portugal que liga pessoas que precisam de pequenos serviços a profissionais e trabalhadores locais, começando por Estremoz e arredores.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/desenrasca` — aplicação web responsiva.
- `artifacts/api-server` — API partilhada, autenticação e operações do marketplace.
- `lib/api-spec/openapi.yaml` — contrato da API e fonte para os hooks e validações gerados.
- `lib/db/src/schema/` — tabelas PostgreSQL.

## Architecture decisions

- Clerk gerido pelo Replit autentica utilizadores; o servidor associa os dados ao ID verificado da sessão.
- PostgreSQL guarda perfis, pedidos, candidaturas e mensagens; apenas o autor pode editar ou eliminar o seu pedido.
- As conversas de candidatura só são acessíveis ao autor do pedido e à pessoa candidata.
- As tabelas de avaliações e comissões são apenas preparação futura; não há pagamentos nem comissões cobradas.
- Não são inseridos dados de demonstração como se fossem pedidos reais.

## Product

Pesquisa e publicação de pequenos trabalhos locais, candidaturas, conversas privadas e gestão de pedidos e candidaturas numa área pessoal.

## User preferences

- Interface e textos em português de Portugal, com foco em telemóveis Android e iPhone.
- Priorizar autenticação, persistência real e publicação de pedidos; não implementar pagamentos nesta versão.
- Explicar configurações técnicas em linguagem simples e avisar antes de custos ou serviços pagos.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

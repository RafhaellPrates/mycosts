# MyCosts

App web mobile-first para controlar contas fixas e receitas mes a mes, no formato da minha planilha de controle financeiro. Multiusuario: cada pessoa tem login e os proprios dados.

## Arquitetura

```
iPhone (Safari)
   |  HTTPS, uma URL so
   v
Render: Node + Express + TypeScript
   |-- /      front React + TypeScript (build do Vite, arquivos estaticos)
   |-- /api   API JSON com Bearer JWT
   v
Postgres (hospedado no Supabase, usado so como banco)
```

Front e API no mesmo servico e na mesma origem: sem CORS e sem URL de API para configurar. Em dev o front roda no Vite (5173), que repassa `/api` para o back (3000).

O Supabase e so o host do Postgres: nada de Supabase Auth, supabase-js ou Data API. Login, senha (bcrypt) e JWT ficam no back, e toda consulta filtra por usuario. Trocar de provedor = trocar `DATABASE_URL` e rodar as migrations.

## Stack

- **Front:** React, TypeScript, Vite
- **Back:** Node.js, Express 5, TypeScript, zod, pg
- **Banco:** Postgres, migrations SQL em `backend/migrations`
- **Auth:** senha com bcrypt + JWT

## Rodando local

Na raiz do repo (o `npm install` da raiz instala tambem `backend` e `frontend`):

```bash
cp backend/.env.example backend/.env     # preencher DATABASE_URL e JWT_SECRET
npm install
npm run migrate        # cria/atualiza as tabelas
npm run dev            # abrir http://localhost:5173 (back em 3000)
```

## Acessos

O app nao tem tela de criar conta. Cada pessoa e criada pelo terminal, na raiz:

```bash
npm run criar-usuario  # pede email, nome e senha
```

Rodar de novo com um email que ja existe oferece redefinir a senha. Email e unico: nao da para ter duas contas com o mesmo. Nome, email e senha podem ser trocados depois na aba Perfil do app.

Importar a planilha anual para uma conta (dentro de `backend`; cria a conta se nao existir, `--desde` ignora meses anteriores):

```bash
npm run importar -- "C:/caminho/Controle_Financeiro_2026.xlsx" voce@email.com --desde=2026-09
```

## Deploy

- **Render:** New > Blueprint > este repo. O `render.yaml` cria o servico `mycosts` (free, Virginia, branch `main`), builda back e front e pede `DATABASE_URL` (Session pooler do Supabase) e `JWT_SECRET`. Migrations rodam sozinhas no start.
- **Manter acordado:** o plano free dorme apos 15 min sem acesso e leva ~50 s para acordar. Um cron externo (cron-job.org) chamando `GET /health` a cada 10 min evita isso; um servico ligado 24h cabe nas 750 h/mes do free.

## API

Rotas com prefixo `/api` (ex: `/api/auth/login`). Tudo fora de `/health` e `/api/auth/login` exige `Authorization: Bearer <token>`.

| Metodo | Rota | O que faz |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, senha }` e devolve token |
| GET | `/auth/me` | usuario logado `{ id, email, nome }` |
| PATCH | `/auth/me` | edita `{ nome?, email?, novaSenha? }`; trocar email ou senha exige `senhaAtual` |
| GET | `/categorias` | categorias aceitas nas contas |
| GET/POST | `/contas` | contas fixas (cadastro) |
| PATCH | `/contas/:id` | edita ou desativa (`ativa: false`) |
| GET/POST | `/fontes` | fontes de receita |
| PATCH | `/fontes/:id` | edita ou desativa |
| GET | `/mes/:ym` | contas, receitas, indicadores e resumo do ano (`ym` = `AAAA-MM`) |
| PATCH | `/mes/:ym/contas/:id` | `{ pago, situacao }` do mes |
| PATCH | `/mes/:ym/receitas/:id` | `{ valor }` do mes |
| GET | `/lancamentos?ym=AAAA-MM` | gastos avulsos do mes |
| POST | `/lancamentos` | `{ data, descricao, categoria, valor, formaPagamento }` |
| PATCH/DELETE | `/lancamentos/:id` | corrige ou apaga um avulso |

Gasto avulso conta no mes da data da compra, inclusive no credito. Por isso a fatura (conta fixa da categoria Cartões) aparece nas contas a pagar, mas nao entra em Gastos no Painel.

## Status

Acompanhe pelas [issues](../../issues).

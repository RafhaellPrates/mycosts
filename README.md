# MyCosts

App web mobile-first para controlar contas fixas e receitas mes a mes, no formato da minha planilha de controle financeiro. Multiusuario: cada pessoa tem login e os proprios dados.

## Arquitetura

```
iPhone (Safari)
   |  HTTPS
   v
Front: React + TypeScript (Vite)  -> Vercel
   |  JSON + Bearer JWT
   v
Back: Node + Express + TypeScript -> Render
   |  SQL (pg, DATABASE_URL)
   v
Postgres (hospedado no Supabase, usado so como banco)
```

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
cp frontend/.env.example frontend/.env   # VITE_API_URL aponta para o back
npm install
npm run migrate        # cria/atualiza as tabelas
npm run dev            # back em http://localhost:3000 e front em http://localhost:5173
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

- **Back (Render):** New > Blueprint > este repo. O `render.yaml` cria o servico `mycosts-api` (free, Virginia) e pede `DATABASE_URL` (Session pooler do Supabase), `JWT_SECRET` e `CORS_ORIGIN` (URL da Vercel). Migrations rodam sozinhas no start.
- **Front (Vercel):** importar o repo com Root Directory `frontend` (preset Vite) e `VITE_API_URL` = URL do Render.
- **Manter o back acordado:** o plano free dorme apos 15 min sem acesso. Um cron externo (cron-job.org) chamando `GET /health` a cada 10 min evita a espera de ~50 s na primeira abertura.

## API

Tudo fora de `/health` e `/auth/login` exige `Authorization: Bearer <token>`.

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

## Status

Acompanhe pelas [issues](../../issues).

import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError, usuarioDe } from "../http.js";
import { pool } from "../pool.js";
import { assinarToken, exigirLogin } from "./token.js";

const CUSTO_BCRYPT = 12;
// Hash de uma senha qualquer: login com email inexistente gasta o mesmo
// tempo que login com senha errada, pra nao revelar quem tem conta.
const HASH_FALSO = bcrypt.hashSync("senha-que-nao-existe", CUSTO_BCRYPT);

// Email sempre minusculo: o banco tem unique em usuarios.email, entao
// "Fulano@x.com" e "fulano@x.com" sao a mesma conta.
const email = z.string().trim().toLowerCase().email("Email invalido.").max(254);
// bcrypt so considera os primeiros 72 bytes.
const senha = z
  .string()
  .min(8, "Senha precisa de pelo menos 8 caracteres.")
  .refine((s) => Buffer.byteLength(s) <= 72, "Senha muito longa.");
const nome = z.string().trim().min(1, "Informe seu nome.").max(60, "Nome muito longo.");

const credenciais = z.object({ email, senha });
const edicaoPerfil = z.object({
  nome: nome.optional(),
  email: email.optional(),
  // Exigida so para trocar email ou senha.
  senhaAtual: z.string().optional(),
  novaSenha: senha.optional(),
});

interface UsuarioRow {
  id: string;
  email: string;
  nome: string;
}

const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Espere alguns minutos." },
});

/** Postgres 23505 = unique violada; aqui so pode ser o email. */
function emailEmUso(e: unknown): boolean {
  return (e as { code?: string })?.code === "23505";
}

// Nao tem rota de cadastro: os acessos sao criados com npm run criar-usuario.
export const authRouter = Router();

authRouter.post("/login", limite, async (req, res) => {
  const dados = credenciais.parse(req.body);
  const { rows } = await pool.query<UsuarioRow & { senha_hash: string }>(
    "select id, email, nome, senha_hash from usuarios where email = $1",
    [dados.email],
  );
  const ok = await bcrypt.compare(dados.senha, rows[0]?.senha_hash ?? HASH_FALSO);
  if (!rows[0] || !ok) throw new HttpError(401, "Email ou senha incorretos.");
  const { senha_hash: _, ...usuario } = rows[0];
  res.json({ token: assinarToken(usuario.id), usuario });
});

authRouter.get("/me", exigirLogin, async (req, res) => {
  const { rows } = await pool.query<UsuarioRow>("select id, email, nome from usuarios where id = $1", [
    usuarioDe(req),
  ]);
  // Token valido de usuario apagado.
  if (!rows[0]) throw new HttpError(401, "Sessao expirada. Entre de novo.");
  res.json({ usuario: rows[0] });
});

/** Edita o perfil. Trocar email ou senha pede a senha atual. */
authRouter.patch("/me", exigirLogin, limite, async (req, res) => {
  const id = usuarioDe(req);
  const dados = edicaoPerfil.parse(req.body);

  const { rows } = await pool.query<UsuarioRow & { senha_hash: string }>(
    "select id, email, nome, senha_hash from usuarios where id = $1",
    [id],
  );
  const atual = rows[0];
  if (!atual) throw new HttpError(401, "Sessao expirada. Entre de novo.");

  const trocaEmail = dados.email !== undefined && dados.email !== atual.email;
  const trocaSenha = dados.novaSenha !== undefined;
  if (trocaEmail || trocaSenha) {
    const ok = dados.senhaAtual ? await bcrypt.compare(dados.senhaAtual, atual.senha_hash) : false;
    if (!ok) throw new HttpError(403, "Senha atual incorreta.");
  }

  const novoHash = trocaSenha ? await bcrypt.hash(dados.novaSenha!, CUSTO_BCRYPT) : atual.senha_hash;
  try {
    const { rows: [usuario] } = await pool.query<UsuarioRow>(
      `update usuarios set nome = $2, email = $3, senha_hash = $4 where id = $1
       returning id, email, nome`,
      [id, dados.nome ?? atual.nome, dados.email ?? atual.email, novoHash],
    );
    res.json({ usuario });
  } catch (e) {
    if (emailEmUso(e)) throw new HttpError(409, "Ja existe conta com esse email.");
    throw e;
  }
});

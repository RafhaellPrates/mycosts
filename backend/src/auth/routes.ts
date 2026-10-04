import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError, usuarioDe } from "../http.js";
import { pool } from "../pool.js";
import { assinarToken, exigirLogin } from "./token.js";
import { USUARIO_COLS, duplicado, email, nome, preferencias, senha, type UsuarioRow } from "./validacao.js";

export const CUSTO_BCRYPT = 12;
// Hash de uma senha qualquer: login com email inexistente gasta o mesmo
// tempo que login com senha errada, pra nao revelar quem tem conta.
const HASH_FALSO = bcrypt.hashSync("senha-que-nao-existe", CUSTO_BCRYPT);

// `login` e email ou nome. `email` continua aceito para versoes antigas do app.
const credenciais = z
  .object({ login: z.string().trim().max(254).optional(), email: z.string().trim().max(254).optional(), senha })
  .refine((c) => c.login || c.email, "Informe o email ou o nome.");

const edicaoPerfil = z.object({
  nome: nome.optional(),
  email: email.optional(),
  // Exigida so para trocar email ou senha.
  senhaAtual: z.string().optional(),
  novaSenha: senha.optional(),
  preferencias: preferencias.optional(),
});

const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Espere alguns minutos." },
});

// Nao tem rota de cadastro: os acessos sao criados pelo admin (aba Acessos)
// ou com npm run criar-usuario.
export const authRouter = Router();

authRouter.post("/login", limite, async (req, res) => {
  const dados = credenciais.parse(req.body);
  const id = (dados.login || dados.email)!;
  // Com @ e email; sem @ e nome (o nome nunca tem @).
  const { rows } = await pool.query<UsuarioRow & { senha_hash: string }>(
    id.includes("@")
      ? `select ${USUARIO_COLS}, senha_hash from usuarios where email = lower($1)`
      : `select ${USUARIO_COLS}, senha_hash from usuarios where lower(trim(nome)) = lower(trim($1))`,
    [id],
  );
  const ok = await bcrypt.compare(dados.senha, rows[0]?.senha_hash ?? HASH_FALSO);
  if (!rows[0] || !ok) throw new HttpError(401, "Login ou senha incorretos.");
  const { senha_hash: _, ...usuario } = rows[0];
  res.json({ token: assinarToken(usuario.id), usuario });
});

authRouter.get("/me", exigirLogin, async (req, res) => {
  const { rows } = await pool.query<UsuarioRow>(`select ${USUARIO_COLS} from usuarios where id = $1`, [usuarioDe(req)]);
  // Token valido de usuario apagado.
  if (!rows[0]) throw new HttpError(401, "Sessao expirada. Entre de novo.");
  res.json({ usuario: rows[0] });
});

/** Edita o perfil e a aparencia. Trocar email ou senha pede a senha atual. */
authRouter.patch(
  "/me",
  exigirLogin,
  // Rate limit so quando confere senha: salvar a aparencia nao conta tentativa.
  (req, res, next) => (req.body?.senhaAtual ? limite(req, res, next) : next()),
  async (req, res) => {
    const id = usuarioDe(req);
    const dados = edicaoPerfil.parse(req.body);

    const { rows } = await pool.query<UsuarioRow & { senha_hash: string }>(
      `select ${USUARIO_COLS}, senha_hash from usuarios where id = $1`,
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
      const {
        rows: [usuario],
      } = await pool.query<UsuarioRow>(
        `update usuarios set nome = $2, email = $3, senha_hash = $4, preferencias = $5 where id = $1
         returning ${USUARIO_COLS}`,
        [id, dados.nome ?? atual.nome, dados.email ?? atual.email, novoHash, dados.preferencias ?? atual.preferencias],
      );
      res.json({ usuario });
    } catch (e) {
      const msg = duplicado(e);
      if (msg) throw new HttpError(409, msg);
      throw e;
    }
  },
);

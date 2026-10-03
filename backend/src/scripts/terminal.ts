import { createInterface, type Interface } from "node:readline";

// Um leitor so para o script inteiro: abrir um por pergunta perde as
// linhas que ja chegaram (ex: entrada colada ou redirecionada).
let rl: Interface | null = null;
let linhas: AsyncIterator<string> | null = null;
let mudo = false;

function leitor(): AsyncIterator<string> {
  if (!linhas) {
    rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    // Esconde o que e digitado enquanto pede senha.
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    out._writeToOutput = (s) => {
      if (!mudo) process.stdout.write(s);
    };
    linhas = rl[Symbol.asyncIterator]();
  }
  return linhas;
}

async function ler(pergunta: string, esconder: boolean): Promise<string> {
  const it = leitor();
  process.stdout.write(pergunta);
  mudo = esconder;
  const { value, done } = await it.next();
  mudo = false;
  if (esconder) process.stdout.write("\n");
  if (done) throw new Error("Entrada encerrada.");
  return value;
}

/** Pergunta no terminal e devolve a resposta. */
export async function perguntar(pergunta: string): Promise<string> {
  return (await ler(pergunta, false)).trim();
}

/** Como perguntar, mas esconde o que e digitado. */
export function perguntarSenha(pergunta: string): Promise<string> {
  return ler(pergunta, true);
}

/** Pede a senha duas vezes e valida o tamanho (bcrypt usa ate 72 bytes). */
export async function perguntarNovaSenha(): Promise<string> {
  const senha = await perguntarSenha("Senha (min. 8 caracteres): ");
  if (senha.length < 8 || Buffer.byteLength(senha) > 72) throw new Error("Senha precisa ter de 8 a 72 caracteres.");
  if ((await perguntarSenha("Repita a senha: ")) !== senha) throw new Error("As senhas nao conferem.");
  return senha;
}

/** Libera o terminal no fim do script. */
export function fecharTerminal() {
  rl?.close();
  rl = null;
  linhas = null;
}

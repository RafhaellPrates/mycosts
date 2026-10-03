// Mesma origem do front: o Express serve o app e a API (em dev, via proxy do Vite).
export const API_URL = "/api";

const TOKEN_KEY = "mycosts.token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---- token ----

let token: string | null = lerToken();
let aoExpirar: (() => void) | null = null;

function lerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(novo: string | null) {
  token = novo;
  try {
    if (novo) localStorage.setItem(TOKEN_KEY, novo);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* modo privado do Safari: fica so em memoria */
  }
}

/** Chamado quando o back responde 401 com token: sessao expirou. */
export function onSessaoExpirada(cb: () => void) {
  aoExpirar = cb;
}

// ---- requests ----

/** fetch com token; resposta de erro vira ApiError com a mensagem do back. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor.");
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = (await res.json()) as { erro?: string };
      msg = body.erro ?? msg;
    } catch {
      /* corpo nao e json */
    }
    if (res.status === 401 && token) {
      setToken(null);
      aoExpirar?.();
    }
    throw new ApiError(res.status, msg);
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  // 204 (DELETE) nao tem corpo.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Baixa um arquivo da API. Link comum nao serve: o token vai no header. */
export async function baixar(path: string, nomeArquivo: string) {
  const blob = await (await send(path)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Da tempo do navegador comecar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

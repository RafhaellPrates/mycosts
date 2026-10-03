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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

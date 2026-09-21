const TOKEN_KEY = 'tripmatch_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api${path}`, { ...options, headers });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    /* 非 JSON 响应 */
  }
  if (!response.ok) {
    throw new ApiError(body?.code ?? 'HTTP_ERROR', body?.message ?? `请求失败 ${response.status}`, response.status);
  }
  return body as T;
}

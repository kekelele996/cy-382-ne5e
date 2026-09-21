export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export function getToken(): string {
  return localStorage.getItem('tm_token') ?? '';
}

export function setToken(token: string) {
  if (token) localStorage.setItem('tm_token', token);
  else localStorage.removeItem('tm_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) ?? {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.code ?? 'INTERNAL_ERROR', body?.message ?? `请求失败 ${response.status}`, response.status);
  }
  return body as T;
}

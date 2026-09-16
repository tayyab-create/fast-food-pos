// Dev aid: VITE_API_DELAY_MS holds every API call for that long so skeleton
// and spinner states can be seen. Vite only inlines it from the build's env,
// so leave it unset (or 0) for production.
const API_DELAY_MS = import.meta.env.DEV ? Number(import.meta.env.VITE_API_DELAY_MS) || 0 : 0;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (API_DELAY_MS) await new Promise((r) => setTimeout(r, API_DELAY_MS));
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

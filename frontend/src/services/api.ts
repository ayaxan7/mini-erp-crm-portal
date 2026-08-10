import { ApiError, type ApiResponse } from '../types/api';

const API_URL: string | undefined = import.meta.env.VITE_API_URL || undefined;

function resolve(path: string): string {
  return API_URL ? `${API_URL}${path}` : path;
}

function getToken(): string | null {
  return localStorage.getItem('crm.token');
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(resolve(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    if (aborted) throw err;
    throw new ApiError(0, 'Network error — please check your connection');
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(response.status, `Unexpected response (${response.status})`);
  }

  if (!response.ok || payload.success === false) {
    if (response.status === 401 && typeof window !== 'undefined') {
      const event = new CustomEvent('crm:unauthorized');
      window.dispatchEvent(event);
    }
    throw new ApiError(response.status, payload.message || 'Something went wrong', payload.errors);
  }

  return payload;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) {
    const qs = params ? toQuery(params) : '';
    return request<T>(`${path}${qs}`, { signal });
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'POST', body });
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PATCH', body });
  },
};

export { toQuery };
// Marketing-site auth helper. The landing page hosts the login/signup form
// (calls the FastAPI backend directly) and then hands off to the console with
// the resulting JWTs in the URL.

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const DEFAULT_DASHBOARD_URL = 'http://localhost:4028/console-dashboard';
const DEFAULT_LOGIN_URL = 'http://localhost:4028/sign-up-login';

export const API_BASE_URL =
  import.meta.env.VITE_OPENBENCH_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export const DASHBOARD_URL =
  import.meta.env.VITE_OPENBENCH_DASHBOARD_URL?.trim() || DEFAULT_DASHBOARD_URL;

export const LOGIN_URL =
  import.meta.env.VITE_OPENBENCH_LOGIN_URL?.trim() || DEFAULT_LOGIN_URL;

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in_min: number;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const json = (await res.json()) as { detail?: unknown };
      if (json && typeof json.detail === 'string') detail = json.detail;
      else if (json && typeof json.detail === 'object') detail = JSON.stringify(json.detail);
    } catch {
      // ignore
    }
    throw new AuthError(res.status, detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function login(email: string, password: string): Promise<TokenPair> {
  return postJson<TokenPair>('/api/auth/login', { email, password });
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
  org_name: string;
  org_slug?: string;
}

export function register(payload: RegisterPayload): Promise<TokenPair> {
  return postJson<TokenPair>('/api/auth/register', payload);
}

// Build a console URL with tokens in the query string. The console's
// AuthProvider strips the params, persists the tokens, and continues.
export function dashboardUrlWithTokens(tokens: TokenPair): string {
  const url = new URL(DASHBOARD_URL);
  url.searchParams.set('access_token', tokens.access_token);
  url.searchParams.set('refresh_token', tokens.refresh_token);
  return url.toString();
}

export function getLoginUrl(): string {
  return LOGIN_URL;
}

export function getDashboardUrl(): string {
  return DASHBOARD_URL;
}

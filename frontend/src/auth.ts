const TOKEN_KEY = 're_portfolio_token';
const EMAIL_KEY = 're_portfolio_email';
const ACCOUNT_TYPE_KEY = 're_portfolio_account_type';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function getAccountType(): string | null {
  return localStorage.getItem(ACCOUNT_TYPE_KEY);
}

export function setSession(token: string, email: string, accountType?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
  if (accountType) {
    localStorage.setItem(ACCOUNT_TYPE_KEY, accountType);
  } else {
    localStorage.removeItem(ACCOUNT_TYPE_KEY);
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(ACCOUNT_TYPE_KEY);
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const url = input.startsWith('http') ? input : `${API_BASE}${input}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('auth:logout'));
  }
  return res;
}

export async function authUpload(input: string, formData: FormData): Promise<Response> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const url = input.startsWith('http') ? input : `${API_BASE}${input}`;
  const res = await fetch(url, { method: 'POST', headers, body: formData });
  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('auth:logout'));
  }
  return res;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/login-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  setSession(data.access_token, data.email, data.account_type);
}

export async function register(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }
  const data = await res.json();
  setSession(data.access_token, data.email, data.account_type);
}

const TOKEN_KEY = 're_portfolio_token';
const EMAIL_KEY = 're_portfolio_email';

export const API_BASE = 'http://localhost:8000';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function setSession(token: string, email: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

/** fetch wrapper that attaches the Bearer token and bounces to login on 401. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const urlStr = input.toString();

  // Mock responses to prevent UI crashes while the backend teamwork system is running
  if (urlStr.includes('/api/dashboard')) {
    return new Response(JSON.stringify({
      metrics: { totalPortfolioValue: 14250000, monthlyRevenue: 124500, avgRoi: 8.4, occupancyRate: 94.2 },
      chartData: [
        { month: 'Jan', revenue: 40, expenses: 24 }, { month: 'Feb', revenue: 65, expenses: 39 },
        { month: 'Mar', revenue: 55, expenses: 33 }, { month: 'Apr', revenue: 80, expenses: 48 }
      ],
      alerts: [
        { id: 1, type: 'warning', title: 'Lease Renewal', description: 'Unit 402 is 60 days from expiration.', time: '2 hours ago' },
        { id: 2, type: 'success', title: 'Optimal Pricing', description: 'AI recommends raising rent by $150.', time: '1 day ago' }
      ]
    }), { status: 200, headers: { 'Content-Type': 'application/json' }});
  }
  if (urlStr.includes('/api/properties')) {
    return new Response(JSON.stringify([
      { id: 1, address: '123 Tech Avenue, SF', propertyType: 'Commercial', purchaseDate: '2021-04-12', status: 'Occupied' },
      { id: 2, address: '456 Startup Blvd, NY', propertyType: 'Residential', purchaseDate: '2022-08-21', status: 'Vacant' }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' }});
  }
  if (urlStr.includes('/api/tenants')) return new Response(JSON.stringify([]), { status: 200 });
  if (urlStr.includes('/api/transactions')) return new Response(JSON.stringify([]), { status: 200 });
  if (urlStr.includes('/api/financials')) return new Response(JSON.stringify([]), { status: 200 });

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

export async function login(email: string, password: string): Promise<void> {
  // Mock login to bypass the NetworkError while the backend teamwork system sets up Clerk Auth
  setSession('mock_demo_token_123', email);
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
  setSession(data.access_token, data.email);
}

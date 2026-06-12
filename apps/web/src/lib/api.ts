const BASE_URL = '';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  slug: string;
  status: 'PENDING' | 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED';
  active: boolean;
  interval: number;
  uptimePercent24h: number;
  avgResponseTime24h: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardSummary {
  summary: {
    total: number;
    active: number;
    paused: number;
    up: number;
    down: number;
    degraded: number;
  };
  monitors: Monitor[];
  recentIncidents: {
    id: string;
    monitorId: string;
    monitorName: string;
    monitorSlug: string;
    startedAt: string;
    resolvedAt: string | null;
    durationSeconds: number | null;
  }[];
}

export interface Incident {
  id: string;
  monitorId: string;
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  monitorName?: string;
  monitorSlug?: string;
}

export interface Check {
  id: string;
  monitorId: string;
  checkedAt: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  responseTime: number;
  statusCode: number | null;
  error: string | null;
}

export interface MonitorStats {
  uptimePercent: number;
  totalChecks: number;
  avgResponseTime: number | null;
}

export interface LatencyBucket {
  bucket: string;
  avg: number;
  min: number;
  max: number;
}

export interface PublicStatusResponse {
  id: string;
  name: string;
  slug: string;
  status: 'PENDING' | 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED';
  uptimePercent7d: number;
  incidents: {
    id: string;
    startedAt: string;
    resolvedAt: string | null;
    durationSeconds: number | null;
  }[];
}

export const api = {
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('beacon_token');
    }
    return null;
  },

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('beacon_token', token);
    }
  },

  clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('beacon_token');
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  // Helper for authenticated requests
  async fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please sign in again.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (res.status === 204) {
      return {} as T;
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data as T;
  },

  async register(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to register fleet');
    }

    if (data.token) {
      this.setToken(data.token);
    }
    return data as AuthResponse;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid credentials');
    }

    if (data.token) {
      this.setToken(data.token);
    }
    return data as AuthResponse;
  },

  async getMe(): Promise<{ user: User }> {
    return this.fetchWithAuth<{ user: User }>('/api/v1/auth/me');
  },

  async getDashboard(): Promise<DashboardSummary> {
    return this.fetchWithAuth<DashboardSummary>('/api/v1/dashboard');
  },

  async createMonitor(data: { name: string; url: string; interval: number }): Promise<{ monitor: Monitor }> {
    return this.fetchWithAuth<{ monitor: Monitor }>('/api/v1/monitors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMonitor(id: string): Promise<{ monitor: Monitor }> {
    return this.fetchWithAuth<{ monitor: Monitor }>(`/api/v1/monitors/${id}`);
  },

  async updateMonitor(id: string, data: Partial<{ name: string; url: string; interval: number }>): Promise<{ monitor: Monitor }> {
    return this.fetchWithAuth<{ monitor: Monitor }>(`/api/v1/monitors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteMonitor(id: string): Promise<void> {
    return this.fetchWithAuth<void>(`/api/v1/monitors/${id}`, {
      method: 'DELETE',
    });
  },

  async pauseMonitor(id: string): Promise<{ monitor: Monitor }> {
    return this.fetchWithAuth<{ monitor: Monitor }>(`/api/v1/monitors/${id}/pause`, {
      method: 'POST',
    });
  },

  async resumeMonitor(id: string): Promise<{ monitor: Monitor }> {
    return this.fetchWithAuth<{ monitor: Monitor }>(`/api/v1/monitors/${id}/resume`, {
      method: 'POST',
    });
  },

  async getMonitorStats(id: string, window: '24h' | '7d' | '30d' = '24h'): Promise<MonitorStats> {
    return this.fetchWithAuth<MonitorStats>(`/api/v1/monitors/${id}/stats?window=${window}`);
  },

  async getMonitorChecks(id: string, window: '24h' | '7d' | '30d' = '24h', page = 1, limit = 50): Promise<{ checks: Check[]; pagination: { total: number; page: number; limit: number; pages: number } }> {
    return this.fetchWithAuth<{ checks: Check[]; pagination: { total: number; page: number; limit: number; pages: number } }>(
      `/api/v1/monitors/${id}/checks?window=${window}&page=${page}&limit=${limit}`
    );
  },

  async getMonitorIncidents(id: string, page = 1, limit = 20): Promise<{ incidents: Incident[]; pagination: { total: number; page: number; limit: number; pages: number } }> {
    return this.fetchWithAuth<{ incidents: Incident[]; pagination: { total: number; page: number; limit: number; pages: number } }>(
      `/api/v1/monitors/${id}/incidents?page=${page}&limit=${limit}`
    );
  },

  async getMonitorLatency(id: string, window: '24h' | '7d' | '30d' = '24h'): Promise<LatencyBucket[]> {
    return this.fetchWithAuth<LatencyBucket[]>(`/api/v1/monitors/${id}/latency?window=${window}`);
  },

  // Public status page endpoint (does not require auth token)
  async getPublicStatus(slug: string): Promise<PublicStatusResponse> {
    const res = await fetch(`${BASE_URL}/api/v1/status/${slug}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch public status page');
    }
    return data as PublicStatusResponse;
  },
};

export default api;


const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const config: RequestInit = {
    ...options,
    credentials: 'include', // Includes httpOnly cookies automatically
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  };

  try {
    const res = await fetch(url, config);

    // Handle 401 Unauthorized with token refresh (except for login/signup endpoints)
    if (res.status === 401 && !endpoint.includes('/auth/signin') && !endpoint.includes('/auth/signup') && !endpoint.includes('/auth/refresh')) {
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (refreshRes.ok) {
            processQueue(null);
            isRefreshing = false;
            // Retry initial request
            return apiRequest<T>(endpoint, options);
          } else {
            throw new Error('Refresh failed');
          }
        } catch (refreshErr) {
          processQueue(refreshErr);
          isRefreshing = false;
          throw new ApiError('Session expired. Please sign in again.', 401);
        }
      } else {
        // Queue request until refresh completes
        await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        return apiRequest<T>(endpoint, options);
      }
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(
        json.message || json.error || `Request failed with status ${res.status}`,
        res.status,
        json
      );
    }

    return json;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network error occurred', 0);
  }
}

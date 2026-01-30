const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

let isRedirecting = false;

function handleUnauthorized() {
  if (isRedirecting) return;
  
  isRedirecting = true;
  console.warn('[API Client] Unauthorized - redirecting to login');
  
  window.location.href = '/signin';
}

export const apiClient = {
  async get<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return (this as any).request(endpoint, {
      ...options,
      method: 'GET',
    });
  },

  async post<T = any>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return (this as any).request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async put<T = any>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return (this as any).request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async patch<T = any>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return (this as any).request(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async delete<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return (this as any).request(endpoint, {
      ...options,
      method: 'DELETE',
    });
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };
    
    if (import.meta.env.DEV) {
      console.log(`[API Client] ${options.method || 'GET'} ${url}`);
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
      
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Unauthorized - Please sign in again');
      }
      
      if (response.status === 403) {
        throw new Error('Access denied - Insufficient permissions');
      }
      
      if (!response.ok) {
        let errorMessage = `Request failed: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          // Response is not JSON
        }
        
        throw new Error(errorMessage);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        if (import.meta.env.DEV) {
          console.log(`[API Client] ${options.method || 'GET'} ${url} - Success`);
        }
        
        return data as T;
      }
      
      return (await response.text()) as unknown as T;
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[API Client] ${options.method || 'GET'} ${url} - Error:`, error);
      }
      
      throw error;
    }
  },
};

export function resetApiClient(): void {
  isRedirecting = false;
}

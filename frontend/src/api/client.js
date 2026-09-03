/**
 * API client for communicating with the CCTV Search backend.
 * Provides a simple wrapper around fetch to mimic Axios interface.
 */

const API_BASE = ''; // Empty since Vite proxies /api/v1 to backend

// Optional: set VITE_API_KEY in frontend/.env to match the backend's
// CCTV_API_KEY (see backend/app/config.py). Both are unset by default,
// so local dev keeps working with zero config.
// Fallback to localStorage if not built into the env
let currentApiKey = import.meta.env?.VITE_API_KEY || localStorage.getItem('API_KEY');

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  
  // Re-read from local storage in case it changed
  currentApiKey = currentApiKey || localStorage.getItem('API_KEY');

  const res = await fetch(url, {
    headers: { 
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(currentApiKey ? { 'X-API-Key': currentApiKey } : {}),
      ...options.headers 
    },
    ...options,
  });
  
  if (res.status === 401 || res.status === 403) {
    window.dispatchEvent(new Event('auth_required'));
    throw new Error('Authentication required');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    let message = `Request failed: ${res.status}`;
    if (typeof err.detail === 'string') {
      message = err.detail;
    } else if (Array.isArray(err.detail)) {
      message = err.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
    } else if (err.detail) {
      message = JSON.stringify(err.detail);
    }
    throw new Error(message);
  }
  
  return { data: await res.json(), status: res.status };
}

const apiClient = {
  get: (url, config = {}) => {
    let path = url;
    if (config.params) {
      // Filter out null/undefined/empty string params
      const cleaned = {};
      for (const [key, value] of Object.entries(config.params)) {
        if (value !== null && value !== undefined && value !== '') {
          cleaned[key] = value;
        }
      }
      const qs = new URLSearchParams(cleaned).toString();
      if (qs) path += `?${qs}`;
    }
    return request(path, { method: 'GET', ...config });
  },
  post: (url, data, config = {}) => {
    let body = data;
    if (!(data instanceof FormData) && typeof data === 'object') {
      body = JSON.stringify(data);
    }
    return request(url, { method: 'POST', body, ...config });
  },
  put: (url, data, config = {}) => {
    let body = data;
    if (!(data instanceof FormData) && typeof data === 'object') {
      body = JSON.stringify(data);
    }
    return request(url, { method: 'PUT', body, ...config });
  },
  delete: (url, config = {}) => {
    return request(url, { method: 'DELETE', ...config });
  }
};

export function mediaUrl(path) {
  if (!path) return '';
  const key = localStorage.getItem('API_KEY') || import.meta.env?.VITE_API_KEY;
  if (!key) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}api_key=${encodeURIComponent(key)}`;
}

export default apiClient;

/* =========================================================================
   api.js — single fetch wrapper for the whole frontend.
   Handles JWT, automatic token refresh on 401, and friendly errors.
   ========================================================================= */

(function (global) {
  const BASE_URL = (global.SMARTHABBIT_API_URL || 'http://localhost:3000') + '/api';

  const STORAGE = {
    access: 'sh_access_token',
    refresh: 'sh_refresh_token',
    user: 'sh_user'
  };

  function getAccess()   { return localStorage.getItem(STORAGE.access); }
  function getRefresh()  { return localStorage.getItem(STORAGE.refresh); }
  function getCachedUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE.user) || 'null'); }
    catch { return null; }
  }

  function setTokens({ accessToken, refreshToken, user }) {
    if (accessToken)  localStorage.setItem(STORAGE.access, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE.refresh, refreshToken);
    if (user)         localStorage.setItem(STORAGE.user, JSON.stringify(user));
  }

  function clearTokens() {
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
    localStorage.removeItem(STORAGE.user);
  }

  function isAuthed() {
    return !!getAccess();
  }

  // Custom error so calling code can branch on .status / .code
  class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  let refreshPromise = null;

  async function refreshAccessToken() {
    if (refreshPromise) return refreshPromise;
    const rt = getRefresh();
    if (!rt) return Promise.reject(new ApiError('No refresh token', 401, 'NO_REFRESH'));

    refreshPromise = fetch(BASE_URL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt })
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError('Refresh failed', res.status, 'REFRESH_FAILED');
        const json = await res.json();
        const data = json.data || json;
        if (data.accessToken)  localStorage.setItem(STORAGE.access, data.accessToken);
        if (data.refreshToken) localStorage.setItem(STORAGE.refresh, data.refreshToken);
        return data.accessToken;
      })
      .finally(() => { refreshPromise = null; });

    return refreshPromise;
  }

  async function parseError(res) {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const msg = body?.message || body?.error?.message || res.statusText || 'Request failed';
    const code = body?.error?.code || body?.code || 'HTTP_' + res.status;
    return new ApiError(msg, res.status, code, body);
  }

  async function request(method, path, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const token = getAccess();
    if (token && !opts.skipAuth) headers['Authorization'] = 'Bearer ' + token;

    const init = { method, headers };
    if (body !== undefined && body !== null) init.body = JSON.stringify(body);

    let res = await fetch(BASE_URL + path, init);

    // One automatic refresh attempt on 401
    if (res.status === 401 && !opts.skipAuth && !opts.isRetry && getRefresh()) {
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          headers['Authorization'] = 'Bearer ' + newToken;
          res = await fetch(BASE_URL + path, { method, headers, body: init.body });
        }
      } catch {
        clearTokens();
        if (!location.pathname.endsWith('login.html') &&
            !location.pathname.endsWith('register.html') &&
            !location.pathname.endsWith('index.html')) {
          location.replace('login.html');
        }
        throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
      }
    }

    if (!res.ok) throw await parseError(res);

    // Some endpoints (e.g., 204 No Content) have no body
    if (res.status === 204) return null;
    const json = await res.json();
    // Convention: backend wraps payload as { success, data: {...} }
    return json.data ?? json;
  }

  const api = {
    BASE_URL,
    isAuthed,
    getCachedUser,
    setTokens,
    clearTokens,
    ApiError,
    get:    (path, opts) => request('GET',    path, null, opts),
    post:   (path, body, opts) => request('POST',   path, body, opts),
    put:    (path, body, opts) => request('PUT',    path, body, opts),
    patch:  (path, body, opts) => request('PATCH',  path, body, opts),
    delete: (path, opts) => request('DELETE', path, null, opts)
  };

  global.api = api;
})(window);

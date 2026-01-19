import { session, clearSession, loadSessionSafe } from "../stores/session.js";

async function ensureCsrfToken(method, options) {
  if (options.ensureCsrf === false) return;
  if (method === "GET" || method === "HEAD") return;
  if (!session.csrfToken) {
    await loadSessionSafe();
  }
}

export async function apiRequest(path, options = {}) {
  const fetchOptions = {
    method: options.method || "GET",
    headers: Object.assign({ Accept: "application/json" }, options.headers || {}),
    credentials: "same-origin"
  };

  await ensureCsrfToken(fetchOptions.method, options);

  if (options.body !== undefined) {
    if (typeof options.body === "string") {
      fetchOptions.body = options.body;
    } else {
      fetchOptions.body = JSON.stringify(options.body);
      fetchOptions.headers["Content-Type"] = "application/json";
    }
  }

  if (fetchOptions.method !== "GET" && session.csrfToken) {
    fetchOptions.headers["X-CSRF-Token"] = session.csrfToken;
  }

  const res = await fetch(path, fetchOptions);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    if (
      res.status === 403 &&
      payload.error === "Invalid CSRF token." &&
      options.retryOnCsrf !== false &&
      !options._retried
    ) {
      await loadSessionSafe();
      if (session.csrfToken) {
        return apiRequest(path, { ...options, _retried: true });
      }
    }
    if (res.status === 401 && options.skipAuthRedirect !== true) {
      clearSession();
      window.dispatchEvent(new Event("app:unauthorized"));
    }
    const message = payload.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

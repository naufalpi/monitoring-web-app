import { reactive } from "vue";

export const session = reactive({
  user: null,
  csrfToken: null,
  capabilities: {},
  loaded: false
});

export function setSession(data) {
  session.user = data.user || null;
  session.csrfToken = data.csrfToken || null;
  session.capabilities = data.capabilities || {};
  session.loaded = true;
}

export function clearSession() {
  session.user = null;
  session.csrfToken = null;
  session.capabilities = {};
  session.loaded = true;
}

export async function loadSessionSafe() {
  try {
    const res = await fetch("/api/session", {
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data = await res.json();
    setSession(data);
    return data;
  } catch (error) {
    clearSession();
    return null;
  }
}

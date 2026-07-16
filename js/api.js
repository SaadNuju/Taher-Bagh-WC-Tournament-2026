/* ============================================================
   API layer — talks to Cloudflare Pages Functions (/api/*).
   Falls back to a local "demo mode" (default-state.json +
   localStorage) when no backend is reachable, so the site
   still works when opened as a plain static page.
   ============================================================ */

const API = (() => {
  const LOCAL_KEY = "tbwc26-state";
  const TOKEN_KEY = "tbwc26-token";
  const DEMO_PASSWORD = "admin";

  let mode = null; // "live" | "demo"

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function isAdmin() {
    return !!getToken();
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function loadDefaultState() {
    return fetchJSON("data/default-state.json");
  }

  async function loadState() {
    // Try the live backend first.
    try {
      const data = await fetchJSON("/api/state");
      mode = "live";
      if (data && data.state) return data.state;
      // Backend reachable but KV empty — seed with defaults.
      return await loadDefaultState();
    } catch (e) {
      mode = "demo";
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) {
        try { return JSON.parse(saved); } catch (_) { /* corrupted — reset */ }
      }
      return loadDefaultState();
    }
  }

  async function saveState(state) {
    state.updatedAt = new Date().toISOString();
    state.version = (state.version || 0) + 1;
    if (mode === "live") {
      // Retry transient failures (KV hiccups, brief network drops at the
      // venue) — but not auth/validation errors, which won't fix themselves.
      let lastErr;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await fetchJSON("/api/state", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + getToken(),
            },
            body: JSON.stringify({ state }),
          });
          return state;
        } catch (e) {
          lastErr = e;
          if (e.status === 401 || e.status === 400) throw e;
          await new Promise((r) => setTimeout(r, 700 * attempt));
        }
      }
      throw lastErr;
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    return state;
  }

  async function login(password) {
    if (mode === "live") {
      const data = await fetchJSON("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setToken(data.token);
      return true;
    }
    // Demo mode: fixed local password so the panel is usable offline.
    if (password === DEMO_PASSWORD) {
      setToken("demo-session");
      return true;
    }
    throw new Error("Incorrect password");
  }

  function logout() {
    setToken("");
  }

  /** Lightweight check for remote updates; returns new state or null. */
  async function pollState(currentUpdatedAt) {
    if (mode !== "live") return null;
    try {
      const data = await fetchJSON("/api/state");
      if (data && data.state && data.state.updatedAt !== currentUpdatedAt) {
        return data.state;
      }
    } catch (_) { /* transient network issue — keep current state */ }
    return null;
  }

  return {
    loadState, saveState, login, logout, pollState, isAdmin,
    get mode() { return mode; },
  };
})();

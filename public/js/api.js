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

  const CURRENT_SCHEMA = 3;

  /**
   * Bring any older stored state up to the current schema. Team edits
   * (name/captain/players/goalkeeper) are carried over by country code
   * for teams that still exist in the canonical roster; removed
   * countries are dropped and new ones added as placeholders. Because
   * the roster can change between schema versions, the draw and matches
   * are reset to the fresh knockout skeleton (any prior draw must be
   * redone). Announcements and homepage media are preserved. Idempotent.
   */
  async function normalize(state) {
    if (state && state.schema === CURRENT_SCHEMA) return state;
    const fresh = await loadDefaultState();
    if (!state) return fresh;
    if (Array.isArray(state.teams)) {
      fresh.teams = fresh.teams.map((ft) => {
        const old = state.teams.find((t) => t.id === ft.id); // match by country code
        if (!old) return ft;
        const players = Array.isArray(old.players) && old.players.length
          ? old.players.slice(0, 10)
          : ft.players;
        return {
          ...ft,
          teamName: old.teamName || ft.teamName,
          captain: old.captain || ft.captain,
          goalkeeper: players.includes(old.goalkeeper) ? old.goalkeeper : "",
          players,
        };
      });
    }
    if (Array.isArray(state.announcements) && state.announcements.length) {
      fresh.announcements = state.announcements;
    }
    if (Array.isArray(state.media)) fresh.media = state.media;
    // settings (incl. the tournament name) stay canonical from defaults.
    return fresh;
  }

  async function loadState() {
    // Try the live backend first.
    try {
      const data = await fetchJSON("/api/state");
      mode = "live";
      return await normalize(data && data.state);
    } catch (e) {
      mode = "demo";
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) {
        try { return await normalize(JSON.parse(saved)); } catch (_) { /* corrupted — reset */ }
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
      if (data && data.state && data.state.schema === CURRENT_SCHEMA &&
          data.state.updatedAt !== currentUpdatedAt) {
        return data.state;
      }
    } catch (_) { /* transient network issue — keep current state */ }
    return null;
  }

  /** Count one visit per browser session (fire-and-forget). */
  function recordVisit() {
    if (sessionStorage.getItem("tbwc26-visited")) return;
    sessionStorage.setItem("tbwc26-visited", "1");
    fetch("/api/visit", { method: "POST" }).catch(() => {});
  }

  /** Daily visit counts (admin only). Returns {"YYYY-MM-DD": n, ...}. */
  async function getVisits() {
    if (mode !== "live") return {};
    const data = await fetchJSON("/api/visits", {
      headers: { "Authorization": "Bearer " + getToken() },
    });
    return data.visits || {};
  }

  return {
    loadState, saveState, login, logout, pollState, isAdmin,
    recordVisit, getVisits,
    get mode() { return mode; },
  };
})();

/* ============================================================
   Cloudflare Worker for the Taher Bagh World Cup site.

   - Serves the static site from the assets binding.
   - /api/login  → checks the password against ADMIN_PASSWORD_HASH
     (only the SHA-256 hash lives in config — never the password)
     and mints a session token stored in the Durable Object.
   - /api/state  → tournament state, stored in a single
     Durable Object instance (SQLite-backed, free plan) so no
     KV namespace or dashboard setup is needed.
   ============================================================ */

import { sha256Hex, safeEqual, randomToken, json, TOKEN_TTL_MS } from "./auth.js";

/** Singleton Durable Object: tournament state + admin sessions. */
export class TournamentState {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async validSessions() {
    const sessions = (await this.ctx.storage.get("sessions")) || {};
    const now = Date.now();
    let pruned = false;
    for (const [token, exp] of Object.entries(sessions)) {
      if (exp < now) { delete sessions[token]; pruned = true; }
    }
    if (pruned) await this.ctx.storage.put("sessions", sessions);
    return sessions;
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/do/session" && request.method === "POST") {
      const sessions = await this.validSessions();
      const token = randomToken();
      sessions[token] = Date.now() + TOKEN_TTL_MS;
      await this.ctx.storage.put("sessions", sessions);
      return json({ token });
    }

    if (pathname === "/do/verify" && request.method === "POST") {
      const { token } = await request.json();
      const sessions = await this.validSessions();
      return json({ valid: !!token && !!sessions[token] });
    }

    if (pathname === "/do/visit" && request.method === "POST") {
      const visits = (await this.ctx.storage.get("visits")) || {};
      const day = new Date().toISOString().slice(0, 10);
      visits[day] = (visits[day] || 0) + 1;
      await this.ctx.storage.put("visits", visits);
      return json({ ok: true });
    }

    if (pathname === "/do/visits" && request.method === "POST") {
      return json({ visits: (await this.ctx.storage.get("visits")) || {} });
    }

    if (request.method === "GET") {
      const state = await this.ctx.storage.get("state");
      return json({ state: state ?? null });
    }

    if (request.method === "POST") {
      const { state } = await request.json();
      await this.ctx.storage.put("state", state);
      return json({ ok: true, updatedAt: state.updatedAt });
    }

    return json({ error: "Method not allowed" }, 405);
  }
}

function stateStub(env) {
  return env.TOURNAMENT_DO.get(env.TOURNAMENT_DO.idFromName("tournament"));
}

function doRequest(request, path, body) {
  const url = new URL(request.url);
  url.pathname = path;
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function handleLogin(request, env) {
  if (!env.ADMIN_PASSWORD_HASH) {
    return json({ error: "Admin password not configured." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid request" }, 400);
  }

  const suppliedHash = await sha256Hex(String(body.password || ""));
  if (!safeEqual(suppliedHash, String(env.ADMIN_PASSWORD_HASH).toLowerCase())) {
    return json({ error: "Incorrect password" }, 401);
  }

  return stateStub(env).fetch(doRequest(request, "/do/session", {}));
}

async function handleState(request, env) {
  if (request.method === "GET") {
    return stateStub(env).fetch(request);
  }

  if (request.method === "POST") {
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const verdict = await (await stateStub(env)
      .fetch(doRequest(request, "/do/verify", { token }))).json();
    if (!verdict.valid) {
      return json({ error: "Not authorised" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const state = body && body.state;
    if (!state || typeof state !== "object" || !Array.isArray(state.teams) || !state.draw) {
      return json({ error: "Malformed tournament state" }, 400);
    }
    // The tournament is always exactly 32 teams / 32 matches — reject any
    // save that would silently truncate the canonical live record (e.g. a
    // buggy client sending a partial snapshot) rather than storing it.
    if (state.teams.length !== 32 || !Array.isArray(state.matches) || state.matches.length !== 32) {
      return json({ error: "Rejected: state must contain exactly 32 teams and 32 matches" }, 400);
    }

    return stateStub(env).fetch(new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    }));
  }

  return json({ error: "Method not allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/login" && request.method === "POST") {
      return handleLogin(request, env);
    }
    if (pathname === "/api/state") {
      return handleState(request, env);
    }
    if (pathname === "/api/visit" && request.method === "POST") {
      return stateStub(env).fetch(doRequest(request, "/do/visit", {}));
    }
    if (pathname === "/api/visits" && request.method === "GET") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const verdict = await (await stateStub(env)
        .fetch(doRequest(request, "/do/verify", { token }))).json();
      if (!verdict.valid) return json({ error: "Not authorised" }, 401);
      return stateStub(env).fetch(doRequest(request, "/do/visits", {}));
    }
    if (pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

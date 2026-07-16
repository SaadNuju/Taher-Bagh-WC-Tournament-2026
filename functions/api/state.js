import { verifyToken, json } from "./_auth.js";

const KV_KEY = "tournament-state";

export async function onRequestGet({ env }) {
  if (!env.TOURNAMENT_KV) {
    return json({ error: "KV namespace TOURNAMENT_KV is not bound. Add it in Cloudflare Pages settings." }, 500);
  }
  const raw = await env.TOURNAMENT_KV.get(KV_KEY);
  return json({ state: raw ? JSON.parse(raw) : null });
}

export async function onRequestPost({ request, env }) {
  if (!env.TOURNAMENT_KV) {
    return json({ error: "KV namespace TOURNAMENT_KV is not bound. Add it in Cloudflare Pages settings." }, 500);
  }

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!(await verifyToken(env.ADMIN_PASSWORD, token))) {
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

  await env.TOURNAMENT_KV.put(KV_KEY, JSON.stringify(state));
  return json({ ok: true, updatedAt: state.updatedAt });
}

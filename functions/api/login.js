import { createToken, json } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "Admin password not configured. Set the ADMIN_PASSWORD secret in Cloudflare Pages settings." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid request" }, 400);
  }

  const supplied = String(body.password || "");
  const expected = String(env.ADMIN_PASSWORD);

  // Constant-time comparison to avoid timing leaks
  let diff = supplied.length === expected.length ? 0 : 1;
  for (let i = 0; i < Math.min(supplied.length, expected.length); i++) {
    diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }

  if (diff !== 0) {
    return json({ error: "Incorrect password" }, 401);
  }

  const token = await createToken(expected);
  return json({ token });
}

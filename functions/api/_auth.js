/* Shared auth helpers for the Pages Functions API.
   Tokens are HMAC-signed expiry timestamps, keyed off the
   admin password — no server-side session storage needed. */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createToken(secret) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = await hmac(secret, String(exp));
  return `${exp}.${sig}`;
}

export async function verifyToken(secret, token) {
  if (!secret || !token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  const expected = await hmac(secret, expStr);
  if (sig.length !== expected.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

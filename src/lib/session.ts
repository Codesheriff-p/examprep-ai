import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type SessionPayload = { userId: string; expiresAt: string };

// Where the cookie-signing secret comes from, in order:
// 1. SESSION_SECRET.
// 2. Derived from the database auth token (DATABASE_AUTH_TOKEN / TURSO_AUTH_TOKEN). It's
//    already a secret shared by every server copy, so a deploy with a hosted database needs
//    no extra setting. Hashed with a label so the signing key never equals the token itself.
// 3. On Vercel with neither (temporary database): a random key per server instance.
//    Never a fixed fallback: anyone could forge cookies.
const DB_TOKEN = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
const globalForSession = globalThis as unknown as { sessionKey?: Promise<Uint8Array> };

/** False when cookies are signed with a per-instance key the proxy can't share. */
export const SESSION_SECRET_CONFIGURED = Boolean(process.env.SESSION_SECRET || DB_TOKEN);

async function deriveKey() {
  if (process.env.SESSION_SECRET) return new TextEncoder().encode(process.env.SESSION_SECRET);
  if (DB_TOKEN) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`examprep-session:${DB_TOKEN}`));
    return new Uint8Array(digest);
  }
  if (process.env.VERCEL) return new TextEncoder().encode(crypto.randomUUID() + crypto.randomUUID());
  throw new Error("SESSION_SECRET is not set. See .env.example.");
}

function key() {
  return (globalForSession.sessionKey ??= deriveKey().catch((err) => {
    globalForSession.sessionKey = undefined;
    throw err;
  }));
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  // Outside the try: a missing secret is a setup error, not an invalid cookie.
  const secret = await key();
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secret, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  const token = await encrypt({ userId, expiresAt: expiresAt.toISOString() });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function readSession() {
  const store = await cookies();
  return decrypt(store.get(COOKIE)?.value);
}

/** Whether the request carries a session cookie at all, valid or not. */
export async function hasSessionCookie() {
  return (await cookies()).has(COOKIE);
}

export const SESSION_COOKIE = COOKIE;

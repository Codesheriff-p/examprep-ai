import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type SessionPayload = { userId: string; expiresAt: string };

// On Vercel without SESSION_SECRET (a quick test deploy), sign cookies with a random key for
// this server instance. Sessions then end when the instance restarts, just like the
// temporary database (see src/lib/db.ts). Never a fixed fallback: anyone could forge cookies.
const globalForSession = globalThis as unknown as { sessionSecret?: string };

/** False when cookies are signed with a per-instance key the proxy can't share. */
export const SESSION_SECRET_CONFIGURED = Boolean(process.env.SESSION_SECRET);

function key() {
  let secret = process.env.SESSION_SECRET;
  if (!secret && process.env.VERCEL) {
    secret = globalForSession.sessionSecret ??= crypto.randomUUID() + crypto.randomUUID();
  }
  if (!secret) throw new Error("SESSION_SECRET is not set. See .env.example.");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key(), { algorithms: ["HS256"] });
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

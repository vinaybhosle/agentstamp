import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { timingSafeEqual, createHmac } from "crypto";

const COOKIE_NAME = "agentstamp-admin-session";
const SESSION_DURATION = 8 * 60 * 60; // 8 hours in seconds

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not configured");
  return new TextEncoder().encode(secret);
}

export async function createSession(): Promise<string> {
  const token = await new SignJWT({ sub: "admin", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());

  return token;
}

export async function verifySession(
  token: string
): Promise<{ valid: boolean; payload?: Record<string, unknown> }> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { valid: true, payload: payload as Record<string, unknown> };
  } catch {
    return { valid: false };
  }
}

export async function getSessionFromCookies(): Promise<{
  valid: boolean;
  payload?: Record<string, unknown>;
}> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie?.value) return { valid: false };
  return verifySession(sessionCookie.value);
}

export function validatePassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  try {
    // HMAC both to fixed-length digests — avoids length timing leak
    const key = "agentstamp-compare";
    const hashA = createHmac("sha256", key).update(password).digest();
    const hashB = createHmac("sha256", key).update(expected).digest();
    return timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}

export { COOKIE_NAME, SESSION_DURATION };

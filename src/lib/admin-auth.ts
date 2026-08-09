import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Admin auth helpers. Passwords are stored as scrypt-salted hashes
 * (`salt:hash`, hex) in the `admin_users` table — never plaintext.
 *
 * The session cookie holds `username.sha256(username:passwordHash)`, which
 * lets the stats route re-derive and verify the token from the DB without a
 * separate sessions table, and invalidates all sessions when the password
 * changes.
 */

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Deterministic session token derived from stored identity. */
export function sessionToken(username: string, passwordHash: string): string {
  return `${username}.${hash(`${username}:${passwordHash}`)}`;
}

/** Parse and verify a session cookie against the stored admin row. */
export function verifySessionToken(
  cookieValue: string | undefined,
  username: string | undefined,
  passwordHash: string | undefined
): boolean {
  if (!cookieValue || !username || !passwordHash) return false;
  const expected = sessionToken(username, passwordHash);
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Create or update an admin user in the `admin_users` table.
 *
 * Usage:
 *   ADMIN_USERNAME=shantanu ADMIN_PASSWORD='...' node scripts/create-admin.mjs
 *
 * Password is stored as a scrypt-salted hash — never plaintext.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const lines = readFileSync(resolve(".env.local"), "utf8").split("\n");
    for (const line of lines) {
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // no .env.local — rely on process env
  }
}

loadEnv();

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
  console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derived = scryptSync(password, salt, 64).toString("hex");
const passwordHash = `${salt}:${derived}`;

const admin = createClient(url, key, { auth: { persistSession: false } });

const { error } = await admin.from("admin_users").upsert(
  { username, password_hash: passwordHash },
  { onConflict: "username" }
);

if (error) {
  console.error("Failed to save admin user:", error.message);
  process.exit(1);
}

console.log(`Admin user "${username}" saved (password hash rotated).`);

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvFile(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

loadEnvFile(".env.test.local");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.test.local`);
  return value;
}

export const url = required("NEXT_PUBLIC_SUPABASE_URL");
export const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
export const secretKey = required("SUPABASE_SECRET_KEY");

export const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function userClient(accessToken: string): SupabaseClient {
  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createOwner(email: string) {
  const password = "test-password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const signedIn = await createClient(url, publishableKey).auth.signInWithPassword({
    email,
    password,
  });
  if (signedIn.error) throw signedIn.error;
  return { id: data.user.id, client: userClient(signedIn.data.session.access_token) };
}

export async function deleteOwner(id: string) {
  await admin.auth.admin.deleteUser(id);
}

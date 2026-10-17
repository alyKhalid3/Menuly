import "server-only";
import { publicEnv } from "@/lib/env";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function serverEnv() {
  return {
    ...publicEnv(),
    secretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  };
}

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const authSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

export async function signUp(formData: FormData) {
  "use server";
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: error.message };
  if (!data.session) return { error: "Check your email to confirm the account, then log in." };
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  "use server";
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email or password is wrong." };
  redirect("/dashboard");
}

export async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

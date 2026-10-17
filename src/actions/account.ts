"use server";

import { redirect } from "next/navigation";
import { deleteOwnerAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export async function deleteAccount() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  await deleteOwnerAccount(userId);
  await supabase.auth.signOut();
  redirect("/");
}

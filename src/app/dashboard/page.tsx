import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const email = data.claims.email as string | undefined;

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Your menu</h1>
      <p className="mt-2">Signed in as {email}</p>
      <p className="mt-6">You have not created a menu yet.</p>
      <form action={signOut} className="mt-8">
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}

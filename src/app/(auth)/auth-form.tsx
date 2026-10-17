"use client";

import { useActionState } from "react";

type AuthAction = (formData: FormData) => Promise<{ error: string } | void>;

export function AuthForm({ action, submitLabel }: { action: AuthAction; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => (await action(formData)) ?? null,
    null,
  );
  return (
    <form action={formAction} className="mx-auto flex max-w-sm flex-col gap-3 px-6 py-16">
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" className="block w-full border p-2" />
      </label>
      <label>
        Password
        <input name="password" type="password" required minLength={8} autoComplete="current-password" className="block w-full border p-2" />
      </label>
      {state?.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>{submitLabel}</button>
    </form>
  );
}

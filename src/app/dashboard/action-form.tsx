"use client";

import { useActionState } from "react";

type MenuAction = (formData: FormData) => Promise<{ error: string } | void>;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: MenuAction;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: { error: string } | null, formData: FormData) => (await action(formData)) ?? null,
    null,
  );
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="min-w-0 border-0 p-0">
        {children}
      </fieldset>
      {state?.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { checkSlug, confirmSlug } from "@/actions/slug";
import { ActionForm } from "./action-form";

export function SlugPanel({ slug, origin }: { slug: string | null; origin: string }) {
  if (slug) {
    const url = `${origin}/${slug}`;
    return (
      <section className="grid gap-3 border p-4">
        <h2 className="text-lg font-semibold">Public link</h2>
        <p>
          <a href={url}>{url}</a>
        </p>
        <p>This name is final. Printed QR codes keep working when you edit the menu.</p>
        <img src="/dashboard/qr?format=png" alt="QR code for the menu" className="h-40 w-40" />
        <p className="flex gap-4">
          <a href="/dashboard/qr?format=png" download={`menuly-${slug}.png`}>Download PNG</a>
          <a href="/dashboard/qr?format=svg" download={`menuly-${slug}.svg`}>Download SVG</a>
        </p>
      </section>
    );
  }
  return <SlugChooser />;
}

function SlugChooser() {
  const [checked, setChecked] = useState<{ status: string; slug: string; error?: string } | null>(null);
  const [state, formAction, pending] = useActionState(
    async (_previous: { status: string; slug: string; error?: string } | null, formData: FormData) => {
      const result = await checkSlug(formData);
      setChecked(result);
      return result;
    },
    null,
  );
  const result = state ?? checked;
  return (
    <section className="grid gap-3 border p-4">
      <h2 className="text-lg font-semibold">Public link</h2>
      <p>Choose the name in your link. After you confirm it, it can never be changed.</p>
      <form action={formAction} className="grid gap-3">
        <label>
          Name
          <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={40} placeholder="cafe-roma" className="block w-full border p-2" />
        </label>
        <button type="submit" disabled={pending}>Check name</button>
      </form>
      {result?.status === "invalid" ? <p role="alert">Use 3 to 40 lowercase letters, digits, and single hyphens.</p> : null}
      {result?.status === "taken" ? <p role="alert">That name is taken.</p> : null}
      {result?.status === "error" ? <p role="alert">{result.error}</p> : null}
      {result?.status === "available" ? (
        <ActionForm action={confirmSlug} className="grid gap-3">
          <input type="hidden" name="slug" value={result.slug} />
          <input type="hidden" name="final" value="yes" />
          <p>
            <strong>{result.slug}</strong> is available. This name is final. A printed QR code will break if it ever changes, so it cannot be changed after you confirm.
          </p>
          <button type="submit">Confirm this name</button>
        </ActionForm>
      ) : null}
    </section>
  );
}

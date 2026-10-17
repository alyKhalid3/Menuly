import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Menuly</h1>
      <p className="mt-4 text-lg">
        Build a digital menu, get a permanent link and a QR code, and edit it any time.
      </p>
      <p className="mt-8 flex gap-4">
        <Link href="/signup">Create an account</Link>
        <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}

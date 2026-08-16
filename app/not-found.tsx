import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg">
      <p className="serif text-6xl italic">404</p>
      <p className="mt-4 text-lg text-muted">That page is not on the ledger.</p>
      <Link href="/" className="mt-8 inline-block text-sm underline-offset-4 hover:underline">
        Home
      </Link>
    </div>
  );
}

import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <Link href="/dashboard" className="mt-3 inline-block text-accent">Back to dashboard</Link>
      </div>
    </main>
  );
}

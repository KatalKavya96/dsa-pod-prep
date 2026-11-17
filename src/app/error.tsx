"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted">Please try again. If it keeps happening, tell a POD lead.</p>
        <button onClick={reset} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm text-accent-fg">Try again</button>
      </div>
    </main>
  );
}

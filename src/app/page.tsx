import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui";
import { getSessionUser } from "@/server/auth/session";

export default async function Landing() {
  if (await getSessionUser()) redirect("/dashboard");
  const features = [
    ["⏱️", "Every contest, one place", "LeetCode, Codeforces, CodeChef and POD/Newton contests with live countdowns and reminders."],
    ["🎯", "Tasks that count", "Practice sets, contests and activities from your leads. Your attendance updates automatically."],
    ["📚", "Curated by topic", "Hand-picked problems per topic, with why each one matters."],
    ["🏅", "Milestones", "Five levels, each with its own badge and title. See exactly what's left to reach the next."],
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-16">
      <div className="max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">DSA POD · prep tracker</div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Consistent practice, tracked.</h1>
        <p className="mt-4 text-lg text-muted">
          Contests, curated resources, tasks and milestones for every member of the POD, all in one dashboard.
        </p>
        <div className="mt-8 flex gap-3">
          <LinkButton href="/login">Sign in to continue</LinkButton>
        </div>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-2">
        {features.map(([icon, title, body]) => (
          <div key={title} className="rounded-xl border border-border bg-surface p-5">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 font-semibold">{title}</div>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

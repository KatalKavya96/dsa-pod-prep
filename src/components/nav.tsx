import Link from "next/link";
import type { SessionUser } from "@/server/auth/session";
import { unreadCount } from "@/server/modules/notifications/inbox";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out";

export async function Nav({ user }: { user: SessionUser }) {
  const unread = await unreadCount(user.id);
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/contests", label: "Contests" },
    { href: "/tasks", label: "Tasks" },
    { href: "/resources", label: "Resources" },
    { href: "/leaderboard", label: "Leaderboard" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-sm text-accent-fg">{"</>"}</span>
          <span className="hidden sm:inline">DSA POD</span>
        </Link>
        <NavLinks links={links} />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/notifications" className="relative rounded-md p-2 hover:bg-surface-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <span aria-hidden>🔔</span>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-1 hover:bg-surface-2">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{user.name.slice(0, 1).toUpperCase()}</span>
              )}
            </summary>
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-border bg-surface p-1 shadow-lg">
              <div className="px-3 py-2 text-xs text-muted">
                <div className="truncate font-medium text-text">{user.name}</div>
                <div className="truncate">{user.email}</div>
              </div>
              {user.username && <Link className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2" href={`/u/${user.username}`}>My profile</Link>}
              <Link className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2" href="/settings/handles">Linked handles</Link>
              <SignOutButton />
            </div>
          </details>
        </div>
      </div>
      <div className="md:hidden">
        <NavLinks links={links} mobile />
      </div>
    </header>
  );
}

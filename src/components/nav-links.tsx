"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links, mobile }: { links: { href: string; label: string }[]; mobile?: boolean }) {
  const path = usePathname();
  return (
    <nav className={clsx(mobile ? "flex gap-1 overflow-x-auto px-3 pb-2" : "hidden gap-1 md:flex")}>
      {links.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={clsx("rounded-md px-3 py-1.5 text-sm whitespace-nowrap", active ? "bg-surface-2 font-medium" : "text-muted hover:text-text")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

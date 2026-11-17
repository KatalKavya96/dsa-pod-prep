import { NavLinks } from "@/components/nav-links";
import { requireAdmin } from "@/server/auth/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const links = [
    { href: "/admin/overview", label: "Overview" },
    { href: "/admin/tasks", label: "Tasks" },
    { href: "/admin/contests", label: "Contests" },
    { href: "/admin/resources", label: "Resources" },
    { href: "/admin/members", label: "Members" },
    { href: "/admin/alerts", label: "Inactive alerts" },
    { href: "/admin/milestones", label: "Milestones" },
  ];
  return (
    <div>
      <div className="-mt-2 mb-6 border-b border-border pb-2">
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Admin</div>
        <NavLinks links={links} mobile />
      </div>
      {children}
    </div>
  );
}

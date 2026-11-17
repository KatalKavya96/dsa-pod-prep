import Link from "next/link";
import { markNotificationsReadAction } from "@/app/actions/member";
import { LocalTime } from "@/components/countdown";
import { Button, Card, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { listNotifications } from "@/server/modules/notifications/inbox";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const u = await requireUser();
  const items = await listNotifications(u.id, 50);
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Notifications"
        action={items.some((n) => !n.readAt) ? <form action={markNotificationsReadAction}><Button variant="secondary">Mark all read</Button></form> : undefined}
      />
      {items.length === 0 ? (
        <Empty>You&apos;re all caught up.</Empty>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className={`p-4 ${n.readAt ? "" : "bg-accent/5"}`}>
                <div className="flex justify-between gap-3">
                  <div className="font-medium">{!n.readAt && <span className="mr-2 inline-block size-2 rounded-full bg-accent" />}{n.title}</div>
                  <span className="shrink-0 text-xs text-muted"><LocalTime iso={n.createdAt.toISOString()} /></span>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
                {n.link && n.link.startsWith("/") && <Link href={n.link} className="mt-1 inline-block text-sm text-accent">Open →</Link>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

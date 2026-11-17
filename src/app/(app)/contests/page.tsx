import { PageHeader } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getUpcomingContestsCached } from "@/server/cache";
import { listAssignmentsForMember } from "@/server/modules/assignments/service";
import { ContestList } from "./contest-list";

export const metadata = { title: "Contests" };

export default async function ContestsPage() {
  const u = await requireUser();
  const [contests, tasks] = await Promise.all([getUpcomingContestsCached(), listAssignmentsForMember(u)]);
  const assigned = Object.fromEntries(
    tasks.filter((t) => t.a.contestId).map((t) => [t.a.contestId!, { assignmentId: t.a.id, registered: Boolean(t.registeredAt) }]),
  );
  return (
    <div>
      <PageHeader title="Contests" subtitle="Live and upcoming contests across platforms. Times are shown in your timezone." />
      <ContestList contests={contests} assigned={assigned} />
    </div>
  );
}

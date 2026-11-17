import { PageHeader } from "@/components/ui";
import { listUpcomingContests } from "@/server/modules/contests/service";
import { listBatches } from "@/server/modules/users/service";
import { TaskForm } from "./task-form";

export const metadata = { title: "Admin · New task" };

export default async function NewTask() {
  const [contests, batches] = await Promise.all([listUpcomingContests(200), listBatches()]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New task" subtitle="Assign a contest, a practice set or an activity. Members see it immediately, and progress is tracked automatically where possible." />
      <TaskForm contests={contests.map((c) => ({ id: c.id, label: `${c.title} (${c.platform}, ${c.startsAt.slice(0, 10)})`, startsAt: c.startsAt, durationSeconds: c.durationSeconds }))} batches={batches} />
    </div>
  );
}

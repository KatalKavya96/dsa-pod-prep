import { Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getTopicsCached } from "@/server/cache";
import { getDoneResourceIds } from "@/server/modules/resources/service";
import { ResourceBrowser } from "./resource-browser";

export const metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const u = await requireUser();
  const [topics, done] = await Promise.all([getTopicsCached(), getDoneResourceIds(u.id)]);
  return (
    <div>
      <PageHeader title="Resources" subtitle="Curated problems and material, topic by topic. Tick items off as you go." />
      {topics.length === 0 ? <Empty>No topics yet. Your POD leads will add them soon.</Empty> : <ResourceBrowser topics={topics} done={done} />}
    </div>
  );
}

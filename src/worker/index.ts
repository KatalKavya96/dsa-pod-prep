/** CLI: `pnpm worker <job> [<job> ...]` */
import "../../scripts/load-env";
import { isJobName, runJob } from "./jobs";

async function main() {
  const names = process.argv.slice(2);
  if (!names.length || !names.every(isJobName)) {
    console.error("usage: pnpm worker <sync-contests|sync-members|evaluate|reminders|inactive-digest|seed-milestones>...");
    process.exit(2);
  }
  for (const n of names) {
    const t = Date.now();
    const out = await runJob(n);
    console.log(JSON.stringify({ job: n, ms: Date.now() - t, out }));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

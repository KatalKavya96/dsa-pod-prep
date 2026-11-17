import { Badge } from "./ui";

export function StatusBadge({ status }: { status: "pending" | "attempted" | "completed" | null | undefined }) {
  if (status === "completed") return <Badge tone="good">Completed</Badge>;
  if (status === "attempted") return <Badge tone="warn">Attempted</Badge>;
  return <Badge>Not started</Badge>;
}

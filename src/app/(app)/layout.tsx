import { Nav } from "@/components/nav";
import { requireUser } from "@/server/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}

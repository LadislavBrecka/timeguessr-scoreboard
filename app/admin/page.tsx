import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getRoundsWithTotals } from "@/app/actions";
import { AdminEvents } from "@/app/components/AdminEvents";
import { authOptions, isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    redirect("/");
  }
  const initialRounds = await getRoundsWithTotals();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <AdminEvents initialRounds={initialRounds} />
    </main>
  );
}

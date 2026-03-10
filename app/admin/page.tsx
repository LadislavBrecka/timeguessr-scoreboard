import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getRoundsWithTotals } from "@/app/actions";
import { AdminRounds } from "@/app/components/AdminRounds";
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
      <AdminRounds initialRounds={initialRounds} />
    </main>
  );
}

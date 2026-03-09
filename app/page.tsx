import { getServerSession } from "next-auth";
import { getRoundsWithTotals, getScoreboardByPlayer } from "@/app/actions";
import { Scoreboard } from "@/app/components/Scoreboard";
import { authOptions, isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialRounds, initialPlayers, session] = await Promise.all([
    getRoundsWithTotals(),
    getScoreboardByPlayer(),
    getServerSession(authOptions),
  ]);
  const isAdmin = isAdminSession(session);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 sm:text-3xl">
          TimeGuessr Scoreboard
        </h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          Players ranked by total score across all events. Expand a player to see
          events, games, and guess details.
        </p>
      </header>
      <Scoreboard
        initialRounds={initialRounds}
        initialPlayers={initialPlayers}
        isAdmin={isAdmin}
      />
    </main>
  );
}

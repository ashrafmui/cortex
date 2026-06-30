import { getCurrentUser, getSessionsForUser } from "@/lib/queries";
import HistoryView from "@/components/history/history-view";

export default async function HistoryPage() {
  const { dbUser } = await getCurrentUser();
  if (!dbUser) return <HistoryView sessions={[]} />;

  const sessions = (await getSessionsForUser(dbUser.id)).map((s) => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }));

  return <HistoryView sessions={sessions} />;
}

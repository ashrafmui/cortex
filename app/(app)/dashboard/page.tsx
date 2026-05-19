import '@fontsource/bitcount-grid-double';
import {
  getCurrentUser,
  getTopicsForUser,
  getDueForReview,
  getStreak,
  getWeeklyData,
  getMasteryDelta,
} from '@/lib/queries'
import Streak from "@/components/streak";
import { Mastery } from "@/components/dashboard/mastery";
import { Review } from "@/components/dashboard/review";
import { WeeklyProgress } from "@/components/dashboard/weekly-progress";

export default async function Home() {
  const { authUser, dbUser } = await getCurrentUser();
  const name = authUser?.user_metadata?.display_name ?? authUser?.email ?? "User";

  if (!dbUser) {
    return (
      <div className="w-full">
        <h1 className="text-4xl font-light">Hello, <span className="font-semibold">{name}</span></h1>
        <p className="mt-6 text-muted-foreground">No data yet. Run the seed or start a session.</p>
      </div>
    );
  }

  const [topics, dueTopics, { streak, lastSevenDays }, { weekly, weeklyDelta }, masteryDelta] =
    await Promise.all([
      getTopicsForUser(dbUser.id),
      getDueForReview(dbUser.id),
      getStreak(dbUser.id),
      getWeeklyData(dbUser.id),
      getMasteryDelta(dbUser.id),
    ]);

  const overallMastery = topics.length
    ? Math.round(topics.reduce((s, t) => s + t.mastery, 0) / topics.length)
    : 0;

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row w-full justify-between">
        <h1 className="text-4xl font-light">
          Hello, <span className="font-semibold">{name}</span>
        </h1>
        <div className="flex flex-col">
          <Streak count={streak} lastSevenDays={lastSevenDays} />
          <h3 className=""></h3>
        </div>
      </div>
      <br />
      <div className="flex flex-col sm:flex-row gap-5 w-full mt-6">
        <Mastery value={overallMastery} delta={masteryDelta} topics={topics} />
        <Review topics={dueTopics} />
        <WeeklyProgress data={weekly} delta={weeklyDelta} />
      </div>
    </div>
  );
}

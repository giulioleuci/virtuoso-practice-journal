import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { I18nProvider } from "@/lib/i18n";
import Onboarding from "@/components/onboarding/Onboarding";
import AppShell from "@/components/AppShell";
import Diary from "./Diary";
import Library from "./Library";
import Collections from "./Collections";
import Lessons from "./Lessons";
import History from "./History";
import Tasks from "./Tasks";
import Profile from "./Profile";
import { Routes, Route } from "react-router-dom";

const Index = () => {
  const profile = useLiveQuery(async () => (await db.profile.get("me")) ?? null);
  // undefined = loading; null = no profile yet
  if (profile === undefined) {
    return (
      <div className="min-h-screen px-6 pt-10 max-w-3xl w-full mx-auto space-y-4">
        <div className="paper-skeleton h-24 w-full" />
        <div className="paper-skeleton h-32 w-full" />
        <div className="paper-skeleton h-20 w-full" />
        <div className="paper-skeleton h-20 w-2/3" />
      </div>
    );
  }

  if (!profile || !profile.onboarded) {
    return (
      <I18nProvider initial="en">
        <Onboarding onDone={() => { /* live query refreshes automatically */ }} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider initial={profile.lang}>
      <Routes>
        <Route element={<AppShell profile={profile} />}>
          <Route index element={<Diary />} />
          <Route path="library" element={<Library />} />
          <Route path="library/collections" element={<Collections />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="history" element={<History />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </I18nProvider>
  );
};

export default Index;

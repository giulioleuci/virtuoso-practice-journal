import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { I18nProvider } from "@/lib/i18n";
import Onboarding from "@/components/onboarding/Onboarding";
import AppShell from "@/components/AppShell";
import Diary from "./Diary";
import Library from "./Library";
import Lessons from "./Lessons";
import Profile from "./Profile";
import { Routes, Route } from "react-router-dom";

const Index = () => {
  const profile = useLiveQuery(async () => (await db.profile.get("me")) ?? null);
  // undefined = loading; null = no profile yet
  if (profile === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground italic">Opening your taccuino…</div>;
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
        <Route element={<AppShell />}>
          <Route index element={<Diary />} />
          <Route path="library" element={<Library />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </I18nProvider>
  );
};

export default Index;

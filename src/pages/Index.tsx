import { lazy, Suspense } from "react";
import { useLiveQuery } from "@/lib/subscriptions";
import { db } from "@/lib/presentationQueries"; // db used for useLiveQuery reads only
import { profileService } from "@/lib/services";
import { I18nProvider } from "@/lib/I18nProvider";
import Onboarding from "@/components/onboarding/Onboarding";
import IntroSlides from "@/components/onboarding/IntroSlides";
import AppShell from "@/components/AppShell";
import { Routes, Route } from "react-router-dom";

// Code splitting routes for better initial load performance
const Diary = lazy(() => import("./Diary"));
const Library = lazy(() => import("./Library"));
const Collections = lazy(() => import("./Collections"));
const Lessons = lazy(() => import("./Lessons"));
const Assignments = lazy(() => import("./Assignments"));
const History = lazy(() => import("./History"));
const Tasks = lazy(() => import("./Tasks"));
const Profile = lazy(() => import("./Profile"));
const NewTaskPage = lazy(() => import("./NewTaskPage"));
const EditTaskPage = lazy(() => import("./EditTaskPage"));
const EditStudyRoutinePage = lazy(() => import("./EditStudyRoutinePage"));
const ItemAnalysisPage = lazy(() => import("./ItemAnalysisPage"));

const Fallback = () => (
  <div className="min-h-screen px-6 pt-10 max-w-3xl w-full mx-auto space-y-4" style={{ paddingTop: "calc(2.5rem + env(safe-area-inset-top))" }}>
    <div className="paper-skeleton h-24 w-full" />
    <div className="paper-skeleton h-32 w-full" />
    <div className="paper-skeleton h-20 w-full" />
  </div>
);

const Index = () => {
  const profile = useLiveQuery(async () => (await db.profile.get("me")) ?? null);
  // undefined = loading; null = no profile yet
  if (profile === undefined) {
    return (
      <div className="min-h-screen px-6 pt-10 max-w-3xl w-full mx-auto space-y-4" style={{ paddingTop: "calc(2.5rem + env(safe-area-inset-top))" }}>
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

  if (!profile.introSeen) {
    return (
      <I18nProvider initial={profile.lang}>
        <IntroSlides onDone={() => profileService.update({ introSeen: true })} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider initial={profile.lang}>
      <Routes>
        <Route element={<AppShell profile={profile} />}>
          <Route index element={<Suspense fallback={<Fallback />}><Diary /></Suspense>} />
          <Route path="library" element={<Suspense fallback={<Fallback />}><Library /></Suspense>} />
          <Route path="library/item/:id/analysis" element={<Suspense fallback={<Fallback />}><ItemAnalysisPage /></Suspense>} />
          <Route path="library/collections" element={<Suspense fallback={<Fallback />}><Collections /></Suspense>} />
          <Route path="lessons" element={<Suspense fallback={<Fallback />}><Lessons /></Suspense>} />
          <Route path="lessons/assignments" element={<Suspense fallback={<Fallback />}><Assignments /></Suspense>} />
          <Route path="history" element={<Suspense fallback={<Fallback />}><History /></Suspense>} />
          <Route path="tasks" element={<Suspense fallback={<Fallback />}><Tasks /></Suspense>} />
          <Route path="tasks/new" element={<Suspense fallback={<Fallback />}><NewTaskPage /></Suspense>} />
          <Route path="tasks/edit/:id" element={<Suspense fallback={<Fallback />}><EditTaskPage /></Suspense>} />
          <Route path="tasks/routines/edit/:id" element={<Suspense fallback={<Fallback />}><EditStudyRoutinePage /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<Fallback />}><Profile /></Suspense>} />
        </Route>
      </Routes>
    </I18nProvider>
  );
};

export default Index;

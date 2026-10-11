import { lazy, Suspense } from "react";
import { useProfile } from "@/presentation/hooks/useEntities";
import { profileService } from "@/lib/services";
import { I18nProvider } from "@/lib/I18nProvider";
import Onboarding from "@/components/onboarding/Onboarding";
import IntroSlides from "@/components/onboarding/IntroSlides";
import AppShell from "@/components/AppShell";
import { Routes, Route } from "react-router-dom";

// Main tabs are bundled eagerly so switching between them is instant (local-first app).
import Diary from "./Diary";
import Library from "./Library";
import Lessons from "./Lessons";
import Tasks from "./Tasks";
// Secondary pages stay lazy, but are prefetched once the app is idle.
const loadCollections = () => import("./Collections");
const loadRepertoire = () => import("./Repertoire");
const loadAssignments = () => import("./Assignments");
const loadHistory = () => import("./History");
const loadAnalytics = () => import("./Analytics");
const loadPrintSummary = () => import("./PrintSummary");
const loadProfile = () => import("./Profile");
const Collections = lazy(loadCollections);
const Repertoire = lazy(loadRepertoire);
const Assignments = lazy(loadAssignments);
const History = lazy(loadHistory);
const Analytics = lazy(loadAnalytics);
const PrintSummary = lazy(loadPrintSummary);
const Profile = lazy(loadProfile);
if (typeof window !== "undefined") {
  setTimeout(() => {
    [loadCollections, loadRepertoire, loadAssignments, loadHistory, loadAnalytics, loadPrintSummary, loadProfile,
      () => import("./NewTaskPage"), () => import("./EditTaskPage"), () => import("./EditStudyRoutinePage"), () => import("./ItemAnalysisPage"),
    ].forEach((load) => void load().catch(() => undefined));
  }, 1500);
}
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
  const profile = useProfile();
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
          <Route path="library/repertoire" element={<Suspense fallback={<Fallback />}><Repertoire /></Suspense>} />

          <Route path="lessons" element={<Suspense fallback={<Fallback />}><Lessons /></Suspense>} />
          <Route path="lessons/assignments" element={<Suspense fallback={<Fallback />}><Assignments /></Suspense>} />
          <Route path="history" element={<Suspense fallback={<Fallback />}><History /></Suspense>} />
          <Route path="analytics" element={<Suspense fallback={<Fallback />}><Analytics /></Suspense>} />

          <Route path="tasks" element={<Suspense fallback={<Fallback />}><Tasks /></Suspense>} />
          <Route path="tasks/new" element={<Suspense fallback={<Fallback />}><NewTaskPage /></Suspense>} />
          <Route path="tasks/edit/:id" element={<Suspense fallback={<Fallback />}><EditTaskPage /></Suspense>} />
          <Route path="tasks/routines/edit/:id" element={<Suspense fallback={<Fallback />}><EditStudyRoutinePage /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<Fallback />}><Profile /></Suspense>} />
        </Route>
        <Route path="print/weekly" element={<Suspense fallback={<Fallback />}><PrintSummary /></Suspense>} />
      </Routes>

    </I18nProvider>
  );
};

export default Index;

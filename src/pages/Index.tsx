import { lazy, Suspense } from "react";
import { useProfile } from "@/presentation/hooks/useEntities";
import { profileService } from "@/lib/services";
import { I18nProvider } from "@/lib/I18nProvider";
import Onboarding from "@/components/onboarding/Onboarding";
import IntroSlides from "@/components/onboarding/IntroSlides";
import AppShell from "@/components/AppShell";
import { Navigate, Routes, Route, useParams } from "react-router-dom";
import NotFound from "./NotFound";
import { PageSkeleton } from "@/components/shared/Loading";

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
const loadStudySetup = () => import("./StudySetup");
const Collections = lazy(loadCollections);
const Repertoire = lazy(loadRepertoire);
const Assignments = lazy(loadAssignments);
const History = lazy(loadHistory);
const Analytics = lazy(loadAnalytics);
const PrintSummary = lazy(loadPrintSummary);
const Profile = lazy(loadProfile);
const StudySetup = lazy(loadStudySetup);
if (typeof window !== "undefined") {
  setTimeout(() => {
    [loadCollections, loadRepertoire, loadAssignments, loadHistory, loadAnalytics, loadPrintSummary, loadProfile, loadStudySetup,
      () => import("./NewTaskPage"), () => import("./EditTaskPage"), () => import("./RoutinePage"), () => import("./ItemPage"),
    ].forEach((load) => void load().catch(() => undefined));
  }, 1500);
}
const NewTaskPage = lazy(() => import("./NewTaskPage"));
const BulkAddTasksPage = lazy(() => import("./BulkAddTasksPage"));
const EditTaskPage = lazy(() => import("./EditTaskPage"));
const RoutinePage = lazy(() => import("./RoutinePage"));
const ItemPage = lazy(() => import("./ItemPage"));
const SegmentPage = lazy(() => import("./SegmentPage"));
const CollectionPage = lazy(() => import("./CollectionPage"));
const EventPage = lazy(() => import("./EventPage"));
const SessionLogPage = lazy(() => import("./SessionLogPage"));
const SessionPage = lazy(() => import("./SessionPage"));
const ReadinessPage = lazy(() => import("./ReadinessPage"));

/** Old public address of the item analysis; now a tab of the item page. */
const LegacyItemAnalysis = () => <Navigate to={`/library/item/${useParams().id}?tab=analysis`} replace />;

const Fallback = () => (
  <div className="pt-2"><PageSkeleton /></div>
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
          <Route path="library/item/:id" element={<Suspense fallback={<Fallback />}><ItemPage /></Suspense>} />
          <Route path="library/item/:id/segment/:segmentId" element={<Suspense fallback={<Fallback />}><SegmentPage /></Suspense>} />
          <Route path="library/item/:id/analysis" element={<LegacyItemAnalysis />} />
          <Route path="library/collections/:id" element={<Suspense fallback={<Fallback />}><CollectionPage /></Suspense>} />
          <Route path="library/collections" element={<Suspense fallback={<Fallback />}><Collections /></Suspense>} />
          <Route path="library/events/:id" element={<Suspense fallback={<Fallback />}><EventPage /></Suspense>} />
          <Route path="library/events/:id/item/:itemId" element={<Suspense fallback={<Fallback />}><ReadinessPage /></Suspense>} />
          <Route path="library/repertoire" element={<Suspense fallback={<Fallback />}><Repertoire /></Suspense>} />

          <Route path="lessons" element={<Suspense fallback={<Fallback />}><Lessons /></Suspense>} />
          <Route path="lessons/assignments" element={<Suspense fallback={<Fallback />}><Assignments /></Suspense>} />
          <Route path="history" element={<Suspense fallback={<Fallback />}><History /></Suspense>} />
          <Route path="analytics" element={<Suspense fallback={<Fallback />}><Analytics /></Suspense>} />

          <Route path="log" element={<Suspense fallback={<Fallback />}><SessionLogPage /></Suspense>} />
          <Route path="sessions/:id" element={<Suspense fallback={<Fallback />}><SessionPage /></Suspense>} />
          <Route path="tasks" element={<Suspense fallback={<Fallback />}><Tasks /></Suspense>} />
          <Route path="tasks/new" element={<Suspense fallback={<Fallback />}><NewTaskPage /></Suspense>} />
          <Route path="tasks/bulk" element={<Suspense fallback={<Fallback />}><BulkAddTasksPage /></Suspense>} />
          <Route path="tasks/edit/:id" element={<Suspense fallback={<Fallback />}><EditTaskPage /></Suspense>} />
          <Route path="tasks/routines/new" element={<Suspense fallback={<Fallback />}><RoutinePage /></Suspense>} />
          <Route path="tasks/routines/edit/:id" element={<Suspense fallback={<Fallback />}><RoutinePage /></Suspense>} />
          <Route path="print/weekly" element={<Suspense fallback={<Fallback />}><PrintSummary /></Suspense>} />
          <Route path="*" element={<NotFound />} />
          <Route path="profile" element={<Suspense fallback={<Fallback />}><Profile /></Suspense>} />
          <Route path="study-setup/:id?" element={<Suspense fallback={<Fallback />}><StudySetup /></Suspense>} />
        </Route>
      </Routes>

    </I18nProvider>
  );
};

export default Index;

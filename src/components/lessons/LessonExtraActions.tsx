import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, FileText } from "lucide-react";
import { useAllLibrary, useHelpRequests } from "@/presentation/hooks/useEntities";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useI18n } from "@/lib/i18n";

interface Props {
  subjectId: number;
}
const TeacherRecapSheet = lazy(() => import("@/components/lessons/TeacherRecapSheet").then(module => ({ default: module.TeacherRecapSheet })));

/** Secondary row of lesson-card actions: open questions for the subject + weekly summary. */
export function LessonExtraActions({ subjectId }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [recapOpen, setRecapOpen] = useState(false);
  const helpRequests = useHelpRequests();
  const items = useAllLibrary();

  const openCount = useMemo(() => {
    const bySubject = new Map((items ?? []).map((i) => [i.id, i.subjectId]));
    return (helpRequests ?? []).filter((h) => !h.resolved && h.itemId !== undefined && bySubject.get(h.itemId) === subjectId).length;
  }, [helpRequests, items, subjectId]);

  const link = "inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4";

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5">
        <button onClick={() => setRecapOpen(true)} className={link}>
          <HelpCircle className="h-4 w-4" /> {t("lessons.questionsShort")}
          {openCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 font-numeric text-xs text-primary-foreground">{openCount}</span>
          )}
        </button>
        <button onClick={() => navigate(`/print/weekly?subject=${subjectId}`)} className={link}>
          <FileText className="h-4 w-4" /> {t("lessons.summaryShort")}
        </button>
      </div>
      {recapOpen && <Suspense fallback={<ResponsiveSheet open onOpenChange={setRecapOpen} title={t("recap.title")} description={t("recap.subtitle")}><p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p></ResponsiveSheet>}>
        <TeacherRecapSheet open onOpenChange={setRecapOpen} subjectId={subjectId} />
      </Suspense>}
    </>
  );
}

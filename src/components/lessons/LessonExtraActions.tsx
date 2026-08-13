import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, FileText } from "lucide-react";
import { useAllLibrary, useHelpRequests } from "@/presentation/hooks/useEntities";
import { TeacherRecapSheet } from "@/components/lessons/TeacherRecapSheet";
import { useI18n } from "@/lib/i18n";

interface Props {
  subjectId: number;
}

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

  const btn =
    "h-11 inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-primary bg-primary/[0.04] hover:bg-primary/10 active:bg-primary/15 transition-colors";

  return (
    <>
      <div className="grid grid-cols-2 border-t border-border/40">
        <button onClick={() => setRecapOpen(true)} className={`${btn} border-r border-border/40`}>
          <HelpCircle className="h-3.5 w-3.5" /> {t("lessons.questionsShort")}
          {openCount > 0 && (
            <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
              {openCount}
            </span>
          )}
        </button>
        <button onClick={() => navigate(`/print-summary?subject=${subjectId}`)} className={btn}>
          <FileText className="h-3.5 w-3.5" /> {t("lessons.summaryShort")}
        </button>
      </div>
      <TeacherRecapSheet open={recapOpen} onOpenChange={setRecapOpen} subjectId={subjectId} />
    </>
  );
}

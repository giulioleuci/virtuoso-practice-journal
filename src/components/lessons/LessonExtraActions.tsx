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
      <TeacherRecapSheet open={recapOpen} onOpenChange={setRecapOpen} subjectId={subjectId} />
    </>
  );
}

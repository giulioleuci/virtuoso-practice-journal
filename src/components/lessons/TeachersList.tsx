import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import { lessonsService } from "@/lib/services";
import { liveLessonPath } from "@/lib/liveLesson";
import { LESSON_QUOTES, pickQuote } from "@/lib/quotes";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { usePagination } from "@/hooks/usePagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { LessonExtraActions } from "./LessonExtraActions";
import { SubjectDot, iconBtn } from "./SubjectDot";

const PAGE_SIZE = 5;
const linkBtn = "inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4";

/** Who teaches what, and when. */
export function TeachersList({ onAdd, onEdit }: { onAdd: () => void; onEdit: (r: LessonRecurrence) => void }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const recurrences = useRecurrences();
  const subjects = useSubjects();
  const quote = useMemo(() => pickQuote(LESSON_QUOTES, lang), [lang]);
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s])), [subjects]);
  const pager = usePagination(recurrences ?? [], PAGE_SIZE);
  const [delId, setDelId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (delId == null || deleting) return;
    setDeleting(true);
    try { await lessonsService.deleteRecurrence(delId); toast.success(t("toast.removed")); setDelId(null); }
    catch { toast.error(t("errors.couldNotSave")); }
    finally { setDeleting(false); }
  };

  if (recurrences === undefined || subjects === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!recurrences.length) return <EmptyState hint={t("lessons.empty")} quote={quote} cta={{ label: t("lessons.addRecurrence"), onClick: onAdd }} />;

  return (
    <>
      <ul className="divide-y divide-border border-y border-border">
        {pager.pageItems.map((r) => {
          const subject = subjectMap.get(r.subjectId);
          return (
            <li key={r.id} className="py-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <div className="break-words font-serif text-2xl font-semibold leading-tight">{r.teacher}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground"><SubjectDot subject={subject} />{subject?.name ?? "—"}</div>
                </div>
                <button onClick={() => onEdit(r)} aria-label={`${t("common.edit")} ${r.teacher}`} className={iconBtn}><Pencil className="h-[18px] w-[18px]" /></button>
                <button onClick={() => r.id && setDelId(r.id)} aria-label={`${t("common.delete")} ${r.teacher}`} className={`${iconBtn} hover:text-destructive`}><Trash2 className="h-[18px] w-[18px]" /></button>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {(r.schedules ?? []).map((slot, i) => (
                  <li key={i} className="flex items-center gap-1.5 tabular-nums">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {t(`weekday.${slot.dayOfWeek}`)} · {slot.startTime}–{slot.endTime} · {t(`teacher.freq.${slot.frequency}`)}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <button onClick={() => navigate(liveLessonPath({ recurrenceId: r.id, date: today() }))} className={linkBtn}><NotebookPen className="h-4 w-4" />{t("lessons.log")}</button>
              </div>
              <LessonExtraActions subjectId={r.subjectId} />
            </li>
          );
        })}
      </ul>
      <Pager page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} />

      <AlertDialog open={delId !== null} onOpenChange={(o) => !o && !deleting && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.removeTeacher")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.removeTeacherDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void remove(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

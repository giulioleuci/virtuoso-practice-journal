import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Pencil, Trash2, Wand2, X } from "lucide-react";
import { useActiveTasks, useAssignments, useLessons, useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import { lessonNotes } from "@/domain/entities/lesson";
import { lessonsService } from "@/lib/services";
import { liveLessonPath } from "@/lib/liveLesson";
import { formatDate, today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { usePagination } from "@/hooks/usePagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { SubjectDot, iconBtn } from "./SubjectDot";

const PAGE_SIZE = 5;
const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

/** Lessons already held: what was said and what was assigned. */
export function RecordedLessons() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const lessons = useLessons();
  const assignments = useAssignments();
  const tasks = useActiveTasks();
  const recurrences = useRecurrences();
  const subjects = useSubjects();
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s])), [subjects]);
  const teacherOf = useMemo(() => new Map((recurrences ?? []).map((r) => [r.id, r.teacher])), [recurrences]);
  const pager = usePagination(lessons ?? [], PAGE_SIZE);
  const [delId, setDelId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (delId == null || deleting) return;
    setDeleting(true);
    try { await lessonsService.deleteLesson(delId); toast.success(t("toast.lessonDeleted")); setDelId(null); }
    catch { toast.error(t("errors.couldNotSave")); }
    finally { setDeleting(false); }
  };
  const act = async (run: () => Promise<unknown>, message: string) => {
    try { await run(); toast(message); } catch { toast.error(t("errors.couldNotSave")); }
  };

  if (lessons === undefined || assignments === undefined || tasks === undefined || subjects === undefined || recurrences === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!lessons.length) return <EmptyState title={t("lessons.noLessonsLogged")} />;

  return (
    <>
      <ul className="divide-y divide-border border-y border-border">
        {pager.pageItems.map((l) => {
          const subject = subjectMap.get(l.subjectId);
          const teacher = l.snapshot?.teacher ?? teacherOf.get(l.recurrenceId);
          const notes = lessonNotes(l);
          const homework = assignments.filter((a) => a.lessonId === l.id);
          const when = formatDate(l.date, lang);
          return (
            <li key={l.id} className="py-5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <h3 className="font-serif text-2xl font-semibold leading-tight tabular-nums">{when}</h3>
                  <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground"><SubjectDot subject={subject} />{[teacher, subject?.name ?? l.snapshot?.subjectName].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <button onClick={() => navigate(liveLessonPath({ lessonId: l.id }))} className={iconBtn} aria-label={`${t("common.edit")} ${when}`}><Pencil className="h-4 w-4" /></button>
                <button onClick={() => l.id && setDelId(l.id)} className={`${iconBtn} hover:text-destructive`} aria-label={`${t("common.delete")} ${when}`}><Trash2 className="h-4 w-4" /></button>
              </div>

              {notes.length > 0 && (
                <div className="mt-3">
                  <h4 className={label}>{t("lessonLive.notes")}</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm marker:text-muted-foreground">
                    {notes.map((n) => <li key={n.id} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{n.text}</li>)}
                  </ul>
                </div>
              )}

              {homework.length > 0 && (
                <div className="mt-3">
                  <h4 className={label}>{t("homework.addShort")}</h4>
                  <ul className="mt-1">
                    {homework.map((a) => {
                      const linked = a.taskIds.flatMap((id) => tasks.find((tk) => tk.id === id) ?? []);
                      return (
                        <li key={a.id} className="flex items-center gap-2 text-sm">
                          {linked.length ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : <Wand2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className="min-w-0 flex-1 py-2 [overflow-wrap:anywhere]">{a.text}</span>
                          {linked.length ? (
                            <span className="max-w-[40%] truncate text-xs text-primary">→ {linked.length === 1 ? linked[0].title : t("homework.tasksLinked", { count: linked.length })}</span>
                          ) : a.ignored ? (
                            <button onClick={() => act(() => lessonsService.restoreAssignment(a.id), t("toast.restored"))} className="min-h-11 text-xs italic text-muted-foreground hover:text-primary">{t("lessons.ignoredRestore")}</button>
                          ) : (
                            <>
                              <button onClick={() => navigate("/tasks/new", { state: { date: today(), prefill: { subjectId: l.subjectId, title: a.text, assignmentId: a.id } } })} className="min-h-11 text-xs font-medium text-primary hover:underline underline-offset-4">{t("lessons.makeTask")}</button>
                              <button onClick={() => act(() => lessonsService.ignoreAssignment(a.id), t("toast.ignored"))} className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive" aria-label={t("common.ignore")}><X className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Pager page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} />

      <AlertDialog open={delId !== null} onOpenChange={(o) => !o && !deleting && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteLesson")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.deleteLessonDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void remove(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

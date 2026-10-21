import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Trash2 } from "lucide-react";
import { useAssignmentsForLesson, useLessons, useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import { lessonsService } from "@/lib/services";
import { toast } from "sonner";
import { lessonNotes } from "@/domain/entities/lesson";
import { clearLiveLesson, readLessonDraft, setLiveLesson, writeLessonDraft } from "@/lib/liveLesson";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/Loading";
import { LessonEntryField, LessonEntryList } from "@/components/lessons/LessonEntryList";
import { LessonExtraActions } from "@/components/lessons/LessonExtraActions";

/** A lesson kept open from start to end: homework and notes are saved as they are typed. */
export default function LessonLive() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const lessons = useLessons();
  const recurrences = useRecurrences();
  const subjects = useSubjects();
  const [dateError, setDateError] = useState<string>();
  // Typed date, committed on blur or Enter: desktop pickers fire change for half-typed years (0002-, 0202-).
  const [typed, setTyped] = useState<{ base: string; value: string }>();
  // Writes that resolve after the page is left must not touch the address or the pointer again.
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []); // set here, not at init: StrictMode remounts

  // `?lesson=<id>` opens an existing lesson; `?recurrence=<id>|subject=<id>&date=` a slot whose row appears on the first write.
  const lessonParam = Number(params.get("lesson")) || undefined;
  const given = lessonParam ? lessons?.find((l) => l.id === lessonParam) : undefined;
  const recurrenceId = lessonParam ? given?.recurrenceId : Number(params.get("recurrence")) || undefined;
  const recurrence = recurrences?.find((r) => r.id === recurrenceId);
  const subjectId = given?.subjectId ?? recurrence?.subjectId ?? (Number(params.get("subject")) || undefined);
  const subject = subjects?.find((s) => s.id === subjectId);
  const date = given?.date ?? params.get("date") ?? today();
  const lesson = given ?? lessons?.find((l) => l.subjectId === subjectId && l.recurrenceId === recurrenceId && l.date === date);
  const assignments = useAssignmentsForLesson(lesson?.id);
  const loaded = lessons !== undefined && recurrences !== undefined && subjects !== undefined;
  const missing = loaded && (lessonParam ? !given : recurrenceId ? !recurrence : !subject);

  useEffect(() => { setLiveLesson(location.pathname + location.search); }, [location.pathname, location.search]);
  // A lesson or teacher deleted elsewhere: nothing left to resume.
  useEffect(() => { if (missing) { clearLiveLesson(); navigate("/lessons", { replace: true }); } }, [missing, navigate]);

  if (!loaded || missing || subjectId === undefined) return <PageSkeleton />;

  // Writes go to the row on screen; with none yet, ensureFor is atomic, so fast adds from both lists share one lesson.
  const lessonId = async () => lesson?.id ?? lessonsService.ensureFor(subjectId, recurrence, date);
  // No date in the scope: one live lesson at a time, and a date change must not hide the text being typed.
  const scope = lessonParam ? `lesson-${lessonParam}` : recurrenceId ? `recurrence-${recurrenceId}` : `subject-${subjectId}`;

  const homework = assignments ?? [];
  const notes = lesson ? lessonNotes(lesson) : [];
  const dateValue = typed?.base === date ? typed.value : date;
  const changeDate = async (next: string) => {
    setDateError(undefined);
    const moveUrl = () => { if (!alive.current || lessonParam) return; const p = new URLSearchParams(params); p.set("date", next); setParams(p, { replace: true }); };
    if (!lesson?.id) return moveUrl();
    try { await lessonsService.setDate(lesson.id, next); moveUrl(); }
    catch (error) { setTyped(undefined); setDateError(error instanceof Error && error.message === "lesson-exists" ? t("lessonLive.dateTaken") : t("errors.couldNotSave")); }
  };
  // ponytail: years 1000-2999 only, enough to reject half-typed values.
  const commitDate = () => { if (/^[12]\d{3}-\d{2}-\d{2}$/.test(dateValue) && dateValue !== date) void changeDate(dateValue); else setTyped(undefined); };
  // Closes the live page and drops the lesson row (with its homework) if one was written.
  const discard = async () => {
    try { if (lesson?.id) await lessonsService.deleteLesson(lesson.id); }
    catch { toast.error(t("errors.couldNotSave")); return; }
    clearLiveLesson();
    toast.success(t("toast.lessonDeleted"));
    if (alive.current) navigate("/lessons", { replace: true });
  };
  // Text typed but not sent is saved first; each stored draft goes as its line lands, so a retry adds nothing twice.
  const finish = async () => {
    try {
      for (const [list, save] of [["homework", lessonsService.addAssignment], ["notes", lessonsService.addNote]] as const) {
        const text = readLessonDraft(`${scope}-${list}`);
        if (text.trim()) { await save(await lessonId(), text); writeLessonDraft(`${scope}-${list}`, ""); }
      }
    } catch { toast.error(t("lessonLive.notSaved")); return; }
    clearLiveLesson();
    if (alive.current) navigate("/lessons");
  };

  return (
    <div className="max-w-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] [&>header]:mb-1.5">
      <PageHeader title={t("lessonLive.title")} actions={<Button className="min-h-11" onClick={() => void finish()}>{t("lessonLive.finish")}</Button>} />
      <div className="mb-5 grid gap-1">
        <p className="break-words text-sm font-medium">{[recurrence?.teacher ?? lesson?.snapshot?.teacher, subject?.name ?? lesson?.snapshot?.subjectName].filter(Boolean).join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-x-5">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("common.date")}
            <Input type="date" name="date" required aria-invalid={!!dateError} aria-describedby={dateError ? "lesson-live-date-error" : undefined} value={dateValue} className="min-h-11 w-auto max-w-full text-foreground"
              onChange={(e) => setTyped({ base: date, value: e.target.value })} onBlur={commitDate} onKeyDown={(e) => { if (e.key === "Enter") commitDate(); }} />
          </label>
          <LessonExtraActions subjectId={subjectId} />
          <Button asChild variant="ghost" className="min-h-11 px-2"><Link to="/"><BookOpen className="h-4 w-4" /> {t("lessonLive.toDiary")}</Link></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" className="min-h-11 px-2 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> {t("lessonLive.discard")}</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("dialog.deleteLesson")}</AlertDialogTitle>
                <AlertDialogDescription>{t("dialog.deleteLessonDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void discard()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {dateError && <p id="lesson-live-date-error" role="alert" className="text-sm text-destructive">{dateError}</p>}
      </div>
      {/* Capture first: both fields under the header, the entries below the rule. */}
      <div className="space-y-3.5">
        <LessonEntryField key={`${scope}-homework`} id="lesson-live-homework" draftScope={`${scope}-homework`} label={t("lessonLive.homework")} placeholder={t("homework.textPlaceholder")} addLabel={t("homework.add")}
          onAdd={async (text) => lessonsService.addAssignment(await lessonId(), text)} />
        <LessonEntryField key={`${scope}-notes`} id="lesson-live-notes" draftScope={`${scope}-notes`} label={t("lessonLive.notes")} placeholder={t("lessonLive.notePlaceholder")} addLabel={t("lessonLive.addNote")}
          onAdd={async (text) => lessonsService.addNote(await lessonId(), text)} />
      </div>
      {(homework.length > 0 || notes.length > 0) && (
        <div key={scope} className="mt-8 space-y-7 border-t border-border pt-8">
          <LessonEntryList title={t("lessonLive.homework")} entries={homework} addFieldId="lesson-live-homework"
            onEdit={(id, text) => lessonsService.updateAssignment(Number(id), text)}
            onRemove={(id) => lessonsService.removeAssignment(Number(id))}
            onRestore={(assignment) => lessonsService.reinsertAssignment(assignment)} />
          <LessonEntryList title={t("lessonLive.notes")} entries={notes} addFieldId="lesson-live-notes"
            onEdit={async (id, text) => lessonsService.updateNote(await lessonId(), String(id), text)}
            onRemove={async (id) => lessonsService.removeNote(await lessonId(), String(id))}
            onRestore={async (note, index) => lessonsService.reinsertNote(await lessonId(), note, index)} />
        </div>
      )}
    </div>
  );
}

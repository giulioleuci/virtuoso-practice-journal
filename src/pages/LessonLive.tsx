import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAssignmentsForLesson, useLessons, useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import { lessonsService } from "@/lib/services";
import { clearLiveLesson, setLiveLesson } from "@/lib/liveLesson";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // Every write resolves the row first; ensureFor is atomic, so fast adds from both lists share one lesson.
  const lessonId = async () => given?.id ?? lessonsService.ensureFor(subjectId, recurrence, date);
  const scope = lessonParam ? `lesson-${lessonParam}` : `${recurrenceId ? `recurrence-${recurrenceId}` : `subject-${subjectId}`}-${date}`;

  const homework = assignments ?? [];
  const notes = Array.isArray(lesson?.notes) ? lesson.notes : []; // a legacy string must not crash the list
  const dateValue = typed?.base === date ? typed.value : date;
  const changeDate = async (next: string) => {
    setDateError(undefined);
    const moveUrl = () => { if (lessonParam) return; const p = new URLSearchParams(params); p.set("date", next); setParams(p, { replace: true }); };
    if (!lesson?.id) return moveUrl();
    try { await lessonsService.setDate(lesson.id, next); moveUrl(); }
    catch (error) { setTyped(undefined); setDateError(error instanceof Error && error.message === "lesson-exists" ? t("lessonLive.dateTaken") : t("errors.couldNotSave")); }
  };
  // ponytail: years 1000-2999 only, enough to reject half-typed values.
  const commitDate = () => { if (/^[12]\d{3}-\d{2}-\d{2}$/.test(dateValue) && dateValue !== date) void changeDate(dateValue); else setTyped(undefined); };
  const finish = () => { clearLiveLesson(); navigate("/lessons"); };

  return (
    <div className="pb-[calc(1.5rem+env(safe-area-inset-bottom))] [&>header]:mb-1.5">
      <PageHeader title={t("lessonLive.title")} actions={<Button className="min-h-11" onClick={finish}>{t("lessonLive.finish")}</Button>} />
      <div className="mb-5 grid gap-1">
        <p className="break-words text-sm font-medium">{[recurrence?.teacher ?? lesson?.snapshot?.teacher, subject?.name ?? lesson?.snapshot?.subjectName].filter(Boolean).join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-x-5">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("common.date")}
            <Input type="date" required aria-invalid={!!dateError} aria-describedby={dateError ? "lesson-live-date-error" : undefined} value={dateValue} className="min-h-11 w-auto max-w-full text-foreground"
              onChange={(e) => setTyped({ base: date, value: e.target.value })} onBlur={commitDate} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          </label>
          <LessonExtraActions subjectId={subjectId} />
        </div>
        {dateError && <p id="lesson-live-date-error" role="alert" className="text-sm text-destructive">{dateError}</p>}
      </div>
      {/* Capture first: both fields under the header, the entries below the rule. */}
      <div className="space-y-3.5">
        <LessonEntryField key={`${scope}-homework`} draftScope={`${scope}-homework`} label={t("lessonLive.homework")} placeholder={t("homework.textPlaceholder")} addLabel={t("homework.add")}
          onAdd={async (text) => lessonsService.addAssignment(await lessonId(), text)} />
        <LessonEntryField key={`${scope}-notes`} draftScope={`${scope}-notes`} label={t("lessonLive.notes")} placeholder={t("lessonLive.notePlaceholder")} addLabel={t("lessonLive.addNote")}
          onAdd={async (text) => lessonsService.addNote(await lessonId(), text)} />
      </div>
      {(homework.length > 0 || notes.length > 0) && (
        <div key={scope} className="mt-8 space-y-7 border-t border-border pt-8">
          <LessonEntryList title={t("lessonLive.homework")} entries={homework}
            onEdit={(id, text) => lessonsService.updateAssignment(Number(id), text)}
            onRemove={(id) => lessonsService.removeAssignment(Number(id))}
            onRestore={(assignment) => lessonsService.reinsertAssignment(assignment)} />
          <LessonEntryList title={t("lessonLive.notes")} entries={notes}
            onEdit={async (id, text) => lessonsService.updateNote(await lessonId(), String(id), text)}
            onRemove={async (id) => lessonsService.removeNote(await lessonId(), String(id))}
            onRestore={async (note, index) => lessonsService.reinsertNote(await lessonId(), note, index)} />
        </div>
      )}
    </div>
  );
}

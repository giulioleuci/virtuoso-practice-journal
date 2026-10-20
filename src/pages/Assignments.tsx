import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { useActiveTasks, useAssignments, useLessons, useSubjects } from "@/presentation/hooks/useEntities";
import { Link, useNavigate } from "react-router-dom";
import { assignmentsToPlan } from "@/presentation/utils/assignments";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
import type { Assignment } from "@/domain/entities/lesson";
import { lessonsService, tasksService } from "@/lib/services";
import { addDays, dayKey, formatDate, parseDayKey, today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, X, ArrowLeft, Link2 } from "lucide-react";
import { toast } from "sonner";
import { subjectColorCss } from "@/lib/subjectColors";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { PageHeader } from "@/components/shared/PageHeader";
import { nativeSelect } from "@/components/diary/WhenFields";

const PAGE_SIZE = 5;
const DAYS_AHEAD = 7;

/** Inline planner for one homework: tick days to create a task each, or link an existing task. */
function PlanHomework({ assignment, subjectId, onComplete, onBusy }: { assignment: Assignment; subjectId?: number; onComplete: () => void; onBusy: (busy: boolean) => void }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const tasks = useActiveTasks();
  const [days, setDays] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [completed, setCompleted] = useState<string[]>([]);
  const created = useRef(new Map<string, number>());
  const base = parseDayKey(today());
  const options = Array.from({ length: DAYS_AHEAD }, (_, i) => dayKey(addDays(base, i)));
  const openTasks = useMemo(
    () => (tasks ?? []).filter((task) => task.subjectId === subjectId && !task.done && !task.skipped && task.date >= today()).sort((a, b) => a.date.localeCompare(b.date)),
    [tasks, subjectId],
  );

  const create = async () => {
    if (!days.length || busy || subjectId === undefined) return;
    setBusy(true);
    onBusy(true); setError(undefined);
    try {
      for (const date of days) {
        let id = created.current.get(date);
        if (id === undefined) {
          id = await tasksService.create({ date, subjectId, linkType: "free", title: assignment.text, plan: [] });
          created.current.set(date, id);
        }
        await lessonsService.linkTask(assignment.id, id);
        setCompleted(previous => [...previous, date]);
        setDays(previous => previous.filter(value => value !== date));
      }
      toast.success(t("assignments.created", { count: created.current.size }));
      onComplete();
    } catch {
      setError(t("assignments.planFailed"));
    } finally { setBusy(false); onBusy(false); }
  };

  const link = async (value: string) => {
    if (value === "__none" || busy) return;
    setBusy(true); onBusy(true); setError(undefined);
    try { await lessonsService.linkTask(assignment.id, Number(value)); onComplete(); }
    catch { setError(t("errors.couldNotSave")); }
    finally { setBusy(false); onBusy(false); }
  };

  return (
    <div className="mt-3 w-full space-y-3 border-t border-border pt-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("assignments.pickDays")}>
        {options.map((date) => (
          <button
            key={date}
            type="button"
            aria-pressed={days.includes(date) || completed.includes(date)}
            disabled={busy || completed.includes(date)}
            onClick={() => setDays((cur) => (cur.includes(date) ? cur.filter((d) => d !== date) : [...cur, date]))}
            className={cn("min-h-11 min-w-14 rounded-paper border px-3 text-xs font-medium transition-colors disabled:opacity-60", days.includes(date) || completed.includes(date) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {date === today() ? t("common.today") : formatDate(date, lang, "weekdayShort")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="min-h-11" disabled={!days.length || busy || subjectId === undefined} onClick={create}><Plus />{t("assignments.create", { count: Math.max(1, days.length) })}</Button>
        <Button size="sm" className="min-h-11" variant="ghost" disabled={busy} onClick={() => navigate("/tasks/new", { state: { date: today(), prefill: { subjectId, title: assignment.text, assignmentId: assignment.id } } })}>{t("assignments.moreOptions")}</Button>
        {!!openTasks.length && (
          <Select value="__none" disabled={busy} onValueChange={value => void link(value)}><SelectTrigger aria-label={t("assignments.linkExisting")} className={cn(nativeSelect, "max-w-[16rem]")}><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="__none">{t("assignments.linkExisting")}</SelectItem>
            {openTasks.map((task) => <SelectItem key={task.id} value={String(task.id)}>{formatDate(task.date, lang)} · {task.title}</SelectItem>)}
          </SelectContent></Select>
        )}
      </div>
    </div>
  );
}

export default function Assignments() {
  const { t, lang } = useI18n();
  const assignments = useAssignments();
  const lessons = useLessons();
  const subjects = useSubjects();
  const tasks = useActiveTasks();

  const [page, setPage] = useState(0);
  const [planning, setPlanning] = useState<number | null>(null);
  const [planningBusy, setPlanningBusy] = useState(false);

  const pendingIds = new Set(assignmentsToPlan(assignments ?? [], tasks ?? []).map(assignment => assignment.id));
  const pending = (assignments ?? []).filter(assignment => pendingIds.has(assignment.id) || assignment.id === planning);
  const totalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = pending.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="pb-24">
      <Link to="/lessons" className="mb-4 inline-flex min-h-11 items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Link>
      <PageHeader title={t("assignments.title")}  />

      {assignments === undefined || lessons === undefined || subjects === undefined || tasks === undefined ? <div className="paper-skeleton h-40" /> : pending.length === 0 ? (
        <EmptyState title={t("assignments.allCaughtUp")} hint={t("assignments.noneWaiting")} />
      ) : (
        <section>
          <ul className="divide-y divide-border border-t border-border">
            {slice.map((a) => {
              const lesson = lessons?.find((l) => l.id === a.lessonId);
              const subject = subjects?.find((s) => s.id === lesson?.subjectId);
              return (
                <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-4">
                  <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(subject?.color, subject?.type, subject?.customColor) }} title={subject?.name} role="img" aria-label={subject?.name} />
                  <div className="min-w-[calc(100%-8rem)] flex-1 min-[700px]:min-w-0">
                    <p className="text-sm leading-snug [overflow-wrap:anywhere]">{a.text}</p>
                    {lesson && <p className="mt-1 text-xs text-muted-foreground">{formatDate(lesson.date, lang)}</p>}
                  </div>
                  <Button size="sm" className="min-h-11" disabled={planningBusy} variant={planning === a.id ? "secondary" : "default"} aria-expanded={planning === a.id} onClick={() => setPlanning(planning === a.id ? null : a.id)}>
                    <Link2 /> {t("assignments.makeTask")}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 hover:text-destructive"
                    aria-label={`${t("common.ignore")}: ${a.text}`}
                    disabled={planningBusy}
                    onClick={() => void deleteWithUndo({ remove: async () => { await lessonsService.ignoreAssignment(a.id); if (planning === a.id) setPlanning(null); }, restore: () => lessonsService.restoreAssignment(a.id), message: t("toast.ignored"), undoLabel: t("common.undo"), toast: (message, options) => toast.success(message, options), onError: () => toast.error(t("errors.couldNotSave")) })}
                  >
                    <X />
                  </Button>
                  {planning === a.id && <PlanHomework assignment={a} subjectId={lesson?.subjectId} onComplete={() => setPlanning(null)} onBusy={setPlanningBusy} />}
                </li>
              );
            })}
          </ul>
          <fieldset disabled={planningBusy}><Pager page={safePage} totalPages={totalPages} onChange={value => { setPage(value); setPlanning(null); }} /></fieldset>
        </section>
      )}
    </div>
  );
}

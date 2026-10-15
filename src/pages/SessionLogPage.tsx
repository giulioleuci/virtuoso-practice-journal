import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { SegmentMark, Subject } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Task } from "@/domain/entities/task";
import { carryMarksToPlan, emptyEntry, followUpTasks, marksFromPlan, planSegmentIds } from "@/domain/logic/plan";
import { missingRatings } from "@/domain/logic/sessionMetrics";
import type { SessionLogInput, SessionTarget } from "@/domain/ports/session";
import type { StudyRoutine } from "@/domain/ports/studyRoutine";
import { presentationQueries } from "@/application/queries/presentationQueryService";
import { applicationCommands } from "@/lib/applicationCommands";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { flattenErrors, newSessionInputSchema } from "@/lib/schemas";
import { routineAdaptivity } from "@/lib/domain/studyRoutineGenerator";
import { tasksService } from "@/lib/services";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useSessionSubmission } from "@/presentation/hooks/usePresentationControllers";
import { useActiveTasks, useProfile, useSubjects, useTask, useTechniques } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormErrors } from "@/components/shared/StateNotice";
import { CarryForwardPicker } from "@/components/diary/CarryForwardPicker";
import { MarksEditor } from "@/components/diary/MarksEditor";
import { LastSessionStrip } from "@/components/diary/LastSessionStrip";
import { BpmSuggestion } from "@/components/diary/BpmSuggestion";
import { nativeSelect } from "@/components/diary/WhenFields";
import { TeacherAnswersSheet } from "@/components/library/TeacherAnswersSheet";

type Prefill = { marks?: SegmentMark[]; notes?: string };
const marksDraftKey = (taskId: number) => `virtuoso-marks-${taskId}`;
const panel = "rounded-[14px] bg-card p-6 shadow-soft";
const section = "mt-6 border-t border-border pt-6";

const initialMarks = (task?: Task | null, prefill?: Prefill): SegmentMark[] =>
  prefill?.marks ?? marksFromPlan(task?.plan ?? []);

/** Blocking problems of a new session: something studied, every studied section fully rated, valid fields. */
const markErrors = (notes: string, marks: SegmentMark[], t: ReturnType<typeof useI18n>["t"]) => {
  if (!marks.length) return [t("rating.pickStudied")];
  const unrated = marks.filter((m) => missingRatings(m).length > 0).length;
  if (unrated) return [t("rating.missingSummary", { count: unrated })];
  return flattenErrors(newSessionInputSchema.safeParse({ notes, marks }));
};

/** Marks as stored: tempo and note value only mean something outside theory subjects. */
const cleanMarks = (marks: SegmentMark[], isTheory: boolean): SegmentMark[] =>
  marks.map((m) => (isTheory ? { ...m, bpm: undefined, noteVal: undefined, targetBpm: undefined } : m));

/** `/log?task=ID` logs a session for a planned task; `/log` logs a free session. */
export default function SessionLogPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const location = useLocation();
  const taskId = params.get("task") ? Number(params.get("task")) : undefined;
  const prefill = (location.state as { prefill?: Prefill } | null)?.prefill;
  const task = useTask(taskId);

  if (taskId === undefined) return <FreeSessionForm />;
  if (task === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (task === null) return <EmptyState title={t("logPage.taskNotFound")} />;
  return <TaskSessionForm key={task.id} task={task} prefill={prefill} />;
}

function useGoBack() {
  const navigate = useNavigate();
  return () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link to="/" className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
      <ChevronLeft className="h-4 w-4" />{t("logPage.back")}
    </Link>
  );
}

function Guide({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <aside className="min-w-0 space-y-6">
      <section>
        <h2 className="mb-1 font-serif text-xl font-semibold">{t("logPage.guideTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("logPage.guideBody")}</p>
      </section>
      {children}
    </aside>
  );
}

function Footer({ onCancel, disabled, busy }: { onCancel: () => void; disabled: boolean; busy: boolean }) {
  const { t } = useI18n();
  return (
    <div className="mt-8 flex justify-end gap-2 border-t border-border pt-5 max-[699px]:sticky max-[699px]:bottom-[calc(76px+env(safe-area-inset-bottom))] max-[699px]:bg-card max-[699px]:pb-3">
      <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
      <Button type="submit" disabled={disabled || busy}>{busy ? t("logPage.saving") : t("session.saveSession")}</Button>
    </div>
  );
}

function HelpQuestion({ on, onToggle, text, onText, itemTitle }: { on: boolean; onToggle: (v: boolean) => void; text: string; onText: (v: string) => void; itemTitle?: string }) {
  const { t } = useI18n();
  return (
    <div className={section}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{t("session.needHelp")}</div>
          <div className="text-xs text-muted-foreground">{t("session.flagLesson")}</div>
        </div>
        <Switch checked={on} onCheckedChange={onToggle} aria-label={t("session.needHelp")} />
      </div>
      {on && (
        <div className="mt-3 space-y-2">
          <Textarea value={text} maxLength={1000} onChange={(e) => onText(e.target.value)} placeholder={t("session.helpPlaceholder")} rows={3} aria-label={t("session.helpPlaceholder")} />
          <p className="text-xs text-muted-foreground">{itemTitle ? t("logPage.helpLinked", { title: itemTitle }) : t("logPage.helpNoItem")}</p>
        </div>
      )}
    </div>
  );
}

function useSubjectOptions(subject: Subject | undefined) {
  const { t } = useI18n();
  const techniques = useTechniques();
  const isTheory = subject?.type === "theory";
  const layerOptions = useMemo(
    () => (isTheory ? THEORY_LAYERS.map((l) => ({ value: l as string, label: t(`library.mastery.${l}`) })) : (subject?.layers ?? []).map((l) => ({ value: l, label: l }))),
    [subject, isTheory, t],
  );
  const techniqueOptions = useMemo(() => (techniques ?? []).filter((x) => x.subjectId === subject?.id).map((x) => ({ value: x.id, label: x.name })), [techniques, subject]);
  return { isTheory, layerOptions, techniqueOptions };
}

// ── Task session ───────────────────────────────────────────────────

function TaskSessionForm({ task, prefill }: { task: Task; prefill?: Prefill }) {
  const { t } = useI18n();
  const goBack = useGoBack();
  const [marks, setMarks] = useState<SegmentMark[]>(() => {
    if (prefill?.marks) return prefill.marks;
    try { const saved = task.id ? JSON.parse(localStorage.getItem(marksDraftKey(task.id)) ?? "null") : null; if (Array.isArray(saved)) return saved; } catch { /* ignore */ }
    return initialMarks(task);
  });
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const [needHelp, setNeedHelp] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [bpmDismissed, setBpmDismissed] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const allTasks = useActiveTasks();
  const followUps = useMemo(() => followUpTasks(task, marks, allTasks ?? []), [task, marks, allTasks]);
  // null = untouched: the earliest follow-up is ticked by default.
  const [carryTo, setCarryTo] = useState<number[] | null>(null);
  const carryIds = carryTo ?? followUps.slice(0, 1).flatMap((c) => (c.id === undefined ? [] : [c.id]));

  const subject = usePresentationRead<Subject | undefined>("subjects.one", [task.subjectId]);
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [task.itemId]);
  const sections = usePresentationRead<Segment[]>("segments.ids", [planSegmentIds(task.plan)]);
  const answeredCount = usePresentationRead<number>("helpRequests.answeredCount", [task.itemId]) ?? 0;
  const { isTheory, layerOptions, techniqueOptions } = useSubjectOptions(subject);
  // Every planned section keeps a row even if the library segment was deleted; newly ticked rows start from the plan.
  const rows = planSegmentIds(task.plan).map((id) => ({ id, label: sections?.find((s) => s.id === id)?.label ?? "—" }));
  const seed = (id: number) => marksFromPlan(task.plan).find((m) => m.segmentId === id) ?? emptyEntry(id);
  const submission = useSessionSubmission(async ({ input }: { input: SessionLogInput }) => { await applicationCommands.sessions.log.execute(task, input); });

  const changeMarks = (next: SegmentMark[]) => {
    setMarks(next);
    try { localStorage.setItem(marksDraftKey(task.id!), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const errors = useMemo(() => {
    const e = markErrors(notes, cleanMarks(marks, isTheory), t);
    if (needHelp && !helpText.trim()) e.push(t("session.helpDescribe"));
    return e;
  }, [marks, notes, isTheory, needHelp, helpText, t]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length || submission.submitting || !task.id) return;
    const logged = cleanMarks(marks, isTheory);
    const ok = await submission.submit({ input: { date: task.date, notes, marks: logged, helpText: needHelp ? helpText.trim() : undefined } });
    if (!ok) return void toast.error(submission.error ?? t("errors.couldNotSave"));
    for (const next of followUps.filter((c) => c.id !== undefined && carryIds.includes(c.id))) await tasksService.update(next.id!, { plan: carryMarksToPlan(next.plan, logged) });
    if (task.studyRoutineId) {
      const routine = await presentationQueries().execute<StudyRoutine | undefined>("routines.one", task.studyRoutineId);
      if (routine && routineAdaptivity(routine) !== "uniform") applicationCommands.routines.regenerate.execute(routine, task.date).catch(() => undefined);
    }
    try { localStorage.removeItem(marksDraftKey(task.id)); } catch { /* ignore */ }
    toast.success(t("toast.sessionLogged"));
    goBack();
  };

  return (
    <div className="pb-24">
      <BackLink />
      <PageHeader title={t("logPage.title")} subtitle={<>{task.title}{item?.composer ? ` · ${item.composer}` : ""}</>} />
      <div className="grid gap-6 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px] min-[1151px]:gap-8">
        <form onSubmit={save} className={`${panel} min-w-0`}>
          {!isTheory && !bpmDismissed && marks.length === 1 && (
            <div className="mb-5"><BpmSuggestion task={task} dismissed={bpmDismissed} onDismiss={() => setBpmDismissed(true)} onAccept={(bpm) => { changeMarks(marks.map((m) => ({ ...m, bpm }))); setBpmDismissed(true); }} /></div>
          )}

          <MarksEditor marks={marks} onChange={changeMarks} sections={rows} seed={seed} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} />

          <div className={`${section} space-y-2`}>
            <Label className="text-xs font-medium text-foreground">{t("session.notes")}</Label>
            <Textarea rows={3} maxLength={2000} aria-label={t("session.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("session.notesPlaceholder")} />
          </div>

          <HelpQuestion on={needHelp} onToggle={setNeedHelp} text={helpText} onText={setHelpText} itemTitle={item?.title} />
          <CarryForwardPicker tasks={followUps} selected={carryIds} onChange={setCarryTo} />
          <FormErrors errors={errors} className="mt-6" />
          <Footer onCancel={goBack} disabled={errors.length > 0} busy={submission.submitting} />
        </form>

        <Guide>
          <LastSessionStrip task={task} />
          {task.itemId && answeredCount > 0 && (
            <button type="button" onClick={() => setShowAnswers(true)} className="inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
              <MessageSquareQuote className="h-4 w-4" />{t("teacherAnswers.openLabel")} <span className="tabular-nums opacity-70">· {answeredCount}</span>
            </button>
          )}
        </Guide>
      </div>
      {task.itemId && <TeacherAnswersSheet open={showAnswers} onOpenChange={setShowAnswers} itemId={task.itemId} itemTitle={item?.title ?? task.title} />}
    </div>
  );
}

// ── Free session ───────────────────────────────────────────────────

function FreeSessionForm() {
  const { t } = useI18n();
  const goBack = useGoBack();
  const subjects = useSubjects();
  const profile = useProfile();
  const todayKey = today();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [itemId, setItemId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey);
  const [marks, setMarks] = useState<SegmentMark[]>(() => initialMarks());
  const [notes, setNotes] = useState("");
  const [needHelp, setNeedHelp] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [busy, setBusy] = useState(false);

  const subject = subjects?.find((s) => s.id === (subjectId ?? subjects?.[0]?.id));
  const subjId = subject?.id;
  const pieces = usePresentationRead<LibraryItem[]>("library.subject", [subjId]);
  const item = pieces?.find((i) => i.id === itemId);
  const itemSegments = usePresentationRead<Segment[]>("library.segments", [itemId]);
  // A piece with sections starts with none ticked; anything else is one whole-scope entry.
  useEffect(() => { setMarks(itemSegments?.length ? [] : [emptyEntry()]); }, [itemId, itemSegments?.length]);
  const { isTheory, layerOptions, techniqueOptions } = useSubjectOptions(subject);
  const minDate = useMemo(() => { const d = new Date(todayKey); d.setDate(d.getDate() - (profile?.lateRecoveryDays ?? 3)); return d.toISOString().slice(0, 10); }, [todayKey, profile?.lateRecoveryDays]);

  const errors = useMemo(() => {
    const e = markErrors(notes, cleanMarks(marks, isTheory), t);
    if (subjId === undefined) e.push(t("errors.pickSubject"));
    if (!date) e.push(t("session.dateRequired"));
    if (needHelp && !helpText.trim()) e.push(t("session.helpDescribe"));
    if (needHelp && !itemId) e.push(t("logPage.helpNoItem"));
    return e;
  }, [marks, notes, isTheory, subjId, date, needHelp, helpText, itemId, t]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length || busy || subjId === undefined) return;
    setBusy(true);
    try {
      const target: SessionTarget = { subjectId: subjId, linkType: itemId ? "item" : "free", itemId, title: item?.title ?? (title.trim() || t("diary.freeSession")), plan: [] };
      await applicationCommands.sessions.log.execute(target, { date, notes, marks: cleanMarks(marks, isTheory), helpText: needHelp && itemId ? helpText.trim() : undefined });
      toast.success(t("toast.sessionLogged"));
      goBack();
    } catch (err) {
      toast.error((err as Error).message || t("errors.couldNotSave"));
      setBusy(false);
    }
  };

  return (
    <div className="pb-24">
      <BackLink />
      <PageHeader title={t("logPage.free")} subtitle={t("logPage.freeSubtitle")} />
      <div className="grid gap-6 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px] min-[1151px]:gap-8">
        <form onSubmit={save} className={`${panel} min-w-0`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-foreground">{t("logPage.dateLabel")}</Label>
              <Input type="date" required aria-label={t("logPage.dateLabel")} value={date} min={minDate} max={todayKey} onChange={(e) => setDate(e.target.value)} />
            </div>
            {(subjects?.length ?? 0) > 1 && (
              <label className="grid gap-1.5 text-xs font-medium">
                {t("common.subject")}
                <select value={subjId ?? ""} onChange={(e) => { setSubjectId(Number(e.target.value)); setItemId(undefined); }} className={nativeSelect}>
                  {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="grid gap-1.5 text-xs font-medium">
              {t("logPage.itemOptional")}
              <select value={itemId ?? ""} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : undefined)} className={nativeSelect}>
                <option value="">{t("logPage.noItem")}</option>
                {pieces?.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
            </label>
            {!itemId && (
              <label className="grid gap-1.5 text-xs font-medium">
                {t("logPage.titleLabel")}
                <Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder={t("diary.freeSession")} />
              </label>
            )}
          </div>

          <div className={section}>
            <MarksEditor marks={marks} onChange={setMarks} sections={itemSegments?.map((s) => ({ id: s.id, label: s.label }))} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} />
          </div>

          <div className={`${section} space-y-2`}>
            <Label className="text-xs font-medium text-foreground">{t("session.notes")}</Label>
            <Textarea rows={3} maxLength={2000} aria-label={t("session.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("session.notesPlaceholder")} />
          </div>

          <HelpQuestion on={needHelp} onToggle={setNeedHelp} text={helpText} onText={setHelpText} itemTitle={item?.title} />
          <FormErrors errors={errors} className="mt-6" />
          <Footer onCancel={goBack} disabled={errors.length > 0} busy={busy} />
        </form>
        <Guide />
      </div>
    </div>
  );
}

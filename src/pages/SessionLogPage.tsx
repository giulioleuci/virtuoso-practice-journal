import { tempoContextKey, resolveTempoContext } from "@/domain/logic/tempoProgression";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { SegmentMark, Subject } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Task } from "@/domain/entities/task";
import { syncPlan, emptyEntry, marksFromPlan, planSegmentIds, restartFrom } from "@/domain/logic/plan";
import { missingRatings } from "@/domain/logic/sessionMetrics";
import type { AudioDraft } from "@/domain/ports/audio";
import type { SessionLogInput, SessionTarget } from "@/domain/ports/session";
import type { StudyRoutine } from "@/domain/ports/studyRoutine";
import { presentationQueries } from "@/application/queries/presentationQueryService";
import { applicationCommands } from "@/lib/applicationCommands";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { flattenErrors, newSessionInputSchema, segmentMarkSchema } from "@/lib/schemas";
import { taskDraftScope, draftHasContent } from "@/lib/sessionDrafts";
import { useSessionDraft } from "@/presentation/hooks/useSessionDraft";
import { SessionDraftActions } from "@/components/diary/SessionDraftActions";
import { routineAdaptivity } from "@/lib/domain/studyRoutineGenerator";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useSessionSubmission } from "@/presentation/hooks/usePresentationControllers";
import { useProfile, useSubjects, useTask, useTechniques } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { FloatingActions } from "@/components/shared/FloatingActions";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormErrors } from "@/components/shared/StateNotice";
import { MarksEditor } from "@/components/diary/MarksEditor";
import { ClipDrafts } from "@/components/diary/Recorder";
import { LastSessionStrip } from "@/components/diary/LastSessionStrip";
import { BpmSuggestion } from "@/components/diary/BpmSuggestion";
import { nativeSelect } from "@/components/diary/WhenFields";
import { TeacherAnswersSheet } from "@/components/library/TeacherAnswersSheet";

type Prefill = { marks?: SegmentMark[]; notes?: string; clips?: AudioDraft[] };
const marksDraftKey = (taskId: number) => `virtuoso-marks-${taskId}`;
const panel = "max-w-3xl rounded-lg bg-card p-6 shadow-soft";
const section = "mt-6 border-t border-border pt-6";

const initialMarks = (task?: Task | null, prefill?: Prefill): SegmentMark[] => {
  if (prefill?.marks) return prefill.marks;
  if (task?.id) {
    try {
      const old = segmentMarkSchema.array().safeParse(JSON.parse(localStorage.getItem(marksDraftKey(task.id)) ?? "null"));
      if (old.success) return old.data as SegmentMark[];
    } catch { /* A corrupt legacy draft must not prevent logging. */ }
  }
  return marksFromPlan(task?.plan ?? []);
};

/** Blocking problems of a new session: something studied, every studied section fully rated, valid fields. */
const markErrors = (notes: string, marks: SegmentMark[], t: ReturnType<typeof useI18n>["t"]) => {
  if (!marks.length) return [t("rating.pickStudied")];
  const unrated = marks.filter((m) => missingRatings(m).length > 0).length;
  if (unrated) return [t("rating.missingSummary", { count: unrated })];
  return flattenErrors(newSessionInputSchema.safeParse({ notes, marks }));
};

/** Marks as stored: tempo and note value only mean something outside theory subjects. */


/** Adaptive routines re-plan after a log; the outcome is reported on its own, so a planning failure never touches the saved session. */
async function refreshRoutine(routineId: number, fromDate: string, t: ReturnType<typeof useI18n>["t"], openPlan: () => void): Promise<void> {
  const routine = await presentationQueries().execute<StudyRoutine | undefined>("routines.one", routineId);
  if (!routine || routineAdaptivity(routine) === "uniform") return;
  try {
    await applicationCommands.routines.regenerate.execute(routine, fromDate);
    toast(t("routine.regenerated"), { description: t("routine.regeneratedKept"), action: { label: t("routine.openPlan"), onClick: openPlan } });
  } catch {
    toast.error(t("routine.regenerateFailed"), { action: { label: t("common.retry"), onClick: () => void refreshRoutine(routineId, fromDate, t, openPlan) } });
  }
}

/** `/log?task=ID` logs a session for a planned task; `/log` logs a free session. */
export default function SessionLogPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const location = useLocation();
  const taskId = params.get("task") ? Number(params.get("task")) : undefined;
  const prefill = (location.state as { prefill?: Prefill } | null)?.prefill;
  const task = useTask(taskId);
  const navigate = useNavigate();
  useEffect(() => {
    if (prefill && task) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [prefill, task, navigate, location.pathname, location.search]);

  if (taskId === undefined) return <FreeSessionForm />;
  if (task === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (task === null) return <EmptyState title={t("logPage.taskNotFound")} />;
  return <TaskSessionForm key={task.id} task={task} prefill={prefill} />;
}

/** After a failed save, bring the first unanswered required rating into view and focus, so the musician sees which section. */
function focusFirstInvalid() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="group"][aria-invalid="true"] button')?.focus());
}

function useGoBack() {
  const navigate = useNavigate();
  return () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
}

function BackLink({ onClick }: { onClick?: () => void }) {
  const { t } = useI18n();
  return (
    <Link to="/" onClick={onClick ? (event) => { event.preventDefault(); onClick(); } : undefined} className="mb-4 inline-flex min-h-11 items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
      <ChevronLeft className="h-4 w-4" />{t("nav.today")}
    </Link>
  );
}

function Footer({ onCancel, busy, recording }: { onCancel: () => void; busy: boolean; recording: boolean }) {
  const { t } = useI18n();
  return (
    <FloatingActions className="flex-wrap min-[700px]:max-w-3xl [&>button]:h-auto [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:whitespace-normal">
      <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>{t("draft.leave")}</Button>
      <Button type="submit" disabled={recording || busy}>{busy ? t("logPage.saving") : t("session.saveSession")}</Button>
    </FloatingActions>
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
          <Textarea value={text} maxLength={1000} onChange={(e) => onText(e.target.value)} placeholder={t("help.questionPlaceholder")} rows={3} aria-label={t("help.questionPlaceholder")} />
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
  const navigate = useNavigate();
  const savedId = useRef<number>();
  const { draft, update, clear, storageFailed } = useSessionDraft(taskDraftScope(task), { marks: initialMarks(task), notes: "", clips: [], needHelp: false, helpText: "" }, prefill);
  const { marks, notes, clips, needHelp, helpText } = draft;
  const latestMarks = useRef(marks); latestMarks.current = marks;
  const changeMarks = (marks: SegmentMark[]) => update({ marks });
  const [attempted, setAttempted] = useState(false);
  const [recording, setRecording] = useState(false);
  const leave = () => { if (!storageFailed || window.confirm(t("draft.leaveWarning"))) goBack(); };
  const discard = async () => {
    try { await applicationCommands.audio.discard(clips.map(c => c.uid)); clear(); localStorage.removeItem(marksDraftKey(task.id!)); goBack(); }
    catch { toast.error(t("errors.couldNotSave")); }
  };
  const [showAnswers, setShowAnswers] = useState(false);
  const subject = usePresentationRead<Subject | undefined>("subjects.one", [task.subjectId]);
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [task.itemId]);
  const sections = usePresentationRead<Segment[]>("segments.ids", [planSegmentIds(task.plan)]);
  const answeredCount = usePresentationRead<number>("helpRequests.answeredCount", [task.itemId]) ?? 0;
  const { isTheory, layerOptions, techniqueOptions } = useSubjectOptions(subject);
  // Every planned section keeps a row even if the library segment was deleted; newly ticked rows start from the plan.
  const rows = planSegmentIds(task.plan).map((id) => ({ id, label: sections?.find((s) => s.id === id)?.label ?? "—" }));
  const seed = (id: number) => marksFromPlan(task.plan).find((m) => m.segmentId === id) ?? emptyEntry(id);
  const submission = useSessionSubmission(async ({ input }: { input: SessionLogInput }) => { savedId.current = await applicationCommands.sessions.log.execute(task, input); });

  const errors = useMemo(() => {
    const e = markErrors(notes, marks, t);
    if (needHelp && !helpText.trim()) e.push(t("session.helpDescribe"));
    return e;
  }, [marks, notes, needHelp, helpText, t]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (errors.length) return focusFirstInvalid();
    if (recording || submission.submitting || !task.id) return;
    const logged = marks;
    const ok = await submission.submit({ input: { date: task.date, notes, marks: logged, helpText: needHelp ? helpText.trim() : undefined, clips } });
    if (!ok) return void toast.error(submission.error ?? t("errors.couldNotSave"));
    if (task.studyRoutineId) void refreshRoutine(task.studyRoutineId, task.date, t, () => navigate("/tasks?tab=routines"));
    clear();
    try { localStorage.removeItem(marksDraftKey(task.id)); } catch { /* Session is already saved. */ }
    toast.success(t("toast.sessionLogged"), { description: task.title, action: { label: t("toast.openSession"), onClick: () => navigate(`/sessions/${savedId.current}`) } });
    goBack();
  };

  return (
    <div className="pb-24">
      <BackLink onClick={leave} />
      <PageHeader title={t("logPage.title")}  />
      <div className="-mt-3 mb-5 space-y-1">
        <p className="break-words text-base font-semibold">{task.title}</p>
        {item && item.title !== task.title && <p className="break-words text-sm text-muted-foreground">{item.title}</p>}
        {task.executionNotes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.executionNotes}</p>}
      </div>
      <div>
        {task.itemId && answeredCount > 0 && (
          <button type="button" onClick={() => setShowAnswers(true)} className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
            <MessageSquareQuote className="h-4 w-4" />{t("teacherAnswers.openLabel")} <span className="tabular-nums opacity-70">· {answeredCount}</span>
          </button>
        )}
        <form onSubmit={save} className={`${panel} min-w-0`}>
          {(item ? item.kind !== "theory" : !isTheory) && <div className="mb-5"><BpmSuggestion task={task} onInitialized={(state,reference) => {
            changeMarks(latestMarks.current.map(mark => {
              const context = resolveTempoContext(task,mark,sections ?? []);
              return context && tempoContextKey(context) === state.contextKey ? { ...mark,targetBpm: state.tempo.bpm,targetNoteVal: state.tempo.noteVal,progression: reference } : mark;
            }));
          }} /></div>}

          <LastSessionStrip task={task} onRestart={(previous) => changeMarks(restartFrom(marks, previous))} />
          <div className="mt-4"><MarksEditor marks={marks} onChange={changeMarks} sections={rows} seed={seed} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} showTempo={item ? item.kind !== "theory" : !isTheory} showErrors={attempted} /></div>

          <div className={section}><ClipDrafts clips={clips} onChange={(clips) => update({ clips })} sections={rows} onRecordingChange={setRecording} /></div>

          <div className={`${section} space-y-2`}>
            <Label className="text-xs font-medium text-foreground">{t("session.notes")}</Label>
            <Textarea rows={3} maxLength={2000} aria-label={t("session.notes")} value={notes} onChange={(e) => update({ notes: e.target.value })} placeholder={t("session.notesPlaceholder")} />
          </div>

          <HelpQuestion on={needHelp} onToggle={(needHelp) => update({ needHelp })} text={helpText} onText={(helpText) => update({ helpText })} itemTitle={item?.title} />
          <FormErrors errors={attempted ? errors : []} className="mt-6" />
          <Footer onCancel={leave} busy={submission.submitting} recording={recording} />
        </form>
        <div className="mt-4"><SessionDraftActions storageFailed={storageFailed} hasContent={draftHasContent(draft)} onDiscard={discard} disabled={recording || submission.submitting} /></div>

      </div>
      {task.itemId && <TeacherAnswersSheet open={showAnswers} onOpenChange={setShowAnswers} itemId={task.itemId} itemTitle={item?.title ?? task.title} />}
    </div>
  );
}

// ── Free session ───────────────────────────────────────────────────

function FreeSessionForm() {
  const { t } = useI18n();
  const goBack = useGoBack();
  const navigate = useNavigate();
  const subjects = useSubjects();
  const profile = useProfile();
  const todayKey = today();
  const { draft, update, clear, storageFailed, restored } = useSessionDraft("free", { marks: initialMarks(), notes: "", clips: [], needHelp: false, helpText: "", title: "", date: todayKey });
  const { subjectId, itemId, marks, notes, clips, needHelp, helpText, title = "", date = todayKey } = draft;
  const [attempted, setAttempted] = useState(false);
  const [recording, setRecording] = useState(false);
  const leave = () => { if (!storageFailed || window.confirm(t("draft.leaveWarning"))) goBack(); };
  const discard = async () => {
    try { await applicationCommands.audio.discard(clips.map(c => c.uid)); clear(); goBack(); }
    catch { toast.error(t("errors.couldNotSave")); }
  };
  const [busy, setBusy] = useState(false);

  const subject = subjects?.find((s) => s.id === (subjectId ?? subjects?.[0]?.id));
  const subjId = subject?.id;
  const pieces = usePresentationRead<LibraryItem[]>("library.subject", [subjId]);
  const item = pieces?.find((i) => i.id === itemId);
  const itemSegments = usePresentationRead<Segment[]>("library.segments", [itemId]);
  const seededSelection = useRef({ itemId, ready: restored });
  useEffect(() => {
    if (seededSelection.current.ready && seededSelection.current.itemId === itemId) return;
    if (itemId !== undefined && (itemSegments === undefined || !item)) return;
    seededSelection.current = { itemId, ready: true };
    update({ marks: itemSegments?.length ? [] : marksFromPlan(syncPlan([], [], item)) });
  }, [itemId, item, itemSegments, update]);
  const { isTheory, layerOptions, techniqueOptions } = useSubjectOptions(subject);
  const minDate = useMemo(() => { const d = new Date(todayKey); d.setDate(d.getDate() - (profile?.lateRecoveryDays ?? 3)); return d.toISOString().slice(0, 10); }, [todayKey, profile?.lateRecoveryDays]);

  const errors = useMemo(() => {
    const e = markErrors(notes, marks, t);
    if (subjId === undefined) e.push(t("errors.pickSubject"));
    if (!date) e.push(t("session.dateRequired"));
    if (needHelp && !helpText.trim()) e.push(t("session.helpDescribe"));
    if (needHelp && !itemId) e.push(t("logPage.helpNoItem"));
    return e;
  }, [marks, notes, subjId, date, needHelp, helpText, itemId, t]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (errors.length) return focusFirstInvalid();
    if (recording || busy || subjId === undefined) return;
    setBusy(true);
    try {
      const target: SessionTarget = { subjectId: subjId, linkType: itemId ? "item" : "free", itemId, title: item?.title ?? (title.trim() || t("logPage.free")), plan: [] };
      const id = await applicationCommands.sessions.log.execute(target, { date, notes, marks: marks, helpText: needHelp && itemId ? helpText.trim() : undefined, clips });
      clear();
      toast.success(t("toast.sessionLogged"), { description: target.title, action: { label: t("toast.openSession"), onClick: () => navigate(`/sessions/${id}`) } });
      goBack();
    } catch (err) {
      toast.error((err as Error).message || t("errors.couldNotSave"));
      setBusy(false);
    }
  };

  return (
    <div className="pb-24">
      <BackLink onClick={leave} />
      <PageHeader title={t("logPage.free")}  />
      <div>
        <form onSubmit={save} className={`${panel} min-w-0`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-foreground">{t("logPage.dateLabel")}</Label>
              <Input type="date" required aria-label={t("logPage.dateLabel")} value={date} min={minDate} max={todayKey} onChange={(e) => update({ date: e.target.value })} />
            </div>
            {(subjects?.length ?? 0) > 1 && (
              <label className="grid gap-1.5 text-xs font-medium">
                {t("common.subject")}
                <Select value={String(subjId ?? "")} onValueChange={(value) => update({ subjectId: Number(value), itemId: undefined })} ><SelectTrigger className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>
                  {subjects?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent></Select>
              </label>
            )}
            <label className="grid gap-1.5 text-xs font-medium">
              {t("logPage.itemOptional")}
              <Select value={itemId === undefined ? "__none" : String(itemId)} onValueChange={(value) => update({ itemId: value === "__none" ? undefined : Number(value) })} ><SelectTrigger className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="__none">{t("common.none")}</SelectItem>
                {pieces?.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>)}
              </SelectContent></Select>
            </label>
            {!itemId && (
              <label className="grid gap-1.5 text-xs font-medium">
                {t("logPage.titleLabel")}
                <Input value={title} maxLength={160} onChange={(e) => update({ title: e.target.value })} placeholder={t("logPage.free")} />
              </label>
            )}
          </div>

          <div className={section}>
            <MarksEditor marks={marks} onChange={(marks) => update({ marks })} sections={itemSegments?.map((s) => ({ id: s.id, label: s.label }))} seed={(id) => marksFromPlan(syncPlan([], itemSegments?.filter(s => s.id === id) ?? [], item))[0]} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} showTempo={item ? item.kind !== "theory" : !isTheory} showErrors={attempted} />
          </div>

          <div className={section}><ClipDrafts clips={clips} onChange={(clips) => update({ clips })} sections={itemSegments?.map((s) => ({ id: s.id, label: s.label })) ?? []} onRecordingChange={setRecording} /></div>

          <div className={`${section} space-y-2`}>
            <Label className="text-xs font-medium text-foreground">{t("session.notes")}</Label>
            <Textarea rows={3} maxLength={2000} aria-label={t("session.notes")} value={notes} onChange={(e) => update({ notes: e.target.value })} placeholder={t("session.notesPlaceholder")} />
          </div>

          <HelpQuestion on={needHelp} onToggle={(needHelp) => update({ needHelp })} text={helpText} onText={(helpText) => update({ helpText })} itemTitle={item?.title} />
          <FormErrors errors={attempted ? errors : []} className="mt-6" />
          <Footer onCancel={leave} busy={busy} recording={recording} />
        </form>
        <div className="mt-4"><SessionDraftActions storageFailed={storageFailed} hasContent={draftHasContent(draft)} onDiscard={discard} disabled={recording || busy} /></div>
      </div>
    </div>
  );
}

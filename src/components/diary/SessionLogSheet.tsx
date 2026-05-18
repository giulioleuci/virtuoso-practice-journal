import { useEffect, useMemo, useState } from "react";
import { db, THEORY_LAYERS, type NoteVal, type SessionQuality, type Task, type SegmentMetric } from "@/lib/db"; // db used for useLiveQuery reads only
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { sessionInputSchema, flattenErrors } from "@/lib/schemas";
import { studyRoutinesService, sessionsService } from "@/lib/services";
import { SessionFields, type SessionFieldsValue } from "./SessionFields";
import { StarRating } from "@/components/shared/StarRating";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  prefill?: { bpm?: number; noteVal?: NoteVal; notes?: string };
}

const QUALITY_VALS: { val: SessionQuality; symbol: string; labelKey: string }[] = [
  { val: "hard",    symbol: "♭", labelKey: "session.qualityHard" },
  { val: "improve", symbol: "♮", labelKey: "session.qualityImprove" },
  { val: "well",    symbol: "♯", labelKey: "session.qualityWell" },
  { val: "great",   symbol: "✦", labelKey: "session.qualityGreat" },
];

const initial = (task?: Task | null, prefill?: Props["prefill"]): SessionFieldsValue => ({
  bpm: prefill?.bpm ?? task?.targetBpm,
  noteVal: prefill?.noteVal ?? task?.noteVal,
  reps: undefined,
  confidence: undefined,
  quality: "well" as SessionQuality,
  notes: prefill?.notes ?? "",
  layersUsed: task?.layers ?? [],
  techniquesUsed: task?.techniqueIds ?? [],
  layerScores: {},
  techniqueScores: {},
});

type SegMetricState = { confidence?: number; quality?: SessionQuality; bpmReached?: number; reps?: number };

export function SessionLogSheet({ open, onOpenChange, task, prefill }: Props) {
  const { t } = useI18n();
  const [v, setV] = useState<SessionFieldsValue>(() => initial(task, prefill));
  const [needHelp, setNeedHelp] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [granular, setGranular] = useState(false);
  const [segMetrics, setSegMetrics] = useState<Record<string, SegMetricState>>({});

  const subject = useLiveQuery(
    () => (task?.subjectId ? db.subjects.get(task.subjectId) : Promise.resolve(undefined)),
    [task?.subjectId]
  );
  const libraryItem = useLiveQuery(
    () => (task?.itemId ? db.library.get(task.itemId) : Promise.resolve(undefined)),
    [task?.itemId]
  );
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);
  const taskSegments = useLiveQuery(
    () =>
      task?.segmentIds?.length
        ? db.segments.where("id").anyOf(task.segmentIds).filter((s) => !s.deletedAt).toArray()
        : Promise.resolve([]),
    [task?.segmentIds?.join(",")]
  );

  const isTheory = subject?.type === "theory";
  const showGranularToggle = (taskSegments?.length ?? 0) >= 2;

  const layerOptions = useMemo(() => {
    if (isTheory) {
      return THEORY_LAYERS.map((l) => ({ value: l, label: t(`library.mastery.${l}`) }));
    }
    const base = task?.layers?.length ? task.layers : (subject?.layers ?? []);
    return base.map((l) => ({ value: l, label: l }));
  }, [task, subject, isTheory, t]);

  const techniqueOptions = useMemo(() => {
    const ids = task?.techniqueIds && task.techniqueIds.length ? task.techniqueIds : null;
    const all = (allTechniques ?? []).filter((t) => t.subjectId === task?.subjectId);
    const scoped = ids ? all.filter((t) => ids.includes(t.id!)) : all;
    return scoped.map((t) => ({ value: t.id!, label: t.name }));
  }, [allTechniques, task]);

  useEffect(() => {
    if (open && task) {
      setV(initial(task, prefill));
      setNeedHelp(false);
      setHelpText("");
      setGranular(false);
      setSegMetrics({});
    }
  }, [open, task, prefill]);

  const updateSegMetric = (segId: string, patch: Partial<SegMetricState>) => {
    setSegMetrics((prev) => ({ ...prev, [segId]: { ...prev[segId], ...patch } }));
  };

  const buildSegmentMetrics = (): Record<string, SegmentMetric> => {
    const result: Record<string, SegmentMetric> = {};
    for (const [segId, m] of Object.entries(segMetrics)) {
      if (m.confidence !== undefined || m.quality !== undefined || m.bpmReached !== undefined || m.reps !== undefined) {
        result[segId] = m;
      }
    }
    return result;
  };

  const errors = useMemo(() => {
    if (granular) {
      const e: string[] = [];
      if (v.notes.trim().length > 2000) e.push(t("errors.notesMaxLength"));
      if (needHelp && !helpText.trim()) e.push(t("session.helpDescribe"));
      return e;
    }
    const res = sessionInputSchema.safeParse({
      bpmReached: v.bpm, noteVal: v.noteVal, reps: v.reps, confidence: v.confidence,
      quality: v.quality, notes: v.notes, layersUsed: v.layersUsed, techniquesUsed: v.techniquesUsed,
    });
    const e = flattenErrors(res);
    if (needHelp && !helpText.trim()) e.push(t("session.helpDescribe"));
    return e;
  }, [v, needHelp, helpText, granular, t]);

  const save = async () => {
    if (!task?.id || errors.length) return;

    const layersUsed = v.layersUsed;
    const layerScores = layersUsed.length > 0
      ? Object.fromEntries(layersUsed.map((l) => [l, v.layerScores[l] ?? 0]))
      : undefined;
    const techniquesUsed = v.techniquesUsed;
    const techniqueScores = techniquesUsed.length > 0
      ? Object.fromEntries(techniquesUsed.map((id) => [id, v.techniqueScores[id] ?? 0]))
      : undefined;

    await sessionsService.logWithCompletion(task, {
      date: task.date,
      bpmReached: granular ? undefined : (isTheory ? undefined : v.bpm),
      noteVal: granular ? undefined : (isTheory ? undefined : v.noteVal),
      reps: granular ? undefined : (isTheory ? undefined : v.reps),
      confidence: granular ? undefined : v.confidence,
      quality: granular ? undefined : v.quality,
      notes: v.notes,
      layersUsed,
      techniquesUsed,
      layerScores,
      techniqueScores,
      segmentMetrics: granular ? buildSegmentMetrics() : undefined,
      helpText: needHelp ? helpText.trim() : undefined,
    });

    if (task.studyRoutineId) {
      const routine = await db.studyRoutines.get(task.studyRoutineId);
      if (routine && routine.useSpacedRepetition) {
        studyRoutinesService.regenerateFromDate(routine, task.date).catch(() => {});
      }
    }

    toast.success(t("toast.sessionLogged"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("session.log")}</SheetTitle>
          {task && (
            <div className="space-y-1.5 pt-2 text-left">
              <p className="font-serif text-2xl leading-tight">{task.title}</p>
              {libraryItem?.composer && (
                <p className="font-serif text-lg italic text-muted-foreground leading-tight">
                  {libraryItem.composer}
                </p>
              )}
              {taskSegments && taskSegments.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-0.5 pt-1">
                  {taskSegments.map((s) => (
                    <li key={s.id}>{s.label}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {showGranularToggle && (
            <div className="paper-card p-4 flex items-center justify-between">
              <div className="font-medium text-sm">{t("session.evaluateSegments")}</div>
              <Switch checked={granular} onCheckedChange={setGranular} />
            </div>
          )}

          {granular && taskSegments ? (
            <>
              {taskSegments.map((seg) => {
                const segId = String(seg.id!);
                const m: SegMetricState = segMetrics[segId] ?? {};
                return (
                  <div key={segId} className="paper-card p-4 space-y-4">
                    <div className="font-serif text-base font-medium">{seg.label}</div>

                    <StarRating
                      label={t("session.confidenceLabel")}
                      value={m.confidence}
                      onChange={(c) => updateSegMetric(segId, { confidence: c })}
                    />

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        {t("session.qualityLabel")}
                      </Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {QUALITY_VALS.map((q) => (
                          <button
                            key={q.val}
                            type="button"
                            onClick={() => updateSegMetric(segId, { quality: q.val })}
                            className={cn(
                              "paper-card flex flex-col items-center py-2 transition-all",
                              m.quality === q.val ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
                            )}
                          >
                            <span className="text-xl font-serif leading-none">{q.symbol}</span>
                            <span className="text-[10px] mt-0.5">{t(q.labelKey)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {!isTheory && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                            {t("session.bpmReached")}
                          </Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={20}
                            max={400}
                            value={m.bpmReached ?? ""}
                            onChange={(e) =>
                              updateSegMetric(segId, {
                                bpmReached: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                            {t("session.repetitions")}
                          </Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={9999}
                            value={m.reps ?? ""}
                            onChange={(e) =>
                              updateSegMetric(segId, {
                                reps: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <SessionFields
                value={v}
                onChange={(patch) => setV((cur) => ({ ...cur, ...patch }))}
                layerOptions={layerOptions}
                techniqueOptions={techniqueOptions}
                isTheory={isTheory}
                hideMetrics
              />
            </>
          ) : (
            <SessionFields
              value={v}
              onChange={(patch) => setV((cur) => ({ ...cur, ...patch }))}
              layerOptions={layerOptions}
              techniqueOptions={techniqueOptions}
              isTheory={isTheory}
            />
          )}

          <div className="paper-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{t("session.needHelp")}</div>
                <div className="text-xs text-muted-foreground">{t("session.flagLesson")}</div>
              </div>
              <Switch checked={needHelp} onCheckedChange={setNeedHelp} />
            </div>
            {needHelp && (
              <Textarea
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder={t("session.helpPlaceholder")}
                rows={3}
              />
            )}
          </div>

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              {t("session.saveSession")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

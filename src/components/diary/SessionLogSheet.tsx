import { useEffect, useMemo, useState } from "react";
import { useTechniques } from "@/hooks/useEntities";
import { db, THEORY_LAYERS, type NoteVal, type SessionQuality, type Task, type SegmentMetric } from "@/lib/db"; // db used for useLiveQuery reads only
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { sessionInputSchema, flattenErrors } from "@/lib/schemas";
import { studyRoutinesService, sessionsService } from "@/lib/services";
import { QUALITY_VALS } from "@/lib/constants";
import { SessionFields, type SessionFieldsValue } from "./SessionFields";
import { StarRating } from "@/components/shared/StarRating";
import { LastSessionStrip } from "./LastSessionStrip";
import { BpmSuggestion } from "./BpmSuggestion";
import { TeacherAnswersSheet } from "@/components/library/TeacherAnswersSheet";
import { MessageSquareQuote, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const segDraftKey = (taskId: number) => `virtuoso-segmetrics-${taskId}`;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  prefill?: { bpm?: number; noteVal?: NoteVal; notes?: string };
}


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

type SegMetricState = {
  confidence?: number;
  quality?: SessionQuality;
  bpmReached?: number;
  reps?: number;
  layersOverridden?: boolean;
  layersUsed?: string[];
  layerScores?: Record<string, number>;
  techniquesOverridden?: boolean;
  techniquesUsed?: number[];
  techniqueScores?: Record<number, number>;
};

export function SessionLogSheet({ open, onOpenChange, task, prefill }: Props) {
  const { t } = useI18n();
  const [v, setV] = useState<SessionFieldsValue>(() => initial(task, prefill));
  const [needHelp, setNeedHelp] = useState(false);
  const [helpText, setHelpText] = useState("");
  const initialGranular = (task?.segmentIds?.length ?? 0) >= 2;
  const [granular, setGranular] = useState(initialGranular);
  const [segMetrics, setSegMetrics] = useState<Record<string, SegMetricState>>({});
  const [bpmSuggestionDismissed, setBpmSuggestionDismissed] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [showAnswers, setShowAnswers] = useState(false);

  const answeredCount = useLiveQuery(
    () =>
      task?.itemId
        ? db.helpRequests.where("itemId").equals(task.itemId).filter((r) => !!r.answer).count()
        : Promise.resolve(0),
    [task?.itemId]
  ) ?? 0;

  const subject = useLiveQuery(
    () => (task?.subjectId ? db.subjects.get(task.subjectId) : Promise.resolve(undefined)),
    [task?.subjectId]
  );
  const libraryItem = useLiveQuery(
    () => (task?.itemId ? db.library.get(task.itemId) : Promise.resolve(undefined)),
    [task?.itemId]
  );
  const allTechniques = useTechniques();
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
    const scoped = ids ? all.filter((t) => ids.includes(t.id)) : all;
    return scoped.map((t) => ({ value: t.id, label: t.name }));
  }, [allTechniques, task]);

  useEffect(() => {
    if (open && task) {
      setV(initial(task, prefill));
      setNeedHelp(false);
      setHelpText("");
      setGranular((task?.segmentIds?.length ?? 0) >= 2);
      // Restore persisted per-segment overrides for this task, if any
      let restored: Record<string, SegMetricState> = {};
      if (task.id) {
        try {
          const raw = localStorage.getItem(segDraftKey(task.id));
          if (raw) restored = JSON.parse(raw) ?? {};
        } catch { /* ignore */ }
      }
      setSegMetrics(restored);
      setBpmSuggestionDismissed(false);
      setCarouselIndex(0);
    }
  }, [open, task, prefill]);

  // Autosave segment overrides to localStorage
  useEffect(() => {
    if (!open || !task?.id) return;
    try {
      if (Object.keys(segMetrics).length === 0) {
        localStorage.removeItem(segDraftKey(task.id));
      } else {
        localStorage.setItem(segDraftKey(task.id), JSON.stringify(segMetrics));
      }
    } catch { /* ignore */ }
  }, [segMetrics, open, task?.id]);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCarouselIndex(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    onSelect();
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const updateSegMetric = (segId: string, patch: Partial<SegMetricState>) => {
    setSegMetrics((prev) => ({ ...prev, [segId]: { ...prev[segId], ...patch } }));
  };

  const applyDefaultsToAllSegments = () => {
    if (!taskSegments?.length) return;
    const defaultLayers = task?.layers ?? [];
    const defaultTechs = task?.techniqueIds ?? [];
    setSegMetrics((prev) => {
      const next = { ...prev };
      for (const seg of taskSegments) {
        const segId = String(seg.id);
        next[segId] = {
          ...next[segId],
          layersOverridden: true,
          layersUsed: [...defaultLayers],
          layerScores: { ...(next[segId]?.layerScores ?? {}) },
          techniquesOverridden: true,
          techniquesUsed: [...defaultTechs],
          techniqueScores: { ...(next[segId]?.techniqueScores ?? {}) },
        };
      }
      return next;
    });
    toast.success(t("session.defaultsCopied"));
  };

  const buildSegmentMetrics = (): Record<string, SegmentMetric> => {
    const result: Record<string, SegmentMetric> = {};
    for (const [segId, m] of Object.entries(segMetrics)) {
      const hasMetric =
        m.confidence !== undefined ||
        m.quality !== undefined ||
        m.bpmReached !== undefined ||
        m.reps !== undefined ||
        m.layersOverridden ||
        m.techniquesOverridden;
      if (!hasMetric) continue;
      const entry: SegmentMetric = {
        confidence: m.confidence,
        quality: m.quality,
        bpmReached: m.bpmReached,
        reps: m.reps,
      };
      if (m.layersOverridden) {
        entry.layersUsed = m.layersUsed ?? [];
        if (entry.layersUsed.length) {
          entry.layerScores = Object.fromEntries(
            entry.layersUsed.map((l) => [l, m.layerScores?.[l] ?? 0])
          );
        }
      }
      if (m.techniquesOverridden) {
        entry.techniquesUsed = m.techniquesUsed ?? [];
        if (entry.techniquesUsed.length) {
          entry.techniqueScores = Object.fromEntries(
            entry.techniquesUsed.map((id) => [id, m.techniqueScores?.[id] ?? 0])
          );
        }
      }
      result[segId] = entry;
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

    if (task.id) {
      try { localStorage.removeItem(segDraftKey(task.id)); } catch { /* ignore */ }
    }
    toast.success(t("toast.sessionLogged"));
    onOpenChange(false);
  };

  return (
    <>
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
              {task.itemId && answeredCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAnswers(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20"
                >
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                  {t("teacherAnswers.openLabel")}
                  <span className="tabular-nums opacity-70">· {answeredCount}</span>
                </button>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {task && <LastSessionStrip task={task} />}

          {task && !isTheory && (
            <BpmSuggestion
              task={task}
              dismissed={bpmSuggestionDismissed}
              onDismiss={() => setBpmSuggestionDismissed(true)}
              onAccept={(bpm) => {
                setV((cur) => ({ ...cur, bpm }));
                setBpmSuggestionDismissed(true);
              }}
            />
          )}

          {showGranularToggle && (
            <div className="paper-card p-4 flex items-center justify-between">
              <div className="font-medium text-sm">{t("session.evaluateSegments")}</div>
              <Switch checked={granular} onCheckedChange={setGranular} />
            </div>
          )}

          {granular && taskSegments ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    aria-label={t("common.previous")}
                    disabled={carouselIndex === 0}
                    onClick={() => carouselApi?.scrollPrev()}
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("session.segmentIndicator", {
                      current: String(carouselIndex + 1),
                      total: String(taskSegments.length),
                    })}
                  </div>
                  <div className="flex gap-1 flex-1 justify-center">
                    {taskSegments.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`${i + 1}`}
                        onClick={() => carouselApi?.scrollTo(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === carouselIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                        )}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label={t("session.copyDefaultsToAll")}
                    title={t("session.copyDefaultsToAll")}
                    onClick={applyDefaultsToAllSegments}
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("common.next")}
                    disabled={carouselIndex >= taskSegments.length - 1}
                    onClick={() => carouselApi?.scrollNext()}
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <Carousel setApi={setCarouselApi} opts={{ align: "start" }} className="w-full">
                  <CarouselContent>
                    {taskSegments.map((seg) => {
                      const segId = String(seg.id);
                      const m: SegMetricState = segMetrics[segId] ?? {};
                      const segLayers = m.layersOverridden ? (m.layersUsed ?? []) : (task?.layers ?? []);
                      const segTechs = m.techniquesOverridden ? (m.techniquesUsed ?? []) : (task?.techniqueIds ?? []);
                      return (
                        <CarouselItem key={segId} className="basis-full">
                          <div className="paper-card p-4 space-y-4">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="font-serif text-base font-medium leading-tight">{seg.label}</div>
                            </div>

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

                            {/* Layers override */}
                            <div className="space-y-2">
                              <MultiChipPicker
                                label={t("session.segmentLayersOverride")}
                                options={layerOptions}
                                value={segLayers}
                                onChange={(next) =>
                                  updateSegMetric(segId, {
                                    layersOverridden: true,
                                    layersUsed: next,
                                  })
                                }
                              />
                              {segLayers.length > 0 && (
                                <Accordion type="single" collapsible className="paper-card overflow-hidden">
                                  <AccordionItem value="seg-layer-scores" className="border-none">
                                    <AccordionTrigger className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:no-underline">
                                      {t("session.layerScores")}
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                      <div className="space-y-4 pt-1">
                                        {segLayers.map((layer) => {
                                          const score = m.layerScores?.[layer] ?? 0;
                                          return (
                                            <div key={layer} className="space-y-2">
                                              <div className="flex items-baseline justify-between">
                                                <div className="font-medium text-sm">
                                                  {isTheory ? t(`library.mastery.${layer}`) : layer}
                                                </div>
                                                <div className="font-serif text-base tabular-nums text-primary">
                                                  {score}
                                                  <span className="text-xs text-muted-foreground">/100</span>
                                                </div>
                                              </div>
                                              <Slider
                                                value={[score]}
                                                min={0}
                                                max={100}
                                                step={5}
                                                onValueChange={(nv) =>
                                                  updateSegMetric(segId, {
                                                    layersOverridden: true,
                                                    layerScores: { ...(m.layerScores ?? {}), [layer]: nv[0] },
                                                  })
                                                }
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
                            </div>

                            {/* Techniques override */}
                            <div className="space-y-2">
                              <MultiChipPicker
                                label={t("session.segmentTechniquesOverride")}
                                options={techniqueOptions}
                                value={segTechs}
                                onChange={(next) =>
                                  updateSegMetric(segId, {
                                    techniquesOverridden: true,
                                    techniquesUsed: next,
                                  })
                                }
                              />
                              {segTechs.length > 0 && (
                                <Accordion type="single" collapsible className="paper-card overflow-hidden">
                                  <AccordionItem value="seg-tech-scores" className="border-none">
                                    <AccordionTrigger className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:no-underline">
                                      {t("session.techniqueScores")}
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                      <div className="space-y-4 pt-1">
                                        {segTechs.map((id) => {
                                          const label = techniqueOptions.find((o) => o.value === id)?.label ?? String(id);
                                          const score = m.techniqueScores?.[id] ?? 0;
                                          return (
                                            <div key={id} className="space-y-2">
                                              <div className="flex items-baseline justify-between">
                                                <div className="font-medium text-sm">{label}</div>
                                                <div className="font-serif text-base tabular-nums text-primary">
                                                  {score}
                                                  <span className="text-xs text-muted-foreground">/100</span>
                                                </div>
                                              </div>
                                              <Slider
                                                value={[score]}
                                                min={0}
                                                max={100}
                                                step={5}
                                                onValueChange={(nv) =>
                                                  updateSegMetric(segId, {
                                                    techniquesOverridden: true,
                                                    techniqueScores: { ...(m.techniqueScores ?? {}), [id]: nv[0] },
                                                  })
                                                }
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
                            </div>
                          </div>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                </Carousel>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("session.notes")}</Label>
                <Textarea
                  rows={3}
                  value={v.notes}
                  onChange={(e) => setV((cur) => ({ ...cur, notes: e.target.value }))}
                  placeholder={t("session.notesPlaceholder")}
                />
              </div>
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
    {task?.itemId && (
      <TeacherAnswersSheet
        open={showAnswers}
        onOpenChange={setShowAnswers}
        itemId={task.itemId}
        itemTitle={libraryItem?.title ?? task.title}
      />
    )}
    </>
  );
}

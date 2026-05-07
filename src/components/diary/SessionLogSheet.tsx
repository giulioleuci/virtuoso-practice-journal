import { useEffect, useMemo, useState } from "react";
import { db, buildSessionSnapshot, THEORY_LAYERS, type NoteVal, type SessionQuality, type Task } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { sessionInputSchema, flattenErrors } from "@/lib/schemas";
import { SessionFields, type SessionFieldsValue } from "./SessionFields";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  prefill?: { bpm?: number; noteVal?: NoteVal; notes?: string };
}

const emptyLayerScores = () =>
  Object.fromEntries(THEORY_LAYERS.map((l) => [l, 0])) as Record<string, number>;

const initial = (task?: Task | null, prefill?: Props["prefill"]): SessionFieldsValue => ({
  bpm: prefill?.bpm ?? task?.targetBpm,
  noteVal: prefill?.noteVal ?? task?.noteVal,
  reps: undefined,
  confidence: undefined,
  quality: "well" as SessionQuality,
  notes: prefill?.notes ?? "",
  layersUsed: task?.layers ?? [],
  techniquesUsed: task?.techniqueIds ?? [],
  layerScores: emptyLayerScores(),
});

export function SessionLogSheet({ open, onOpenChange, task, prefill }: Props) {
  const { t } = useI18n();
  const [v, setV] = useState<SessionFieldsValue>(() => initial(task, prefill));
  const [needHelp, setNeedHelp] = useState(false);
  const [helpText, setHelpText] = useState("");

  const subject = useLiveQuery(
    () => (task?.subjectId ? db.subjects.get(task.subjectId) : Promise.resolve(undefined)),
    [task?.subjectId]
  );
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);

  const isTheory = subject?.type === "theory";

  const layerOptions = useMemo(() => {
    const base = task?.layers?.length ? task.layers : (subject?.layers ?? []);
    return base.map((l) => ({ value: l, label: l }));
  }, [task, subject]);
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
    }
  }, [open, task, prefill]);

  const errors = useMemo(() => {
    const res = sessionInputSchema.safeParse({
      bpmReached: v.bpm, noteVal: v.noteVal, reps: v.reps, confidence: v.confidence,
      quality: v.quality, notes: v.notes, layersUsed: v.layersUsed, techniquesUsed: v.techniquesUsed,
    });
    const e = flattenErrors(res);
    if (needHelp && !helpText.trim()) e.push(t("session.helpDescribe"));
    return e;
  }, [v, needHelp, helpText]);

  const save = async () => {
    if (!task?.id || errors.length) return;
    const now = Date.now();

    // For theory sessions, derive layersUsed from dimensions with non-zero scores
    const layersUsed = isTheory
      ? THEORY_LAYERS.filter((l) => (v.layerScores[l] ?? 0) > 0)
      : v.layersUsed;

    const snapshot = await buildSessionSnapshot({
      ...task,
      layers: layersUsed,
      techniqueIds: v.techniquesUsed,
      targetBpm: v.bpm ?? task.targetBpm,
      noteVal: v.noteVal ?? task.noteVal,
    });
    await db.transaction("rw", db.tasks, db.sessions, db.helpRequests, async () => {
      const sessionId = await db.sessions.add({
        taskId: task.id!,
        date: task.date,
        bpmReached: isTheory ? undefined : v.bpm,
        noteVal: isTheory ? undefined : v.noteVal,
        reps: isTheory ? undefined : v.reps,
        confidence: v.confidence,
        quality: v.quality,
        notes: v.notes.trim() || undefined,
        layersUsed,
        techniquesUsed: v.techniquesUsed,
        layerScores: isTheory ? v.layerScores : undefined,
        snapshot,
        createdAt: now,
      });
      await db.tasks.update(task.id!, { done: true });
      if (needHelp) {
        await db.helpRequests.add({
          sessionId: sessionId as number,
          taskId: task.id!,
          itemId: task.itemId,
          question: helpText.trim(),
          resolved: false,
          createdAt: now,
        });
      }
    });
    toast.success(t("toast.sessionLogged"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("session.log")}</SheetTitle>
          {task && <p className="text-sm text-muted-foreground italic">{task.title}</p>}
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <SessionFields
            value={v}
            onChange={(patch) => setV((cur) => ({ ...cur, ...patch }))}
            layerOptions={layerOptions}
            techniqueOptions={techniqueOptions}
            isTheory={isTheory}
          />

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

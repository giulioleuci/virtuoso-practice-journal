import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type NoteVal, type Session, type SessionQuality } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sessionInputSchema, flattenErrors } from "@/lib/schemas";
import { SessionFields, type SessionFieldsValue } from "./SessionFields";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: Session | null;
}

const initial = (s?: Session | null): SessionFieldsValue => ({
  bpm: s?.bpmReached,
  noteVal: s?.noteVal,
  reps: s?.reps,
  confidence: s?.confidence,
  quality: (s?.quality ?? "well") as SessionQuality,
  notes: s?.notes ?? "",
  layersUsed: s?.layersUsed ?? [],
  techniquesUsed: s?.techniquesUsed ?? [],
  layerScores: s?.layerScores ?? {},
});

export function SessionDetailSheet({ open, onOpenChange, session }: Props) {
  const { t } = useI18n();
  const task = useLiveQuery(
    () => (session?.taskId ? db.tasks.get(session.taskId) : Promise.resolve(undefined)),
    [session?.taskId]
  );
  const item = useLiveQuery(
    () => (task?.itemId ? db.library.get(task.itemId) : Promise.resolve(undefined)),
    [task?.itemId]
  );
  const segments = useLiveQuery(
    () => (task?.segmentIds?.length
      ? db.segments.where("id").anyOf(task.segmentIds).toArray()
      : Promise.resolve([])),
    [task?.segmentIds?.join(",")]
  );

  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [v, setV] = useState<SessionFieldsValue>(() => initial(session));
  const [confirmDel, setConfirmDel] = useState(false);

  const subject = useLiveQuery(
    () => (task?.subjectId ? db.subjects.get(task.subjectId) : Promise.resolve(undefined)),
    [task?.subjectId]
  );
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);
  const layerOptions = (subject?.layers ?? []).map((l) => ({ value: l, label: l }));
  const techniqueOptions = (allTechniques ?? [])
    .filter((t) => t.subjectId === task?.subjectId)
    .map((t) => ({ value: t.id!, label: t.name }));

  useEffect(() => {
    if (open && session) {
      setEditing(false);
      setDate(session.date);
      setV(initial(session));
    }
  }, [open, session]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!date) e.push(t("session.dateRequired"));
    const res = sessionInputSchema.safeParse({
      bpmReached: v.bpm, noteVal: v.noteVal, reps: v.reps, confidence: v.confidence,
      quality: v.quality, notes: v.notes, layersUsed: v.layersUsed, techniquesUsed: v.techniquesUsed,
    });
    return [...e, ...flattenErrors(res)];
  }, [date, v]);

  const save = async () => {
    if (!session?.id || errors.length) return;
    await db.sessions.update(session.id, {
      date, bpmReached: v.bpm, noteVal: v.noteVal, quality: v.quality,
      notes: v.notes.trim() || undefined,
      layersUsed: v.layersUsed, techniquesUsed: v.techniquesUsed,
      reps: v.reps, confidence: v.confidence,
    });
    toast.success(t("toast.sessionUpdated"));
    setEditing(false);
  };


  const del = async () => {
    if (!session?.id) return;
    const taskId = session.taskId;
    await db.sessions.delete(session.id);
    if (taskId) {
      const remaining = await db.sessions.where("taskId").equals(taskId).count();
      if (remaining === 0) await db.tasks.update(taskId, { done: false });
    }
    toast.success(t("toast.sessionDeleted"));
    setConfirmDel(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("session.sessionTitle")}</SheetTitle>
        </SheetHeader>

        {!session ? null : (
          <div className="mt-4 space-y-4">
            <div className="paper-card p-3 space-y-1">
              <div className="font-serif text-lg">{session.snapshot?.taskTitle ?? task?.title ?? "—"}</div>
              {(session.snapshot?.itemTitle || item) && (
                <div className="text-xs text-muted-foreground">
                  {session.snapshot?.itemTitle ?? item?.title}
                  {(session.snapshot?.itemComposer ?? item?.composer)
                    ? ` · ${session.snapshot?.itemComposer ?? item?.composer}` : ""}
                </div>
              )}
              {(() => {
                const labels =
                  session.snapshot?.segmentLabels?.length
                    ? session.snapshot.segmentLabels
                    : segments?.map((s) => s.label) ?? [];
                if (!labels.length && !session.snapshot?.collectionName) return null;
                return (
                  <>
                    {!!labels.length && (
                      <div className="text-xs text-muted-foreground italic">
                        {labels.length > 1 ? t("session.segmentTitle_plural") : t("session.segmentTitle")}: {labels.join(", ")}
                      </div>
                    )}
                    {session.snapshot?.collectionName && (
                      <div className="text-xs text-muted-foreground italic">
                        {t("session.collectionLabel")}: {session.snapshot.collectionName}
                      </div>
                    )}
                  </>
                );
              })()}
              {session.snapshot && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 pt-1">
                  {t("session.snapshotLabel")} · {session.snapshot.subjectName}
                </div>
              )}
            </div>

            {!editing ? (
              <>
                <dl className="paper-card p-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.date")}</dt>
                    <dd className="tabular-nums">{session.date}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.qualityFieldLabel")}</dt>
                    <dd className="capitalize">{session.quality ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.bpmLabel")}</dt>
                    <dd className="tabular-nums">{session.bpmReached ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.noteValLabel")}</dt>
                    <dd>{session.noteVal ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.repsLabel")}</dt>
                    <dd className="tabular-nums">{session.reps ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.confidenceLabel")}</dt>
                    <dd className="tabular-nums">{session.confidence != null ? `${session.confidence}/5` : "—"}</dd>
                  </div>
                </dl>

                {session.notes && (
                  <div className="paper-card p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("session.notes")}</div>
                    <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
                  </div>
                )}
                {(session.layersUsed?.length || session.techniquesUsed?.length) ? (
                  <div className="paper-card p-3 space-y-2 text-xs">
                    {!!session.layersUsed?.length && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("session.layersLabel")}</div>
                        <div className="flex flex-wrap gap-1.5">{session.layersUsed.map((l) => (
                          <span key={l} className="px-2 py-0.5 rounded-full bg-accent/60">{l}</span>
                        ))}</div>
                      </div>
                    )}
                    {!!session.techniquesUsed?.length && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("session.techniquesLabel")}</div>
                        <div className="flex flex-wrap gap-1.5">{session.techniquesUsed.map((id) => {
                          const n = (allTechniques ?? []).find((tech) => tech.id === id)?.name;
                          return n ? <span key={id} className="px-2 py-0.5 rounded-full bg-accent/60">{n}</span> : null;
                        })}</div>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditing(true)}>{t("common.edit")}</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => setConfirmDel(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.date")}</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <SessionFields
                  value={v}
                  onChange={(patch) => setV((cur) => ({ ...cur, ...patch }))}
                  layerOptions={layerOptions}
                  techniqueOptions={techniqueOptions}
                />

                {errors.length > 0 && (
                  <ul className="text-xs text-destructive space-y-0.5">
                    {errors.map((e) => <li key={e}>• {e}</li>)}
                  </ul>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
                  <Button className="flex-1" disabled={errors.length > 0} onClick={save}>{t("common.save")}</Button>
                </div>
              </>
            )}
          </div>
        )}

        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("session.delete")}</AlertDialogTitle>
              <AlertDialogDescription>{t("dialog.deleteSessionDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTechniques } from "@/hooks/useEntities";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { NoteVal, SessionQuality, Subject } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { sessionsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
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
  techniqueScores: s?.techniqueScores ?? {},
});

export function SessionDetailSheet({ open, onOpenChange, session }: Props) {
  const { t, lang } = useI18n();
  const task = usePresentationRead<Task | undefined>("tasks.one", [session?.taskId]);
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [task?.itemId]);
  const segments = usePresentationRead<Segment[]>("segments.ids", [task?.segmentIds ?? []]);

  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [v, setV] = useState<SessionFieldsValue>(() => initial(session));
  const [confirmDel, setConfirmDel] = useState(false);

  const subject = usePresentationRead<Subject | undefined>("subjects.one", [task?.subjectId]);
  const allTechniques = useTechniques();
  const isTheory = subject?.type === "theory";
  const layerOptions = isTheory
    ? THEORY_LAYERS.map((l) => ({ value: l, label: t(`library.mastery.${l}`) }))
    : (subject?.layers ?? []).map((l) => ({ value: l, label: l }));
  const techniqueOptions = (allTechniques ?? [])
    .filter((t) => t.subjectId === task?.subjectId)
    .map((t) => ({ value: t.id, label: t.name }));

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
  }, [date, v, t]);

  const save = async () => {
    if (!session?.id || errors.length) return;
    const techniquesUsed = v.techniquesUsed;
    const techniqueScores = techniquesUsed.length > 0
      ? Object.fromEntries(techniquesUsed.map((id) => [id, v.techniqueScores[id] ?? 0]))
      : undefined;
    await sessionsService.update(session.id, {
      date, bpmReached: v.bpm, noteVal: v.noteVal, quality: v.quality,
      notes: v.notes.trim() || undefined,
      layersUsed: v.layersUsed, techniquesUsed, techniqueScores,
      reps: v.reps, confidence: v.confidence,
    });
    toast.success(t("toast.sessionUpdated"));
    setEditing(false);
  };

  const del = async () => {
    if (!session?.id) return;
    await sessionsService.deleteWithTaskReset(session.id, session.taskId);
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
                  session.snapshot?.segments?.length
                    ? session.snapshot.segments.map((s) => s.label)
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
                    <dd className="tabular-nums">{formatDate(session.date, lang)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.qualityFieldLabel")}</dt>
                    <dd>{session.quality ? t(`session.quality${session.quality.charAt(0).toUpperCase() + session.quality.slice(1)}`) : "—"}</dd>
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
                {session.segmentMetrics && session.snapshot?.segments?.length ? (
                  <div className="paper-card p-3 space-y-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("session.segmentBreakdown")}
                    </div>
                    {session.snapshot.segments.map(({ id, label }) => {
                      const m = session.segmentMetrics?.[id];
                      if (!m) return null;
                      return (
                        <div key={id} className="space-y-1 pb-2 border-b border-border/40 last:border-0 last:pb-0">
                          <div className="font-medium text-sm">{label}</div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {m.confidence != null && <span>★ {m.confidence}/5</span>}
                            {m.quality && (
                              <span>{t(`session.quality${m.quality.charAt(0).toUpperCase() + m.quality.slice(1)}`)}</span>
                            )}
                            {m.bpmReached != null && <span>{m.bpmReached} BPM</span>}
                            {m.reps != null && <span>{m.reps} reps</span>}
                          </div>
                          {!!m.layersUsed?.length && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {m.layersUsed.map((l) => {
                                const score = m.layerScores?.[l];
                                const lbl = isTheory ? t(`library.mastery.${l}`) : l;
                                return (
                                  <span key={l} className="px-2 py-0.5 rounded-full text-[11px] bg-accent/60 inline-flex items-center gap-1">
                                    <span>{lbl}</span>
                                    {score != null && (
                                      <span className="tabular-nums text-primary font-medium">{score}<span className="text-muted-foreground">/100</span></span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {!!m.techniquesUsed?.length && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {m.techniquesUsed.map((tid) => {
                                const n = (allTechniques ?? []).find((tech) => tech.id === tid)?.name;
                                if (!n) return null;
                                const score = m.techniqueScores?.[tid];
                                return (
                                  <span key={tid} className="px-2 py-0.5 rounded-full text-[11px] bg-accent/60 inline-flex items-center gap-1">
                                    <span>{n}</span>
                                    {score != null && (
                                      <span className="tabular-nums text-primary font-medium">{score}<span className="text-muted-foreground">/100</span></span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {(session.layersUsed?.length || session.techniquesUsed?.length) ? (
                  <div className="paper-card p-3 space-y-3 text-xs">
                    {!!session.layersUsed?.length && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.layersLabel")}</div>
                        <div className="flex flex-wrap gap-1.5">{session.layersUsed.map((l) => {
                          const score = session.layerScores?.[l];
                          const label = isTheory ? t(`library.mastery.${l}`) : l;
                          return (
                            <span key={l} className="px-2 py-0.5 rounded-full bg-accent/60 inline-flex items-center gap-1">
                              <span>{label}</span>
                              {score != null && (
                                <span className="tabular-nums text-primary font-medium">{score}<span className="text-muted-foreground">/100</span></span>
                              )}
                            </span>
                          );
                        })}</div>
                      </div>
                    )}
                    {!!session.techniquesUsed?.length && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("session.techniquesLabel")}</div>
                        <div className="flex flex-wrap gap-1.5">{session.techniquesUsed.map((id) => {
                          const n = (allTechniques ?? []).find((tech) => tech.id === id)?.name;
                          if (!n) return null;
                          const score = session.techniqueScores?.[id];
                          return (
                            <span key={id} className="px-2 py-0.5 rounded-full bg-accent/60 inline-flex items-center gap-1">
                              <span>{n}</span>
                              {score != null && (
                                <span className="tabular-nums text-primary font-medium">{score}<span className="text-muted-foreground">/100</span></span>
                              )}
                            </span>
                          );
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
                  isTheory={isTheory}
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

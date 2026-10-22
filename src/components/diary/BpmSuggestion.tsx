import { useRef, useState } from "react";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Task } from "@/domain/entities/task";
import type { Session } from "@/domain/entities/session";
import type { Tempo } from "@/domain/entities/common";
import type { TempoContext, TempoOwner, TempoProgression, TempoProgressionRef } from "@/domain/entities/tempoProgression";
import type { TempoProgressionPreview, TempoProgressionView } from "@/application/useCases/tempoProgression";
import { resolveTempoContext, tempoContextKey, tempoOwner } from "@/domain/logic/tempoProgression";
import { applicationCommands } from "@/lib/applicationCommands";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { tempoLabel } from "@/lib/format";
import { bpmSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { BpmCoupler } from "@/components/library/BpmCoupler";

export function BpmSuggestion({ task, sourceSession, onInitialized }: { task: Task; sourceSession?: Session; onInitialized?: (state: TempoProgression, reference: TempoProgressionRef) => void }) {
  const { t } = useI18n();
  const entries = sourceSession?.marks ?? task.plan;
  const segments = usePresentationRead<Segment[]>("segments.ids", [entries.flatMap(e => e.segmentId === undefined ? [] : [e.segmentId])]);
  const [expanded,setExpanded] = useState<string>();
  const owner = tempoOwner(task);
  if (!owner) return null;
  const contexts = entries.map(entry => resolveTempoContext({ ...task,itemId: sourceSession?.itemId ?? task.itemId },entry,segments ?? []));
  return <details className="min-w-0 space-y-4 border-y border-border py-2">
    <summary className="min-h-11 cursor-pointer py-2 font-serif text-xl font-semibold">{t("tempo.title")}</summary>
    {contexts.some(c => !c) && <p className="text-sm text-muted-foreground">{t("tempo.unavailable")}</p>}
    {[...new Map(contexts.flatMap(c => c ? [[tempoContextKey(c),c] as const] : [])).values()].map(context => <ErrorBoundary key={tempoContextKey(context)} inline>
      <ContextSuggestion {...{ task,owner,context,onInitialized }} sourceTaskId={sourceSession?.taskId} expanded={expanded === tempoContextKey(context)} onExpand={() => setExpanded(tempoContextKey(context))} onClose={() => setExpanded(undefined)} />
    </ErrorBoundary>)}
  </details>;
}
function ContextSuggestion({ task,owner,context,sourceTaskId,onInitialized,expanded,onExpand,onClose }: { task: Task; owner: TempoOwner; context: TempoContext; sourceTaskId?: number; onInitialized?: (state: TempoProgression, reference: TempoProgressionRef) => void; expanded: boolean; onExpand: () => void; onClose: () => void }) {
  const { t,lang } = useI18n();
  const view = usePresentationRead<TempoProgressionView>("tempo.progression", [owner,context]);
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [context.itemId]);
  const sections = usePresentationRead<Segment[]>("segments.ids", [context.segmentId === undefined ? [] : [context.segmentId]]);
  const [initial,setInitial] = useState<Partial<Tempo>>();
  const [preview,setPreview] = useState<TempoProgressionPreview | null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const source = view?.initial;
  const initialTempo = initial ?? (source?.mark.bpm !== undefined && source.mark.noteVal ? { bpm: source.mark.bpm,noteVal: source.mark.noteVal } : { noteVal: "quarter" });
  const review = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const next = await applicationCommands.tempoProgression.preview({ owner,context,sourceTaskId,initialTempo: !view?.state && bpmSchema.safeParse(initialTempo.bpm).success && initialTempo.noteVal ? initialTempo as Tempo : undefined });
      setPreview(next); onExpand();
      if (!next) setMessage(t("tempo.insufficient"));
      requestAnimationFrame(() => previewRef.current?.focus());
    } catch { setError(t("tempo.error")); } finally { setBusy(false); }
  };
  const apply = async () => {
    if (busy || !preview) return;
    setBusy(true); setError("");
    try {
      const result = await applicationCommands.tempoProgression.accept(preview);
      if (result.status === "stale") { setPreview(result.preview); setMessage(t("tempo.stale")); }
      else { if (!preview.current) onInitialized?.(result.state,result.reference); setPreview(null); onClose(); setMessage(t("tempo.applied")); requestAnimationFrame(() => messageRef.current?.focus()); }
    } catch { setError(t("tempo.error")); } finally { setBusy(false); }
  };
  const label = (tempo: Tempo) => tempoLabel(tempo.noteVal,tempo.bpm);
  if (!view) return <p role="status" className="text-sm text-muted-foreground">{t("tempo.loading")}</p>;
  if (!view.rule?.enabled) return <p className="text-sm text-muted-foreground">{t("tempo.disabled")}</p>;
  const evaluation = view.evaluation, suggestion = evaluation?.suggestion;
  const counts = evaluation && t("tempo.counts", { successes: view.rule.window === undefined ? evaluation.trailingSuccesses : evaluation.successes,evaluated: view.rule.window === undefined ? evaluation.evaluated : Math.min(view.rule.window,evaluation.evaluated),required: view.rule.successes }) + (view.rule.window === undefined ? "" : ` · ${t("tempo.windowSize",{ count: view.rule.window })}`);
  return <div className="min-w-0 space-y-3 text-sm">
    <h3 className="break-words font-sans font-medium">{item?.title ?? task.title}{context.segmentId !== undefined && ` · ${sections?.[0]?.label ?? "—"}`}</h3>
    {!!context.layers.length && <p className="break-words text-muted-foreground">{context.layers.join(", ")}</p>}
    {view.state ? <>
      <p className="font-numeric tabular-nums">{t("tempo.working")}: {label(view.state.tempo)}</p>
      <p className="text-muted-foreground">{counts}</p>
      {suggestion && <p>{t(`tempo.${suggestion.direction === "decrease" ? "decrease" : "increase"}`)}: <span className="font-numeric tabular-nums">{label(suggestion.tempo)}</span>{suggestion.direction === "decrease" && ` · ${t("tempo.failureCount",{ count: evaluation!.trailingFailures })}`}</p>}
      {evaluation?.blocked && <p>{t("tempo.blocked")}</p>}
      {!evaluation?.evaluated && <p className="text-muted-foreground">{t("tempo.emptyCycle")}</p>}
    </> : <>
      {source && <p className="text-muted-foreground">{t("tempo.source", { tempo: tempoLabel(source.mark.noteVal,source.mark.bpm!),date: formatDate(source.date,lang,"medium"),confidence: source.mark.confidence! })}</p>}
      <BpmCoupler bpm={initialTempo.bpm} noteVal={initialTempo.noteVal} onChange={value => { setInitial(value); setPreview(null); }} label={t("tempo.initial")} />
    </>}
    {view.evidence && <p>{t("tempo.evidence",{ tempo: tempoLabel(view.evidence.mark.noteVal,view.evidence.mark.bpm!),date: formatDate(view.evidence.date,lang,"medium"),confidence: view.evidence.mark.progression!.minConfidence })}</p>}
    {(suggestion || (!view.state && bpmSchema.safeParse(initialTempo.bpm).success)) && <Button type="button" ref={reviewRef} variant="outline" disabled={busy} onClick={() => void review()}>{t("tempo.review")}</Button>}
    {expanded && preview && <div ref={previewRef} tabIndex={-1} className="space-y-3 border-t border-border pt-3 outline-none">
      <p className="font-numeric tabular-nums">{preview.current && `${label(preview.current)} → `}{label(preview.proposed)}</p>
      {counts && <p>{counts}</p>}
      <p>{t("tempo.updateCount",{ count: preview.updates.length })}</p>
      <ul className="space-y-1 font-numeric tabular-nums">{preview.updates.map(update => <li key={update.taskId}>{formatDate(update.date,lang,"long")}</li>)}</ul>
      <ul className="space-y-1 text-muted-foreground">{preview.excluded.map(exclusion => <li key={exclusion.taskId}>#{exclusion.taskId} · {t(`tempo.excluded${exclusion.reason[0].toUpperCase()}${exclusion.reason.slice(1)}`)}</li>)}</ul>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={() => void apply()} className="h-auto min-h-11 whitespace-normal">{t(preview.updates.length ? "tempo.apply" : "tempo.saveFuture",{ count: preview.updates.length })}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { onClose(); requestAnimationFrame(() => reviewRef.current?.focus()); }}>{t("common.cancel")}</Button></div>
    </div>}
    {message && <p ref={messageRef} tabIndex={-1} role="status">{message}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}

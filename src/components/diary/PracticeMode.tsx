import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useWakeLock } from "@/hooks/useWakeLock";
import { BPM_MIN, BPM_MAX, COMPOUND_NOTES, SIMPLE_NOTES } from "@/domain/constants/noteValues";
import type { SegmentMark } from "@/domain/entities/common";
import type { Collection } from "@/domain/entities/collection";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import type { AudioDraft } from "@/domain/ports/audio";
import { entryFor, marksFromPlan, planSegmentIds } from "@/domain/logic/plan";
import { useTechniques } from "@/presentation/hooks/useEntities";
import { useSessionDraft } from "@/presentation/hooks/useSessionDraft";
import { taskDraftScope } from "@/lib/sessionDrafts";
import { useI18n } from "@/lib/i18n";
import { today } from "@/lib/date";
import { NOTE_GLYPH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { RatingFields } from "@/components/shared/RatingFields";
import { ClipDraftList, Recorder } from "./Recorder";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { X, Volume2, VolumeX, MessageSquareQuote, ChevronLeft, ChevronRight, Check, Dot } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingActions } from "@/components/shared/FloatingActions";

interface Props {
  task: Task;
  onClose: () => void;
  onFinish: (payload: { marks: SegmentMark[]; clips: AudioDraft[] }) => void;
  onShowAnswers?: () => void;
}

const DEFAULT_BPM = 60;

const segmentTitle = ({ label, barStart, barEnd }: Segment) => (barStart === undefined || barEnd === undefined ? label : `${label} (${barStart}-${barEnd})`);

export function PracticeMode({ task, onClose: closeOverlay, onFinish, onShowAnswers }: Props) {
  const { t } = useI18n();
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [task.itemId]);
  const segments = usePresentationRead<Segment[]>("segments.ids", [planSegmentIds(task.plan)]);
  const collection = usePresentationRead<Collection | undefined>("collections.one", [task.collectionId]);
  const techniques = useTechniques();
  const lastSession = usePresentationRead<Session | null>("sessions.lastForTask", [task.id, task.itemId, today()]);

  // Screen wake lock so the device doesn't sleep mid-practice
  useWakeLock(true);


  // One mark per section: the metronome shows and edits the tempo of the current one.
  const { draft, update, storageFailed, restored } = useSessionDraft(taskDraftScope(task), { marks: marksFromPlan(task.plan), notes: "", clips: [], needHelp: false, helpText: "" });
  const marks = draft.marks.length ? draft.marks : marksFromPlan(task.plan);
  const { clips } = draft;
  const setMarks = (value: SegmentMark[]) => update({ marks: value });
  const setClips = (value: AudioDraft[] | ((all: AudioDraft[]) => AudioDraft[])) => update({ clips: typeof value === "function" ? value(clips) : value });
  const [current, setCurrent] = useState(0);
  const [recording, setRecording] = useState(false);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const onClose = () => { if (!storageFailed || window.confirm(t("draft.leaveWarning"))) closeOverlay(); };
  const mark = marks[current] ?? marks[0] ?? marksFromPlan(task.plan)[0];
  const bpm = mark.bpm ?? DEFAULT_BPM;
  const noteVal = mark.noteVal;
  const patchMark = (patch: Partial<SegmentMark>) => setMarks(marks.map((m, i) => (i === current ? { ...m, ...patch } : m)));
  const setBpm = (next: number | ((b: number) => number)) => patchMark({ bpm: typeof next === "function" ? next(bpm) : next });
  const setNoteVal = (nv: SegmentMark["noteVal"]) => patchMark({ noteVal: nv });
  const segmentOf = (id: number | undefined) => { const sg = segments?.find((x) => x.id === id); return sg && segmentTitle(sg); };
  const focusTechniques = mark.techniques.map((id) => techniques?.find((x) => x.id === id)?.name).filter(Boolean) as string[];

  // Seed the starting tempo once the last session loads: its reached tempo and note
  // value win; otherwise half the target in the target's note value; otherwise 60 ♩.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || lastSession === undefined) return;
    seededRef.current = true;
    update({ marks: marks.map((m) => {
      if (restored && m.bpm !== undefined) return m;
      const prev = lastSession ? entryFor(lastSession.marks, m.segmentId) : undefined;
      if (prev?.bpm !== undefined) return { ...m, bpm: prev.bpm, noteVal: prev.noteVal ?? m.noteVal };
      if (m.targetBpm) return { ...m, bpm: Math.max(30, Math.round(m.targetBpm / 2)), noteVal: m.noteVal ?? "quarter" };
      return { ...m, bpm: m.bpm ?? DEFAULT_BPM, noteVal: m.noteVal ?? "quarter" };
    }) });
  }, [lastSession, marks, restored, update]);

  // Metronome
  const [meterOn, setMeterOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [beatsPerBar, setBeatsPerBar] = useState(1);
  const [showDottedNotes, setShowDottedNotes] = useState(false);
  const [pulse, setPulse] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  // Read by the scheduler on every wake-up, so tempo, meter and mute changes apply without restarting the bar.
  const live = useRef({ bpm, beatsPerBar, muted });
  live.current = { bpm, beatsPerBar, muted };

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctor: typeof AudioContext =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? AudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => undefined);
    return ctxRef.current;
  };

  const click = (ctx: AudioContext, when: number, accent: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1100;
    osc.type = "square";
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.07);
  };

  // Metronome: beats are scheduled ahead on the audio clock; timers only wake the scheduler, so a busy main thread
  // cannot drift the beat. Hidden tabs wake about once a second, so the horizon grows there.
  useEffect(() => {
    if (!meterOn) return;
    const ctx = ensureCtx();
    let beat = 0;
    let next = ctx.currentTime + 0.05;
    let last = next - 60 / live.current.bpm;
    let scheduledBpm = live.current.bpm;
    const pulses: number[] = [];
    const schedule = () => {
      const { bpm, beatsPerBar, muted } = live.current;
      if (bpm !== scheduledBpm) {
        next = Math.max(last + 60 / bpm, ctx.currentTime);
        scheduledBpm = bpm;
      }
      // Skip missed beats in constant time after suspension.
      if (next < ctx.currentTime) {
        const missed = Math.ceil((ctx.currentTime - next) / (60 / bpm));
        next += missed * 60 / bpm; beat += missed;
      }
      const horizon = ctx.currentTime + (document.hidden ? 1.5 : 0.1);
      while (next < horizon) {
        if (!muted) click(ctx, next, beat % beatsPerBar === 0);
        const shown = beat + 1;
        pulses.push(window.setTimeout(() => setPulse(shown), Math.max(0, (next - ctx.currentTime) * 1000)));
        beat += 1;
        last = next;
        next += 60 / live.current.bpm;
      }
    };
    schedule();
    const id = window.setInterval(schedule, 25);
    return () => { clearInterval(id); pulses.forEach(clearTimeout); setPulse(0); };
  }, [meterOn]);

  useEffect(() => () => { ctxRef.current?.close().catch(() => undefined); }, []);

  // Read-through without the click: the ratings go on, the metronome tempo is left out of the log.
  const [skipTempo, setSkipTempo] = useState(false);
  const finish = () => {
    if (recording) return;
    update({ marks, clips });
    onFinish({ marks: skipTempo ? marks.map((m) => ({ ...m, bpm: undefined, noteVal: undefined })) : marks, clips });
  };


  const isAccent = pulse > 0 && (pulse - 1) % beatsPerBar === 0;
  const targetGlyph = NOTE_GLYPH[mark.targetNoteVal ?? "quarter"];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPortal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-background" />
    <DialogPrimitive.Content aria-describedby={undefined} onInteractOutside={(event) => event.preventDefault()} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }} className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-background animate-fade-in motion-reduce:animate-none pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-3 px-4 pb-28 pt-3 min-[700px]:px-9 min-[900px]:max-w-[1100px] short-landscape:max-w-none short-landscape:pb-4 short-landscape:pt-2">
        <DialogTitle className="sr-only">{t("practice.practiceMode")}</DialogTitle>
        {storageFailed && <p role="alert" className="text-xs text-destructive">{t("draft.storageFailed")}</p>}

        {/* Piece context folds behind the title; the target tempo stays in the metronome. */}
        <div className="flex items-start justify-between gap-3">
          <details className="group min-w-0 flex-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-start gap-1.5 pt-1.5 [&::-webkit-details-marker]:hidden">
              <h2 className="min-w-0 break-words font-serif text-lg font-semibold leading-tight">{task.title}</h2>
              <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            </summary>
            <div className="space-y-1 pb-1">
              {item && <p className="text-sm text-muted-foreground">{item.title}{item.composer ? ` · ${item.composer}` : ""}</p>}
              {collection && <p className="text-sm italic text-muted-foreground">{t("practice.collectionLabel")}: {collection.name}</p>}
              {marks.length === 1 && !!segments?.length && (
                <p className="text-xs text-muted-foreground" aria-label={t("practice.segmentLabel")}>{segments.map(segmentTitle).join(" · ")}</p>
              )}
              {(!!mark.layers.length || !!focusTechniques.length) && (
                <p className="text-xs text-muted-foreground">{[...mark.layers, ...focusTechniques].join(", ")}</p>
              )}
              {task.executionNotes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{task.executionNotes}</p>}
              {onShowAnswers && (
                <button onClick={onShowAnswers} className="inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
                  <MessageSquareQuote className="h-4 w-4" />
                  {t("teacherAnswers.openLabel")}
                </button>
              )}
            </div>
          </details>
          <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" onClick={onClose} aria-label={t("practice.close")}><X /></Button>
        </div>
        {marks.length > 1 && (
          <ol className="flex flex-wrap gap-x-3 text-xs text-muted-foreground" aria-label={t("practice.segmentsLabel")}>
            {marks.map((m, i) => (
              <li key={m.segmentId ?? i}>
                <button type="button" aria-current={i === current} onClick={() => setCurrent(i)} className={cn("inline-flex min-h-11 items-center gap-1", i === current ? "font-semibold text-primary" : "hover:text-foreground")}>
                  <span className="break-words">{segmentOf(m.segmentId)}</span>
                  {m.confidence !== undefined && <span className="inline-flex items-center gap-0.5 tabular-nums"><Check className="h-3 w-3" />{m.confidence}</span>}
                </button>
              </li>
            ))}
          </ol>
        )}

        <section className="grid min-w-0 gap-x-8 gap-y-2.5 rounded-lg bg-card p-3.5 shadow-soft min-[700px]:p-7 min-[900px]:grid-cols-2 short-landscape:grid-cols-2 short-landscape:p-4" aria-label={t("practice.metronome")}>
          <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
            <Recorder sections={[]} segmentId={mark.segmentId} compact onClip={(clip) => setClips((c) => [...c, clip])} onRecordingChange={setRecording} />
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="outline" className="h-11 w-11" onClick={() => setMuted((m) => !m)} aria-label={muted ? t("practice.unmute") : t("practice.mute")}>
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
              {/* The audio context is created and resumed inside the tap: mobile browsers only unlock audio there. */}
              <Button className="min-h-11" onClick={() => { if (!meterOn) { ensureCtx(); if (mark.bpm === undefined) patchMark({ bpm }); } setMeterOn((v) => !v); }} aria-pressed={meterOn}>
                {meterOn ? t("practice.stop") : t("practice.start")}
              </Button>
            </div>
          </div>

          {marks.length > 1 && (
            <div className="col-span-full flex items-center justify-between gap-2 border-t border-border pt-1">
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={current === 0} onClick={() => setCurrent(current - 1)} aria-label={t("practice.prevSection")}><ChevronLeft /></Button>
              <p className="min-w-0 flex-1 text-center leading-tight">
                <span className="block text-xs tabular-nums text-muted-foreground">{t("session.segmentIndicator", { current: String(current + 1), total: String(marks.length) })}</span>
                <span className="block break-words font-serif text-base font-semibold">{segmentOf(mark.segmentId)}</span>
              </p>
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={current === marks.length - 1} onClick={() => setCurrent(current + 1)} aria-label={t("practice.nextSection")}><ChevronRight /></Button>
            </div>
          )}

          <div className="grid min-w-0 gap-2">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex gap-1">
                {[-5, -1].map((d) => (
                  <Button key={d} type="button" variant="outline" className="h-10 min-w-10 px-1 text-xs tabular-nums" onClick={() => setBpm((b) => Math.min(BPM_MAX, Math.max(BPM_MIN, b + d)))} aria-label={t("practice.bpmDecrease", { step: Math.abs(d) })}>{d}</Button>
                ))}
              </div>
              <div className="min-w-0 text-center" aria-live="off">
                <p className="flex items-center justify-center gap-1.5 font-numeric text-[3.25rem] leading-none min-[700px]:text-[4.5rem] tabular-nums"><span aria-hidden="true">{NOTE_GLYPH[noteVal ?? "quarter"]}</span>{bpm}</p>
              </div>
              <div className="flex gap-1">
                {[1, 5].map((d) => (
                  <Button key={d} type="button" variant="outline" className="h-10 min-w-10 px-1 text-xs tabular-nums" onClick={() => setBpm((b) => Math.min(BPM_MAX, Math.max(BPM_MIN, b + d)))} aria-label={t("practice.bpmIncrease", { step: d })}>+{d}</Button>
                ))}
              </div>
            </div>
            <p className="text-center text-[0.6875rem] uppercase tracking-wider text-muted-foreground">{t("practice.bpmUnit")}</p>
            <Slider value={[bpm]} min={BPM_MIN} max={BPM_MAX} step={1} onValueChange={(v) => setBpm(v[0])} aria-label={t("practice.bpmUnit")} />
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)] items-end gap-2 border-b border-border">
              <div className="flex flex-wrap gap-1.5 self-center" aria-hidden="true">
                {Array.from({ length: beatsPerBar }).map((_, i) => {
                  const active = meterOn && pulse > 0 && (pulse - 1) % beatsPerBar === i;
                  const accent = i === 0;
                  return (
                    <span key={active ? `beat-${pulse}` : i} data-beat-mark={active ? pulse : undefined} className={cn("h-3.5 w-3.5 rounded-full border", accent ? "border-primary" : "border-muted-foreground/40", active ? cn("animate-beat-flash", accent ? "bg-primary" : "bg-foreground/70") : "bg-transparent")} />
                  );
                })}
              </div>
              {/* The pendulum swings to the other side on every scheduled beat, so it cannot drift from the click; reduced motion hides it and the beat marks carry the pulse. */}
              <div className="relative h-16 overflow-hidden motion-reduce:invisible" aria-hidden="true">
                <div data-pendulum className="metronome-pendulum absolute bottom-1 left-1/2 h-12 w-1 rounded-full bg-primary"
                  style={{ transform: `translateX(-50%) rotate(${meterOn && pulse ? (pulse % 2 ? 28 : -28) : 0}deg)`, transition: `transform ${60000 / bpm}ms ease-in-out` }}>
                  <span className={cn("absolute -left-2 -top-1 h-5 w-5 rounded-full border-2 border-primary", isAccent ? "bg-primary" : "bg-background")} />
                </div>
              </div>
              <p className="self-center text-right font-numeric text-xs tabular-nums text-muted-foreground">{!!mark.targetBpm && t("diary.targetBpm", { note: targetGlyph, bpm: mark.targetBpm })}</p>
            </div>
          </div>

          <details className="group min-w-0 self-start border-b border-border min-[900px]:border-b-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap gap-x-4">
                <span>{t("practice.beatsPerBar")} <span className="font-medium tabular-nums text-foreground">{beatsPerBar}</span></span>
                <span>{t("practice.noteLabel")} <span className="text-base leading-none text-foreground">{NOTE_GLYPH[noteVal ?? "quarter"]}</span></span>
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            </summary>
            <div className="grid gap-1 pb-2">
              <div role="group" aria-label={t("practice.beatsPerBar")} className="flex flex-wrap items-center justify-between gap-x-2">
                <span className="text-xs text-muted-foreground">{t("practice.beatsPerBar")}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 6].map((n) => (
                    <button key={n} type="button" aria-pressed={beatsPerBar === n} onClick={() => setBeatsPerBar(n)}
                      className={cn("h-11 w-11 rounded-lg text-sm tabular-nums", beatsPerBar === n ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div role="group" aria-label={t("practice.noteLabel")} className="flex flex-wrap items-center justify-between gap-x-2">
                <span className="text-xs text-muted-foreground">{t("practice.noteLabel")}</span>
                <div className="flex gap-0.5">
                  {(showDottedNotes ? COMPOUND_NOTES : SIMPLE_NOTES).map((nv) => (
                    <button key={nv} type="button" aria-pressed={noteVal === nv} onClick={() => setNoteVal(nv)} title={t(`note.${nv}`)} aria-label={t(`note.${nv}`)}
                      className={cn("h-11 min-w-11 rounded-lg px-1 text-base leading-none", noteVal === nv ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                      {NOTE_GLYPH[nv]}
                    </button>
                  ))}
                  <button type="button" aria-pressed={showDottedNotes} onClick={() => setShowDottedNotes((value) => !value)} title={t("note.dotted")} aria-label={t("note.dotted")}
                    className={cn("ml-1 inline-flex h-11 w-11 items-center justify-center rounded-lg", showDottedNotes ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                    <Dot aria-hidden="true" className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          </details>

          <label className="col-span-full flex min-h-11 items-center justify-between gap-3 text-sm">
            {t("practice.skipTempo")}
            <Switch checked={skipTempo} onCheckedChange={setSkipTempo} />
          </label>

          <div className="col-span-full pt-2.5">
            {marks.length > 1 && current < marks.length - 1 && <p className="mb-2 text-xs font-medium">{t("practice.rateNext")}</p>}
            <RatingFields mark={mark} onChange={patchMark} />
          </div>

          {clips.length > 0 && (
            <div className="col-span-full space-y-3 border-t border-border pt-3">
              <h3 className="font-sans text-sm font-medium">{t("audio.title")}</h3>
              <ClipDraftList clips={clips} onChange={setClips} sections={segments?.map((s) => ({ id: s.id, label: s.label })) ?? []} />
            </div>
          )}
        </section>

        {/* On a short landscape screen the bar would cover the metronome: it joins the page flow instead. */}
        <FloatingActions className="mx-auto max-w-[760px] bottom-[calc(12px+env(safe-area-inset-bottom))] min-[700px]:left-8 min-[1151px]:left-8 min-[1600px]:left-8 max-[699px]:[&>button]:h-auto max-[699px]:[&>button]:min-h-11 max-[699px]:[&>button]:flex-1 max-[699px]:[&>button]:whitespace-normal short-landscape:static short-landscape:mt-4">
          <Button variant="ghost" onClick={onClose}>{t("draft.leave")}</Button>
          <Button disabled={recording} onClick={finish}>{t("practice.finishLog")}</Button>
        </FloatingActions>
      </div>
    </DialogPrimitive.Content>
    </DialogPortal>
    </Dialog>
  );
}

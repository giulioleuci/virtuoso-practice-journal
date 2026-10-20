import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useWakeLock } from "@/hooks/useWakeLock";
import { COMPOUND_NOTES, SIMPLE_NOTES } from "@/domain/constants/noteValues";
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
// Same bounds as the stored tempo (bpmSchema), so a saved 300 can be nudged instead of snapping to a narrower range.
const BPM_MIN = 20;
const BPM_MAX = 400;

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
    const pulses: number[] = [];
    const schedule = () => {
      const { bpm, beatsPerBar, muted } = live.current;
      // After a stall, rejoin the grid silently instead of firing the missed beats at once.
      while (next < ctx.currentTime) { next += 60 / bpm; beat += 1; }
      const horizon = ctx.currentTime + (document.hidden ? 1.5 : 0.1);
      while (next < horizon) {
        if (!muted) click(ctx, next, beat % beatsPerBar === 0);
        const shown = beat + 1;
        pulses.push(window.setTimeout(() => setPulse(shown), Math.max(0, (next - ctx.currentTime) * 1000)));
        beat += 1;
        next += 60 / live.current.bpm;
      }
    };
    schedule();
    const id = window.setInterval(schedule, 25);
    return () => { clearInterval(id); pulses.forEach(clearTimeout); };
  }, [meterOn]);

  useEffect(() => () => { ctxRef.current?.close().catch(() => undefined); }, []);

  const finish = () => { if (!recording) { update({ marks, clips }); onFinish({ marks, clips }); } };


  const isAccent = pulse > 0 && (pulse - 1) % beatsPerBar === 0;
  const targetGlyph = NOTE_GLYPH[mark.targetNoteVal ?? "quarter"];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPortal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background" />
    <DialogPrimitive.Content aria-describedby={undefined} onInteractOutside={(event) => event.preventDefault()} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }} className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background animate-fade-in pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-5 pb-44 pt-6 min-[700px]:px-9 min-[700px]:pb-28 min-[900px]:max-w-[1100px] short-landscape:max-w-none short-landscape:pb-6 short-landscape:pt-3">
        <DialogTitle className="sr-only">{t("practice.practiceMode")}</DialogTitle>
        {storageFailed && <p role="alert" className="mb-4 text-xs text-destructive">{t("draft.storageFailed")}</p>}

        {/* Piece context: compact and secondary to the metronome. */}
        <div className="mb-6 space-y-1.5 short-landscape:mb-3 short-landscape:[&>*:not(:first-child)]:hidden">
          <div className="flex items-start justify-between gap-4">
            <h2 className="min-w-0 break-words font-serif text-xl font-semibold leading-tight">{task.title}</h2>
            <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" onClick={onClose} aria-label={t("practice.close")}><X /></Button>
          </div>
          {item && <p className="text-sm text-muted-foreground">{item.title}{item.composer ? ` · ${item.composer}` : ""}</p>}
          {collection && <p className="text-sm italic text-muted-foreground">{t("practice.collectionLabel")}: {collection.name}</p>}
          {mark.targetBpm && (
            <p className="font-numeric text-sm tabular-nums text-muted-foreground">{t("diary.targetBpm", { note: targetGlyph, bpm: mark.targetBpm })}</p>
          )}
          {marks.length > 1 && (
            <ol className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-label={t("practice.segmentsLabel")}>
              {marks.map((m, i) => (
                <li key={m.segmentId ?? i}>
                  <button type="button" aria-current={i === current} onClick={() => setCurrent(i)} className={cn("inline-flex min-h-11 items-center gap-1", i === current ? "font-semibold text-primary" : "hover:text-foreground")}>
                    <span className="break-words">{segments?.find((sg) => sg.id === m.segmentId)?.label}</span>
                    {m.confidence !== undefined && <span className="inline-flex items-center gap-0.5 tabular-nums"><Check className="h-3 w-3" />{m.confidence}</span>}
                  </button>
                </li>
              ))}
            </ol>
          )}
          {marks.length === 1 && !!segments?.length && (
            <p className="text-xs text-muted-foreground" aria-label={t("practice.segmentLabel")}>{segments.map((sg) => sg.label).join(" · ")}</p>
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

        {/* Metronome: the main element. */}
        <section className="grid min-w-0 gap-x-8 rounded-lg bg-card p-6 shadow-soft min-[700px]:p-9 min-[900px]:grid-cols-2 short-landscape:grid-cols-2 short-landscape:p-4" aria-label={t("practice.metronome")}>
          <div className="col-span-full flex flex-wrap items-center justify-between gap-3">
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
            <div className="col-span-full mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={current === 0} onClick={() => setCurrent(current - 1)} aria-label={t("practice.prevSection")}><ChevronLeft /></Button>
              <p className="min-w-0 flex-1 text-center">
                <span className="block text-xs tabular-nums text-muted-foreground">{t("session.segmentIndicator", { current: String(current + 1), total: String(marks.length) })}</span>
                <span className="block break-words font-serif text-lg font-semibold leading-tight">{segments?.find((sg) => sg.id === mark.segmentId)?.label}</span>
              </p>
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={current === marks.length - 1} onClick={() => setCurrent(current + 1)} aria-label={t("practice.nextSection")}><ChevronRight /></Button>
            </div>
          )}

          <div className="min-w-0">
          <div className="py-4 text-center short-landscape:py-1" aria-live="off">
            <p className="text-xl text-muted-foreground">{NOTE_GLYPH[noteVal ?? "quarter"]} =</p>
            <p className="font-numeric text-[5rem] leading-tight tabular-nums">{bpm}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("practice.bpmUnit")}</p>
          </div>

          {/* The pendulum swings to the other side on every scheduled beat, so it cannot drift from the click; reduced motion hides it and the beat marks below carry the pulse. */}
          <div className="relative h-20 overflow-hidden border-b border-border motion-reduce:hidden min-[700px]:h-32 short-landscape:h-20" aria-hidden="true">
            <div data-pendulum className="metronome-pendulum absolute bottom-2 left-1/2 h-16 w-1 rounded-full bg-primary min-[700px]:h-28 short-landscape:h-16"
              style={{ transform: `translateX(-50%) rotate(${meterOn && pulse ? (pulse % 2 ? 28 : -28) : 0}deg)`, transition: `transform ${60000 / bpm}ms ease-in-out` }}>
              <span className={cn("absolute -left-2.5 -top-1 h-6 w-6 rounded-full border-2 border-primary", isAccent ? "bg-primary" : "bg-background")} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 py-4" aria-hidden="true">
            {Array.from({ length: beatsPerBar }).map((_, i) => {
              const active = meterOn && pulse > 0 && (pulse - 1) % beatsPerBar === i;
              const accent = i === 0;
              // Re-mounted on every beat so the flash replays even with one beat per bar.
              return (
                <span key={active ? `beat-${pulse}` : i} data-beat-mark={active ? pulse : undefined} className={cn("h-4 w-4 rounded-full border", accent ? "border-primary" : "border-muted-foreground/40", active ? cn("animate-beat-flash", accent ? "bg-primary" : "bg-foreground/70") : "bg-transparent")} />
              );
            })}
          </div>

          </div>

          <div className="min-w-0 self-start pt-4">
          <div className="space-y-3">
            <Slider value={[bpm]} min={BPM_MIN} max={BPM_MAX} step={1} onValueChange={(v) => setBpm(v[0])} aria-label={t("practice.bpmUnit")} />
            <div className="flex items-center justify-center gap-2">
              {[-5, -1, +1, +5].map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  className="min-h-11 min-w-12 tabular-nums"
                  onClick={() => setBpm((b) => Math.min(BPM_MAX, Math.max(BPM_MIN, b + d)))}
                  aria-label={d > 0 ? t("practice.bpmIncrease", { step: d }) : t("practice.bpmDecrease", { step: Math.abs(d) })}
                >
                  {d > 0 ? `+${d}` : d}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            <div role="group" aria-label={t("practice.beatsPerBar")} className="flex max-w-full flex-wrap items-center justify-center gap-0.5">
              <span className="w-full text-center text-xs text-muted-foreground">{t("practice.beatsPerBar")}</span>
              {[1, 2, 3, 4, 6].map((n) => (
                <button key={n} type="button" aria-pressed={beatsPerBar === n} onClick={() => setBeatsPerBar(n)}
                  className={cn("h-11 w-11 rounded-lg text-sm tabular-nums", beatsPerBar === n ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                  {n}
                </button>
              ))}
            </div>
            <div role="group" aria-label={t("practice.noteLabel")} className="flex flex-wrap items-center justify-center gap-0.5">
              <span className="w-full text-center text-xs text-muted-foreground">{t("practice.noteLabel")}</span>
              {(showDottedNotes ? COMPOUND_NOTES : SIMPLE_NOTES).map((nv) => (
                <button key={nv} type="button" aria-pressed={noteVal === nv} onClick={() => setNoteVal(nv)} title={t(`note.${nv}`)} aria-label={t(`note.${nv}`)}
                  className={cn("h-11 min-w-11 rounded-lg px-1 text-base leading-none", noteVal === nv ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                  {NOTE_GLYPH[nv]}
                </button>
              ))}
              <button type="button" aria-pressed={showDottedNotes} onClick={() => setShowDottedNotes(value => !value)} title={t("note.dotted")} aria-label={t("note.dotted")}
                className={cn("ml-1 inline-flex h-11 w-11 items-center justify-center rounded-lg", showDottedNotes ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                <Dot aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>
          </div>

          </div>

          <div className="col-span-full mt-6 border-t border-border pt-5">
            {marks.length > 1 && current < marks.length - 1 && <p className="mb-2 text-xs font-medium">{t("practice.rateNext")}</p>}
            <RatingFields mark={mark} onChange={patchMark} />
          </div>

          {clips.length > 0 && (
            <div className="col-span-full mt-6 space-y-3 border-t border-border pt-5">
              <h3 className="font-sans text-sm font-medium">{t("audio.title")}</h3>
              <ClipDraftList clips={clips} onChange={setClips} sections={segments?.map((s) => ({ id: s.id, label: s.label })) ?? []} />
            </div>
          )}
        </section>

        {/* On a short landscape screen the bar would cover the metronome: it joins the page flow instead. */}
        <FloatingActions className="mx-auto max-w-[760px] flex-wrap bottom-[calc(12px+env(safe-area-inset-bottom))] max-[699px]:[&>button]:w-full min-[700px]:left-8 min-[1151px]:left-8 min-[1600px]:left-8 short-landscape:static short-landscape:mt-4 short-landscape:[&>button]:w-auto">
          <Button variant="ghost" onClick={onClose}>{t("draft.leave")}</Button>
          <Button disabled={recording} onClick={finish}>{t("practice.finishLog")}</Button>
        </FloatingActions>
      </div>
    </DialogPrimitive.Content>
    </DialogPortal>
    </Dialog>
  );
}

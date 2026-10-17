import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useWakeLock } from "@/hooks/useWakeLock";
import { NOTE_VALUES } from "@/domain/constants/noteValues";
import type { SegmentMark } from "@/domain/entities/common";
import type { Collection } from "@/domain/entities/collection";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import type { AudioDraft } from "@/domain/ports/audio";
import { entryFor, marksFromPlan, planSegmentIds } from "@/domain/logic/plan";
import { useTechniques } from "@/presentation/hooks/useEntities";
import { applicationCommands } from "@/lib/applicationCommands";
import { useI18n } from "@/lib/i18n";
import { today } from "@/lib/date";
import { NOTE_GLYPH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { RatingFields } from "@/components/shared/RatingFields";
import { ClipDraftList, Recorder } from "./Recorder";
import { Slider } from "@/components/ui/slider";
import { X, Volume2, VolumeX, MessageSquareQuote, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingActions } from "@/components/shared/FloatingActions";

interface Props {
  task: Task;
  onClose: () => void;
  onFinish: (payload: { marks: SegmentMark[]; clips: AudioDraft[] }) => void;
  onShowAnswers?: () => void;
}

const DEFAULT_BPM = 60;

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
  const [marks, setMarks] = useState<SegmentMark[]>(() => marksFromPlan(task.plan));
  const [current, setCurrent] = useState(0);
  const [clips, setClips] = useState<AudioDraft[]>([]);
  // Closing without finishing discards the drafts; finishing hands them to the log form.
  const onClose = () => { void applicationCommands.audio.discard(clips.map((c) => c.uid)); closeOverlay(); };
  const mark = marks[current];
  const bpm = mark.bpm ?? DEFAULT_BPM;
  const noteVal = mark.noteVal;
  const patchMark = (patch: Partial<SegmentMark>) => setMarks((all) => all.map((m, i) => (i === current ? { ...m, ...patch } : m)));
  const setBpm = (next: number | ((b: number) => number)) => patchMark({ bpm: typeof next === "function" ? next(bpm) : next });
  const setNoteVal = (nv: SegmentMark["noteVal"]) => patchMark({ noteVal: nv });
  // Confidence is the last scale: choosing it moves on to the next section; mood and focus are optional.
  const rate = (patch: Partial<SegmentMark>) => {
    patchMark(patch);
    if (patch.confidence !== undefined && current < marks.length - 1) setCurrent(current + 1);
  };
  const focusTechniques = mark.techniques.map((id) => techniques?.find((x) => x.id === id)?.name).filter(Boolean) as string[];

  // Seed the starting tempo once the last session loads: its reached tempo and note
  // value win; otherwise half the target in the target's note value; otherwise 60 ♩.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || lastSession === undefined) return;
    seededRef.current = true;
    setMarks((all) => all.map((m) => {
      const prev = lastSession ? entryFor(lastSession.marks, m.segmentId) : undefined;
      if (prev?.bpm !== undefined) return { ...m, bpm: prev.bpm, noteVal: prev.noteVal ?? m.noteVal };
      if (m.targetBpm) return { ...m, bpm: Math.max(30, Math.round(m.targetBpm / 2)), noteVal: m.noteVal ?? "quarter" };
      return { ...m, bpm: m.bpm ?? DEFAULT_BPM, noteVal: m.noteVal ?? "quarter" };
    }));
  }, [lastSession]);

  // Metronome
  const [meterOn, setMeterOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [beatsPerBar, setBeatsPerBar] = useState(1);
  const [pulse, setPulse] = useState(0);
  const beatRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctor: typeof AudioContext =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? AudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };

  const click = (accent: boolean) => {
    if (muted) return;
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1100;
    osc.type = "square";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  };

  useEffect(() => {
    if (!meterOn) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const periodMs = 60000 / bpm;
    beatRef.current = 0;
    // Trigger first beat immediately
    const tick = () => {
      const accent = beatRef.current % beatsPerBar === 0;
      click(accent);
      setPulse((p) => p + 1);
      beatRef.current += 1;
    };
    tick();
    intervalRef.current = window.setInterval(tick, periodMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meterOn, bpm, beatsPerBar, muted]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      ctxRef.current?.close().catch(() => undefined);
    };
  }, []);

  const finish = () => onFinish({ marks, clips });


  const isAccent = pulse > 0 && (pulse - 1) % beatsPerBar === 0;
  const targetGlyph = NOTE_GLYPH[mark.targetNoteVal ?? "quarter"];

  const overlay = (
    <div role="dialog" aria-modal="true" aria-label={t("practice.practiceMode")} className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-background animate-fade-in pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-5 pb-28 pt-6 min-[700px]:px-9">
        <header className="mb-4 flex items-start justify-between gap-4">
          <h1 className="font-serif text-[2.25rem] font-semibold leading-[1.15] tracking-tight">{t("practice.practiceMode")}</h1>
          <Button size="icon" variant="ghost" className="h-11 w-11" onClick={onClose} aria-label={t("practice.close")}><X /></Button>
        </header>

        {/* Piece context: compact and secondary to the metronome. */}
        <div className="mb-6 space-y-1.5">
          <h2 className="break-words font-serif text-xl font-semibold leading-tight">{task.title}</h2>
          {item && <p className="text-sm text-muted-foreground">{item.title}{item.composer ? ` · ${item.composer}` : ""}</p>}
          {collection && <p className="text-sm italic text-muted-foreground">{t("practice.collectionLabel")}: {collection.name}</p>}
          {mark.targetBpm && (
            <p className="font-numeric text-sm tabular-nums text-muted-foreground">{t("diary.targetBpm", { note: targetGlyph, bpm: mark.targetBpm })}</p>
          )}
          {marks.length > 1 && (
            <ol className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-label={t("practice.segmentsLabel")}>
              {marks.map((m, i) => (
                <li key={m.segmentId ?? i}>
                  <button type="button" aria-current={i === current} onClick={() => setCurrent(i)} className={cn("inline-flex min-h-6 items-center gap-1", i === current ? "font-semibold text-primary" : "hover:text-foreground")}>
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
        <section className="min-w-0 rounded-[16px] bg-card p-6 shadow-soft min-[700px]:p-9" aria-label={t("practice.metronome")}>
          <div className="flex items-center justify-between gap-3">
            <Recorder sections={[]} segmentId={mark.segmentId} compact onClip={(clip) => setClips((c) => [...c, clip])} />
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="outline" className="h-11 w-11" onClick={() => setMuted((m) => !m)} aria-label={muted ? t("practice.unmute") : t("practice.mute")}>
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button className="min-h-11" variant={meterOn ? "outline" : "default"} onClick={() => { if (!meterOn && mark.bpm === undefined) patchMark({ bpm }); setMeterOn((v) => !v); }} aria-pressed={meterOn}>
                {meterOn ? t("practice.stop") : t("practice.start")}
              </Button>
            </div>
          </div>

          {marks.length > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={current === 0} onClick={() => setCurrent(current - 1)} aria-label={t("practice.prevSection")}><ChevronLeft /></Button>
              <p className="min-w-0 flex-1 text-center">
                <span className="block text-xs tabular-nums text-muted-foreground">{t("session.segmentIndicator", { current: String(current + 1), total: String(marks.length) })}</span>
                <span className="block break-words font-serif text-lg font-semibold leading-tight">{segments?.find((sg) => sg.id === mark.segmentId)?.label}</span>
              </p>
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={current === marks.length - 1} onClick={() => setCurrent(current + 1)} aria-label={t("practice.nextSection")}><ChevronRight /></Button>
            </div>
          )}

          <div className="py-4 text-center" aria-live="off">
            <p className="text-xl text-muted-foreground">{targetGlyph} =</p>
            <p className="font-numeric text-[5rem] leading-tight tabular-nums">{bpm}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("practice.bpmUnit")}</p>
          </div>

          <div className="relative h-32 overflow-hidden border-b border-border" aria-hidden="true">
            <div className={cn("metronome-pendulum absolute bottom-2 left-1/2 h-28 w-1 rounded-full bg-primary", meterOn && "metronome-pendulum-running")}
              style={{ animationDuration: `${120000 / bpm}ms` }}>
              <span className={cn("absolute -left-2.5 -top-1 h-6 w-6 rounded-full border-2 border-primary", isAccent ? "bg-primary" : "bg-background")} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 py-4" aria-hidden="true">
            {Array.from({ length: beatsPerBar }).map((_, i) => {
              const active = meterOn && pulse > 0 && (pulse - 1) % beatsPerBar === i;
              const accent = i === 0;
              return (
                <span key={i} className={cn("h-4 w-4 rounded-full border transition-all duration-100", accent ? "border-primary" : "border-muted-foreground/40", active ? cn("scale-150", accent ? "bg-primary" : "bg-foreground/70") : "bg-transparent")} />
              );
            })}
          </div>

          <div className="space-y-3">
            <Slider value={[bpm]} min={30} max={240} step={1} onValueChange={(v) => setBpm(v[0])} aria-label={t("practice.metronome")} />
            <div className="flex items-center justify-center gap-2">
              {[-5, -1, +1, +5].map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  className="min-h-11 min-w-12 tabular-nums"
                  onClick={() => setBpm((b) => Math.min(240, Math.max(30, b + d)))}
                  aria-label={d > 0 ? t("practice.bpmIncrease", { step: d }) : t("practice.bpmDecrease", { step: Math.abs(d) })}
                >
                  {d > 0 ? `+${d}` : d}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            {marks.length > 1 && current < marks.length - 1 && <p className="mb-2 text-xs font-medium">{t("practice.rateNext")}</p>}
            <RatingFields mark={mark} onChange={rate} />
          </div>

          {clips.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-border pt-5">
              <h3 className="text-sm font-medium">{t("audio.title")}</h3>
              <ClipDraftList clips={clips} onChange={setClips} sections={segments?.map((s) => ({ id: s.id, label: s.label })) ?? []} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-5">
            <div role="group" aria-label={t("practice.beatsPerBar")} className="flex items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">{t("practice.beatsPerBar")}</span>
              {[1, 2, 3, 4, 6].map((n) => (
                <button key={n} type="button" aria-pressed={beatsPerBar === n} onClick={() => setBeatsPerBar(n)}
                  className={cn("h-10 w-10 rounded-lg text-sm tabular-nums", beatsPerBar === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                  {n}
                </button>
              ))}
            </div>
            <div role="group" aria-label={t("practice.noteLabel")} className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">{t("practice.noteLabel")}</span>
              {NOTE_VALUES.map((nv) => (
                <button key={nv} type="button" aria-pressed={noteVal === nv} onClick={() => setNoteVal(nv)} title={t(`note.${nv}`)} aria-label={t(`note.${nv}`)}
                  className={cn("h-10 min-w-10 rounded-lg px-1 text-lg leading-none", noteVal === nv ? "bg-primary text-primary-foreground" : "hover:bg-secondary/40")}>
                  {NOTE_GLYPH[nv]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Overlay has no nav or sidebar: sit on the system bar alone, above the overlay (z-100). */}
        <FloatingActions className="z-[110] bottom-[calc(12px+env(safe-area-inset-bottom))] min-[700px]:left-8 min-[1151px]:left-8 min-[1600px]:left-8">
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={finish}>{t("practice.finishLog")}</Button>
        </FloatingActions>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useWakeLock } from "@/hooks/useWakeLock";
import type { NoteVal } from "@/domain/entities/common";
import type { Collection } from "@/domain/entities/collection";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Task } from "@/domain/entities/task";
import { useI18n } from "@/lib/i18n";
import { NOTE_GLYPH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Volume2, VolumeX, MessageSquareQuote } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  onClose: () => void;
  onFinish: (payload: { bpm: number; noteVal?: NoteVal }) => void;
  onShowAnswers?: () => void;
}

export function PracticeMode({ task, onClose, onFinish, onShowAnswers }: Props) {
  const { t } = useI18n();
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [task.itemId]);
  const segments = usePresentationRead<Segment[]>("segments.ids", [task.segmentIds ?? []]);
  const collection = usePresentationRead<Collection | undefined>("collections.one", [task.collectionId]);

  // Screen wake lock so the device doesn't sleep mid-practice
  useWakeLock(true);


  // Metronome
  const [bpm, setBpm] = useState<number>(task.targetBpm ?? 80);
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>(task.noteVal);
  const [meterOn, setMeterOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [beatsPerBar, setBeatsPerBar] = useState(1);
  const [pulse, setPulse] = useState(0);
  const beatRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Tap-tempo removed

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

  const finish = () => {
    onFinish({ bpm, noteVal });
  };


  const isAccent = pulse > 0 && (pulse - 1) % beatsPerBar === 0;
  const targetGlyph = noteVal ? NOTE_GLYPH[noteVal] : "♩";

  const overlay = (
    <div className="fixed inset-0 z-[100] bg-background animate-fade-in flex flex-col">
      {/* Grain stays visible underneath via parent body overlay */}
      <div className="px-6 pt-6 pb-2 flex items-start justify-between max-w-3xl w-full mx-auto">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("practice.practiceMode")}</p>
          <h2 className="font-serif text-2xl truncate">{task.title}</h2>
          {item && (
            <p className="text-xs text-muted-foreground truncate">
              {item.title}{item.composer ? ` · ${item.composer}` : ""}
            </p>
          )}
          {!!segments?.length && (
            <p className="text-xs text-muted-foreground italic truncate">
              {segments.length > 1 ? t("practice.segmentsLabel") : t("practice.segmentLabel")}: {segments.map((s) => s.label).join(", ")}
            </p>
          )}
          {collection && (
            <p className="text-xs text-muted-foreground italic truncate">
              {t("practice.collectionLabel")}: {collection.name}
            </p>
          )}
          {task.targetBpm && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("diary.targetBpm", { note: targetGlyph, bpm: task.targetBpm })}
            </p>
          )}
          {onShowAnswers && (
            <button
              onClick={onShowAnswers}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20"
            >
              <MessageSquareQuote className="h-3.5 w-3.5" />
              {t("teacherAnswers.openLabel")}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label={t("practice.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8 max-w-3xl w-full mx-auto space-y-6">



        {/* Metronome */}
        <section className="space-y-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("practice.metronome")}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMuted((m) => !m)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent"
                aria-label={muted ? t("practice.unmute") : t("practice.mute")}
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <Button
                variant={meterOn ? "default" : "outline"}
                onClick={() => setMeterOn((v) => !v)}
              >
                {meterOn ? t("practice.stop") : t("practice.start")}
              </Button>
            </div>
          </div>

          <div className="text-center py-4" aria-live="off">
            <p className="text-xl text-muted-foreground">{targetGlyph} =</p>
            <p className="font-numeric text-7xl font-semibold leading-none py-3">{bpm}</p>
            <p className="text-xs text-muted-foreground">{t("practice.bpmUnit")}</p>
          </div>

          {/* Pulse indicator */}
          <div className="flex items-center justify-center gap-2 py-2">
            {Array.from({ length: beatsPerBar }).map((_, i) => {
              const active = meterOn && pulse > 0 && (pulse - 1) % beatsPerBar === i;
              const accent = i === 0;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-4 w-4 rounded-full border transition-all duration-100",
                    accent ? "border-primary" : "border-muted-foreground/40",
                    active
                      ? cn("scale-150", accent ? "bg-primary" : "bg-foreground/70")
                      : "bg-transparent"
                  )}
                />
              );
            })}
          </div>

          {/* Continuous beat motion, using the existing theme contrast. */}
          <div className="relative h-32 overflow-hidden border-b border-border" aria-hidden="true">
            <div className={cn("metronome-pendulum absolute bottom-2 left-1/2 h-28 w-1 rounded-full bg-primary", meterOn && "metronome-pendulum-running")}
              style={{ animationDuration: `${120000 / bpm}ms` }}>
              <span className={cn("absolute -top-1 -left-2.5 h-6 w-6 rounded-full border-2 border-primary", isAccent ? "bg-primary" : "bg-background")} />
            </div>
          </div>

          {/* BPM controls */}
          <div className="space-y-2">
            <Slider
              value={[bpm]}
              min={30}
              max={240}
              step={1}
              onValueChange={(v) => setBpm(v[0])}
            />
            <div className="flex items-center justify-center gap-2">
              {[-5, -1, +1, +5].map((d) => (
                <button
                  key={d}
                  onClick={() => setBpm((b) => Math.min(240, Math.max(30, b + d)))}
                  className="paper-card px-3 py-1.5 text-sm tabular-nums hover:-translate-y-0.5 transition-transform"
                  aria-label={d > 0 ? t("practice.bpmIncrease", { step: d }) : t("practice.bpmDecrease", { step: Math.abs(d) })}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">{t("practice.beatsPerBar")}</span>
              {[1, 2, 3, 4, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setBeatsPerBar(n)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-sm tabular-nums",
                    beatsPerBar === n
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">{t("practice.noteLabel")}</span>
              {(["half","quarter","eighth","sixteenth"] as NoteVal[]).map((nv) => (
                <button
                  key={nv}
                  onClick={() => setNoteVal(nv)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-lg leading-none",
                    noteVal === nv
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  )}
                  title={nv}
                >
                  {NOTE_GLYPH[nv]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Finish */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={finish}>
            {t("practice.finishLog")}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

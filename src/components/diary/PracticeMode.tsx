import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NoteVal, Task } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Play, Pause, RotateCcw, Volume2, VolumeX, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BpmCoupler } from "@/components/library/BpmCoupler";

interface Props {
  task: Task;
  onClose: () => void;
  onFinish: (payload: { elapsedMs: number; bpm: number; noteVal?: NoteVal }) => void;
}

const NOTE_GLYPH: Record<string, string> = {
  half: "𝅗𝅥", quarter: "♩", eighth: "♪", sixteenth: "𝅘𝅥𝅯",
};

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PracticeMode({ task, onClose, onFinish }: Props) {
  // Timer — auto-starts and uses wall-clock so backgrounding doesn't lose time
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(Date.now());
  const baseRef = useRef<number>(0);

  useEffect(() => {
    if (!running) {
      if (startRef.current != null) {
        baseRef.current += Date.now() - startRef.current;
        startRef.current = null;
        setElapsed(baseRef.current);
      }
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      if (startRef.current != null) setElapsed(baseRef.current + (Date.now() - startRef.current));
    };
    tick();
    const id = setInterval(tick, 250);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [running]);

  // Screen wake lock so the device doesn't sleep mid-practice
  useEffect(() => {
    let wl: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    const acquire = async () => {
      try { if (nav.wakeLock) wl = await nav.wakeLock.request("screen"); } catch { /* ignore */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible" && !wl) acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wl?.release().catch(() => undefined);
    };
  }, []);

  // Metronome
  const [bpm, setBpm] = useState<number>(task.targetBpm ?? 80);
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>(task.noteVal);
  const [meterOn, setMeterOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
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
    onFinish({ elapsedMs: elapsed, bpm, noteVal });
  };

  const toggleRun = () => setRunning((r) => !r);
  const reset = () => {
    baseRef.current = 0;
    startRef.current = running ? Date.now() : null;
    setElapsed(0);
  };

  const isAccent = pulse > 0 && (pulse - 1) % beatsPerBar === 0;
  const targetGlyph = noteVal ? NOTE_GLYPH[noteVal] : "♩";

  const overlay = (
    <div className="fixed inset-0 z-[100] bg-background animate-fade-in flex flex-col">
      {/* Grain stays visible underneath via parent body overlay */}
      <div className="px-6 pt-6 pb-2 flex items-start justify-between max-w-3xl w-full mx-auto">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Practice mode</p>
          <h2 className="font-serif text-2xl truncate">{task.title}</h2>
          {task.targetBpm && (
            <p className="text-sm text-muted-foreground tabular-nums">
              Target {targetGlyph} = {task.targetBpm}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Close practice mode"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8 max-w-3xl w-full mx-auto space-y-6">
        {/* Timer */}
        <section className="flex items-center justify-center gap-3 text-muted-foreground/70">
          <div className="font-numeric text-2xl font-light tabular-nums select-none">
            {formatTime(elapsed)}
          </div>
          <button
            onClick={toggleRun}
            className="p-1.5 rounded-md hover:text-foreground hover:bg-accent"
            aria-label={running ? "Pause timer" : "Start timer"}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={reset}
            className="p-1.5 rounded-md hover:text-foreground hover:bg-accent"
            aria-label="Reset timer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </section>

        {/* Metronome */}
        <section className="paper-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Metronome</p>
              <p className="font-serif text-xl">
                {targetGlyph} = <span className="tabular-nums">{bpm}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMuted((m) => !m)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <Button
                variant={meterOn ? "default" : "outline"}
                onClick={() => setMeterOn((v) => !v)}
              >
                {meterOn ? "Stop" : "Start"}
              </Button>
            </div>
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

          {/* Pulse ring (large) */}
          <div className="flex items-center justify-center">
            <div
              key={pulse}
              className={cn(
                "h-24 w-24 rounded-full border-2 transition-transform",
                meterOn ? "animate-[scale-in_0.12s_ease-out]" : "",
                isAccent ? "border-primary bg-primary/15" : "border-foreground/30 bg-foreground/5"
              )}
            />
          </div>

          {/* BPM controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setBpm((b) => Math.max(30, b - 1))}
              className="paper-card p-2 hover:-translate-y-0.5 transition-transform"
              aria-label="Decrease BPM"
            >
              <Minus className="h-4 w-4" />
            </button>
            <Slider
              value={[bpm]}
              min={30}
              max={240}
              step={1}
              onValueChange={(v) => setBpm(v[0])}
              className="flex-1"
            />
            <button
              onClick={() => setBpm((b) => Math.min(240, b + 1))}
              className="paper-card p-2 hover:-translate-y-0.5 transition-transform"
              aria-label="Increase BPM"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Beats/bar</span>
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
              <span className="text-xs text-muted-foreground mr-1">Note</span>
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
            Cancel
          </Button>
          <Button className="flex-1" onClick={finish}>
            Finish & log session
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

// Helper to expose elapsed for prefill in parent if needed.
export function usePracticeOutcome() {
  const [outcome, setOutcome] = useState<{ elapsedMs: number; bpm: number; noteVal?: NoteVal } | null>(null);
  return { outcome, setOutcome };
}

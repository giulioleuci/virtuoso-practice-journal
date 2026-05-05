import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NoteVal, Task } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Play, Pause, RotateCcw, Volume2, VolumeX, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // Timer
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed;
    const id = setInterval(() => {
      if (startRef.current != null) setElapsed(Date.now() - startRef.current);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

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

  // Tap-tempo
  const tapsRef = useRef<number[]>([]);
  const tap = () => {
    const now = performance.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 2500), now];
    if (tapsRef.current.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < tapsRef.current.length; i++) {
        diffs.push(tapsRef.current[i] - tapsRef.current[i - 1]);
      }
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const next = Math.round(60000 / avg);
      if (next >= 30 && next <= 280) setBpm(next);
    }
  };

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
    setRunning(false);
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
        <section className="paper-raised p-8 text-center">
          <div className="font-numeric text-7xl font-light tabular-nums text-foreground select-none">
            {formatTime(elapsed)}
          </div>
          <div className="flex items-center justify-center gap-2 mt-5">
            <Button onClick={toggleRun} size="lg" className="px-8">
              {running ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
              {running ? "Pause" : elapsed === 0 ? "Start" : "Resume"}
            </Button>
            <Button onClick={reset} variant="outline" size="lg" aria-label="Reset">
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
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

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Beats/bar</span>
              {[2, 3, 4, 6].map((n) => (
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
            <Button variant="outline" size="sm" onClick={tap}>
              Tap tempo
            </Button>
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

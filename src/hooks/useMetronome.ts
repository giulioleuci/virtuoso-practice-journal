import { useEffect, useRef, useState } from "react";

interface Settings { bpm: number; beatsPerBar: number; muted: boolean }

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

/** Click engine: beats are scheduled ahead on the audio clock; timers only wake the scheduler, so a busy main thread
 *  cannot drift the beat. Hidden tabs wake about once a second, so the horizon grows there. */
export function useMetronome(settings: Settings) {
  const [on, setOn] = useState(false);
  const [pulse, setPulse] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  // Read by the scheduler on every wake-up, so tempo, meter and mute changes apply without restarting the bar.
  const live = useRef(settings);
  live.current = settings;

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctor: typeof AudioContext =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? AudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => undefined);
    return ctxRef.current;
  };

  useEffect(() => {
    if (!on) return;
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
  }, [on]);

  useEffect(() => () => { ctxRef.current?.close().catch(() => undefined); }, []);

  /** The audio context is created and resumed inside the tap: mobile browsers only unlock audio there. */
  const toggle = () => { if (!on) ensureCtx(); setOn((v) => !v); };
  return { on, pulse, toggle };
}

import { useCallback, useEffect, useRef, useState } from "react";

/** Concert A; independent of metronome tempo and beat accent. */
export function useReferenceTone() {
  const [playing, setPlaying] = useState(false);
  const resource = useRef<{ context: AudioContext; oscillator: OscillatorNode; gain: GainNode } | null>(null);
  const stop = useCallback(() => {
    const current = resource.current;
    resource.current = null;
    if (current) {
      const time = current.context.currentTime;
      current.gain.gain.cancelScheduledValues(time);
      current.gain.gain.setValueAtTime(current.gain.gain.value, time);
      current.gain.gain.linearRampToValueAtTime(0, time + 0.04);
      current.oscillator.onended = () => { void current.context.close().catch(() => {}); };
      current.oscillator.stop(time + 0.05);
    }
    setPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    if (resource.current) { stop(); return; }
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const current = { context, oscillator, gain };
    resource.current = current;
    oscillator.type = "sine";
    oscillator.frequency.value = 440;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, context.currentTime + 0.04);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    setPlaying(true);
    try { await context.resume(); }
    catch (error) { if (resource.current === current) stop(); throw error; }
  }, [stop]);

  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); stop(); };
  }, [stop]);
  return { playing, toggle, stop };
}
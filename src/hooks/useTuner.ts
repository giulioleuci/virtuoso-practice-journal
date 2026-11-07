import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { nearestNote, type TunerReading } from "@/domain/logic/tuner";

type TunerStatus = "idle" | "starting" | "listening" | "denied" | "unavailable" | "failed";

export function useTuner() {
  const [status, setStatus] = useState<TunerStatus>("idle");
  const [reading, setReading] = useState<TunerReading | null>(null);
  const resource = useRef<{ stream?: MediaStream; context?: AudioContext; frame?: number }>({});
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current += 1;
    if (resource.current.frame !== undefined) cancelAnimationFrame(resource.current.frame);
    resource.current.stream?.getTracks().forEach((track) => track.stop());
    void resource.current.context?.close().catch(() => {});
    resource.current = {};
    setReading(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setStatus("unavailable");
      return;
    }
    const token = generation.current;
    setStatus("starting");
    try {
      // Create/resume inside the user gesture (required by mobile browsers).
      const context = new AudioContext();
      resource.current.context = context;
      const resumed = context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (token !== generation.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      resource.current.stream = stream;
      await resumed;
      if (token !== generation.current) return;
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      const detector = PitchDetector.forFloat32Array(buffer.length);
      let lastUpdate = 0;
      let lastPitch = 0;
      setStatus("listening");
      const sample = (time: number) => {
        if (token !== generation.current) return;
        if (time - lastUpdate > 65) {
          lastUpdate = time;
          analyser.getFloatTimeDomainData(buffer);
          const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length);
          const [frequency, clarity] = detector.findPitch(buffer, context.sampleRate);
          if (rms > 0.008 && clarity > 0.92 && frequency >= 20 && frequency <= 5000) {
            lastPitch = time;
            setReading(nearestNote(frequency));
          } else if (time - lastPitch > 450) setReading(null);
        }
        resource.current.frame = requestAnimationFrame(sample);
      };
      resource.current.frame = requestAnimationFrame(sample);
      stream.getAudioTracks().forEach((track) => { track.onended = () => { if (token === generation.current) { stop(); setStatus("failed"); } }; });
    } catch (error) {
      if (token !== generation.current) return;
      stop();
      setStatus(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "denied" : "failed");
    }
  }, [stop]);

  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); stop(); };
  }, [stop]);
  return { status, reading, start, stop };
}
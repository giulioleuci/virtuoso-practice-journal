import { BPM_MAX, BPM_MIN, NOTE_VALUES, type NoteVal } from "../constants/noteValues";
import type { Tempo, TempoStep } from "../entities/common";

const weights: Record<NoteVal, number> = { whole: 16, half: 8, quarter: 4, eighth: 2, sixteenth: 1, "dotted-half": 12, "dotted-quarter": 6, "dotted-eighth": 3 };
export const normalizedTempo = (tempo: Tempo): number => tempo.bpm * weights[tempo.noteVal];
export const convertTempo = (tempo: Tempo, noteVal: NoteVal): number => normalizedTempo(tempo) / weights[noteVal];
export const compareTempos = (a: Tempo, b: Tempo): number => Math.sign(normalizedTempo(a) - normalizedTempo(b));

export function stepTempo(current: Tempo, step: TempoStep, direction: "increase" | "decrease"): Tempo | undefined {
  const sign = direction === "increase" ? 1 : -1;
  let speed: number;
  if (step.kind === "percent") {
    let bpm = Math.round(current.bpm * (1 + sign * step.value / 100));
    if (bpm === current.bpm) bpm += sign;
    if (bpm <= 0) return undefined;
    speed = normalizedTempo({ bpm, noteVal: current.noteVal });
  } else speed = normalizedTempo(current) + sign * normalizedTempo({ bpm: step.value, noteVal: step.noteVal });
  if (!Number.isFinite(speed) || speed <= 0) return undefined;
  const candidates = [current.noteVal, ...(step.kind === "fixed" ? [step.noteVal] : []), ...NOTE_VALUES];
  for (const noteVal of candidates) {
    const bpm = speed / weights[noteVal];
    if (Number.isInteger(bpm) && bpm >= BPM_MIN && bpm <= BPM_MAX) return { bpm, noteVal };
  }
}

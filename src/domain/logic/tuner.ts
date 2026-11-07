export interface TunerReading {
  noteIndex: number;
  octave: number;
  cents: number;
  frequency: number;
}

/** Equal temperament, concert A4 = 440 Hz; no instrument-specific tuning. */
export function nearestNote(frequency: number): TunerReading | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const position = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(position);
  return { noteIndex: ((midi % 12) + 12) % 12, octave: Math.floor(midi / 12) - 1, cents: (position - midi) * 100, frequency };
}
/** Note values a tempo can be counted in; dotted ones serve compound meters. */
export const NOTE_VALUES = ["whole", "half", "quarter", "eighth", "sixteenth", "dotted-half", "dotted-quarter", "dotted-eighth"] as const;

export type NoteVal = typeof NOTE_VALUES[number];

export const SIMPLE_NOTES: NoteVal[] = ["whole", "half", "quarter", "eighth", "sixteenth"];
export const COMPOUND_NOTES: NoteVal[] = ["dotted-half", "dotted-quarter", "dotted-eighth"];

export const NOTE_GLYPH: Record<NoteVal, string> = {
  whole: "𝅝",
  half: "𝅗𝅥",
  quarter: "♩",
  eighth: "♪",
  sixteenth: "𝅘𝅥𝅯",
  "dotted-half": "𝅗𝅥.",
  "dotted-quarter": "♩.",
  "dotted-eighth": "♪.",
};

export const BPM_MIN = 1;
export const BPM_MAX = 400;

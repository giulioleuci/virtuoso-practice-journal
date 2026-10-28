/** Note values a tempo can be counted in; dotted ones serve compound meters. */
export const NOTE_VALUES = ["whole", "half", "quarter", "eighth", "sixteenth", "dotted-half", "dotted-quarter", "dotted-eighth"] as const;

export type NoteVal = typeof NOTE_VALUES[number];

export const SIMPLE_NOTES: NoteVal[] = ["whole", "half", "quarter", "eighth", "sixteenth"];
export const COMPOUND_NOTES: NoteVal[] = ["dotted-half", "dotted-quarter", "dotted-eighth"];

export const NOTE_GLYPH: Record<NoteVal, string> = {
  whole: "\u{1D15D}",
  half: "\u{1D15E}",
  quarter: "\u{1D15F}",
  eighth: "\u{1D160}",
  sixteenth: "\u{1D161}",
  "dotted-half": "\u{1D15E}.",
  "dotted-quarter": "\u{1D15F}.",
  "dotted-eighth": "\u{1D160}.",
};

export const BPM_MIN = 1;
export const BPM_MAX = 400;

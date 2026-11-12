import { CLICK_LEVELS, type ClickLevel } from "../constants/clickLevels";

export const clickRank = (level: ClickLevel | undefined): number => level ? CLICK_LEVELS.indexOf(level) : 0;

/** Does the metronome sound on this beat? `beat` is 0-based from start. */
export function audible(beat: number, beatsPerBar: number, level: ClickLevel | undefined): boolean {
  const pos = beat % beatsPerBar;
  switch (level) {
    case "1-3": return pos === 0 || (beatsPerBar === 4 && pos === 2);
    case "first": return pos === 0;
    case "bar2": return beat % (beatsPerBar * 2) === 0;
    case "bar4": return beat % (beatsPerBar * 4) === 0;
    case "none": return false;
    default: return true;
  }
}

const UP: Partial<Record<ClickLevel, ClickLevel>> = { all: "first", "1-3": "first", first: "bar2", bar2: "bar4", bar4: "none" };
const DOWN: Partial<Record<ClickLevel, ClickLevel>> = { none: "bar4", bar4: "bar2", bar2: "first", "1-3": "all" };

/** One step along the ladder; undefined = no step. */
export function stepClick(level: ClickLevel | undefined, direction: "up" | "down", beatsPerBar?: number): ClickLevel | undefined {
  const l = level ?? "all";
  if (direction === "up") return UP[l];
  return l === "first" ? (beatsPerBar === 4 ? "1-3" : "all") : DOWN[l];
}

import { BookOpen, Music2, Activity, Brain } from "lucide-react";
import type { LibraryKind, SessionQuality } from "@/lib/db";

export const QUALITY_SYMBOL: Record<SessionQuality, string> = {
  hard: "♭",
  improve: "♮",
  well: "♯",
  great: "𝄪",
};

export const QUALITY_VALS: { val: SessionQuality; symbol: string; labelKey: string }[] = [
  { val: "hard",    symbol: "♭", labelKey: "session.qualityHard" },
  { val: "improve", symbol: "♮", labelKey: "session.qualityImprove" },
  { val: "well",    symbol: "♯", labelKey: "session.qualityWell" },
  { val: "great",   symbol: "𝄪", labelKey: "session.qualityGreat" },
];

export const NOTE_GLYPH: Record<string, string> = {
  half: "𝅗𝅥",
  quarter: "♩",
  eighth: "♪",
  sixteenth: "𝅘𝅥𝅯",
};

export const LIBRARY_KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string; tint: string }[] = [
  { key: "repertoire", icon: Music2, tKey: "library.kind.repertoire", tint: "hsl(var(--key-terracotta))" },
  { key: "manual",     icon: BookOpen, tKey: "library.kind.manual",   tint: "hsl(var(--key-gold))" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique", tint: "hsl(var(--key-sage))" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory",      tint: "hsl(var(--key-blue))" },
];

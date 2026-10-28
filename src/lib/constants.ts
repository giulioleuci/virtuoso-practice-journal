import { BookOpen, Music2, Activity, Brain } from "lucide-react";
import type { LibraryKind } from "@/domain/entities/common";

export { NOTE_GLYPH } from "@/domain/constants/noteValues";

export const LIBRARY_KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string; tint: string }[] = [
  { key: "piece", icon: Music2, tKey: "library.kind.piece", tint: "hsl(var(--key-terracotta))" },
  { key: "study",     icon: BookOpen, tKey: "library.kind.study",   tint: "hsl(var(--key-gold))" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique", tint: "hsl(var(--key-sage))" },
  { key: "exercise", icon: BookOpen, tKey: "library.kind.exercise", tint: "hsl(var(--key-gold))" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory",      tint: "hsl(var(--key-blue))" },
];

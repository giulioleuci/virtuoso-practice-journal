import { BookOpen, Music2, Activity, Brain } from "lucide-react";
import type { LibraryKind } from "@/lib/db";

export { NOTE_GLYPH } from "@/domain/constants/noteValues";

export const LIBRARY_KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string; tint: string }[] = [
  { key: "repertoire", icon: Music2, tKey: "library.kind.repertoire", tint: "hsl(var(--key-terracotta))" },
  { key: "manual",     icon: BookOpen, tKey: "library.kind.manual",   tint: "hsl(var(--key-gold))" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique", tint: "hsl(var(--key-sage))" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory",      tint: "hsl(var(--key-blue))" },
];

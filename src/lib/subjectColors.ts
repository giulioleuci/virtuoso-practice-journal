import type { ColorKey, SubjectType } from "@/lib/db";

/** Ordered palette for assigning default colors to subjects. */
export const COLOR_KEYS: ColorKey[] = ["terracotta", "sage", "gold", "blue", "plum"];

/** Map a ColorKey to its CSS variable-based hex/hsl. */
export const COLOR_CLASSES: Record<ColorKey, { bg: string; border: string; text: string; chip: string }> = {
  terracotta: {
    bg: "bg-[hsl(var(--key-terracotta)/0.12)]",
    border: "border-l-[hsl(var(--key-terracotta))]",
    text: "text-[hsl(var(--key-terracotta))]",
    chip: "bg-[hsl(var(--key-terracotta)/0.15)] text-[hsl(var(--key-terracotta))]",
  },
  sage: {
    bg: "bg-[hsl(var(--key-sage)/0.12)]",
    border: "border-l-[hsl(var(--key-sage))]",
    text: "text-[hsl(var(--key-sage))]",
    chip: "bg-[hsl(var(--key-sage)/0.15)] text-[hsl(var(--key-sage))]",
  },
  gold: {
    bg: "bg-[hsl(var(--key-gold)/0.12)]",
    border: "border-l-[hsl(var(--key-gold))]",
    text: "text-[hsl(var(--key-gold))]",
    chip: "bg-[hsl(var(--key-gold)/0.15)] text-[hsl(var(--key-gold))]",
  },
  blue: {
    bg: "bg-[hsl(var(--key-blue)/0.12)]",
    border: "border-l-[hsl(var(--key-blue))]",
    text: "text-[hsl(var(--key-blue))]",
    chip: "bg-[hsl(var(--key-blue)/0.15)] text-[hsl(var(--key-blue))]",
  },
  plum: {
    bg: "bg-[hsl(var(--key-plum)/0.12)]",
    border: "border-l-[hsl(var(--key-plum))]",
    text: "text-[hsl(var(--key-plum))]",
    chip: "bg-[hsl(var(--key-plum)/0.15)] text-[hsl(var(--key-plum))]",
  },
};

/** Default color by subject type for new subjects without an assigned color. */
export const DEFAULT_COLOR_BY_TYPE: Record<SubjectType, ColorKey> = {
  instrument: "terracotta",
  theory: "blue",
  composition: "gold",
  other: "sage",
};

export function getSubjectColor(color?: ColorKey, type?: SubjectType): ColorKey {
  if (color) return color;
  if (type) return DEFAULT_COLOR_BY_TYPE[type];
  return "terracotta";
}

/** Inline style for a colored left border accent on cards. */
export function subjectBorderStyle(color?: ColorKey, type?: SubjectType): React.CSSProperties {
  const key = getSubjectColor(color, type);
  return { borderLeftColor: `hsl(var(--key-${key}))` };
}

/** Inline style for a lighter colored left border accent (secondary/historical cards). */
export function subjectBorderStyleLight(color?: ColorKey, type?: SubjectType): React.CSSProperties {
  const key = getSubjectColor(color, type);
  return { borderLeftColor: `hsl(var(--key-${key}) / 0.4)` };
}

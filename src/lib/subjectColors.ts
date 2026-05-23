import type { ColorKey, SubjectType } from "@/lib/db";

/** Ordered palette for assigning default colors to subjects. */
export const COLOR_KEYS: ColorKey[] = [
  "terracotta", "gold", "coral", "amber",
  "sage", "blue", "plum", "teal", "indigo", "slate",
];

const makeClasses = (key: ColorKey) => ({
  bg: `bg-[hsl(var(--key-${key})/0.12)]`,
  border: `border-l-[hsl(var(--key-${key}))]`,
  text: `text-[hsl(var(--key-${key}))]`,
  chip: `bg-[hsl(var(--key-${key})/0.15)] text-[hsl(var(--key-${key}))]`,
});

/** Map a ColorKey to its CSS variable-based hex/hsl. */
export const COLOR_CLASSES: Record<ColorKey, { bg: string; border: string; text: string; chip: string }> = {
  terracotta: makeClasses("terracotta"),
  sage: makeClasses("sage"),
  gold: makeClasses("gold"),
  blue: makeClasses("blue"),
  plum: makeClasses("plum"),
  coral: makeClasses("coral"),
  amber: makeClasses("amber"),
  teal: makeClasses("teal"),
  indigo: makeClasses("indigo"),
  slate: makeClasses("slate"),
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

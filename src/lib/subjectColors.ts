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

/** Resolve a CSS color string for a subject, preferring a custom color when set. */
export function subjectColorCss(color?: ColorKey, type?: SubjectType, customColor?: string): string {
  if (customColor) return customColor;
  return `hsl(var(--key-${getSubjectColor(color, type)}))`;
}

/** Resolve a CSS color string with a given alpha (0-1). */
export function subjectColorCssAlpha(color?: ColorKey, type?: SubjectType, customColor?: string, alpha = 1): string {
  if (customColor) {
    // hex like #rrggbb → rgba
    const hex = customColor.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return customColor;
  }
  return `hsl(var(--key-${getSubjectColor(color, type)}) / ${alpha})`;
}

/** Inline style for a colored left border accent on cards. */
export function subjectBorderStyle(color?: ColorKey, type?: SubjectType, customColor?: string): React.CSSProperties {
  return { borderLeftColor: subjectColorCss(color, type, customColor) };
}

/** Inline style for a lighter colored left border accent (secondary/historical cards). */
export function subjectBorderStyleLight(color?: ColorKey, type?: SubjectType, customColor?: string): React.CSSProperties {
  return { borderLeftColor: subjectColorCssAlpha(color, type, customColor, 0.4) };
}

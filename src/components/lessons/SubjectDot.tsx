import type { Subject } from "@/domain/entities/common";
import { subjectColorCss } from "@/lib/subjectColors";

/** Color tab of a subject: a dot, never a fill. */
export function SubjectDot({ subject }: { subject?: Subject }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(subject?.color, subject?.type, subject?.customColor) }} title={subject?.name} role="img" aria-label={subject?.name} />;
}

export const iconBtn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40";

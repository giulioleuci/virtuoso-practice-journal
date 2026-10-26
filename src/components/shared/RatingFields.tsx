import type { SegmentMark } from "@/domain/entities/common";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { RatingScale } from "./RatingScale";

/** Mood, focus and confidence of one section as stars. Confidence is required for a new session, mood and focus never are. */
export function RatingFields({ mark, onChange, requireRatings = true, showErrors = false, compact = false, children }: { mark: SegmentMark; onChange: (patch: Partial<SegmentMark>) => void; requireRatings?: boolean; showErrors?: boolean; compact?: boolean; children?: ReactNode }) {
  const { t } = useI18n();
  const scale = (key: "confidence" | "mood" | "focus") => {
    const labels = [1, 2, 3, 4, 5].map((n) => t(`rating.${key}.${n}`));
    return <RatingScale key={key} label={key === "confidence" ? t("session.confidenceLabel") : t(`rating.${key}`)} question={t(`rating.${key}Question`)} labels={labels} value={mark[key]}
      onChange={(value) => onChange({ [key]: value })} unanswered={t("rating.unanswered")}
      scaleHint={t("rating.scaleHint", { low: labels[0], high: labels[4] })} clearLabel={t("rating.clear")} required={requireRatings && key === "confidence"} showError={showErrors} compact={compact} />;
  };
  return (
    <div className="space-y-4">
      {scale("confidence")}
      {children}
      <details className="border-t border-border pt-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-muted-foreground hover:text-foreground">{t("rating.optionalContext")}</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">{scale("mood")}{scale("focus")}</div>
      </details>
      <details open={!!mark.notes} className="border-t border-border pt-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-muted-foreground hover:text-foreground">{t("rating.sectionNote")}</summary>
        <Textarea rows={2} maxLength={2000} aria-label={t("rating.sectionNote")} value={mark.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value || undefined })} placeholder={t("session.notesPlaceholder")} />
      </details>
    </div>
  );
}

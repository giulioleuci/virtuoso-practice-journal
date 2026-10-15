import { RATING_KEYS, type SegmentMark } from "@/domain/entities/common";
import { useI18n } from "@/lib/i18n";
import { RatingScale } from "./RatingScale";

/** Mood, focus and confidence of one section as stars. Confidence is required for a new session, mood and focus never are. */
export function RatingFields({ mark, onChange, requireRatings = true }: { mark: SegmentMark; onChange: (patch: Partial<SegmentMark>) => void; requireRatings?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {RATING_KEYS.map((key) => {
        const labels = [1, 2, 3, 4, 5].map((n) => t(`rating.${key}.${n}`));
        return (
          <RatingScale key={key} label={key === "confidence" ? t("session.confidenceLabel") : t(`rating.${key}`)} question={t(`rating.${key}Question`)} labels={labels} value={mark[key]}
            onChange={(value) => onChange({ [key]: value } as Partial<SegmentMark>)} unanswered={t("rating.unanswered")}
            scaleHint={t("rating.scaleHint", { low: labels[0], high: labels[4] })} required={requireRatings && key === "confidence"} />
        );
      })}
    </div>
  );
}

/** Spaced-review scheduling for pieces kept in the performing repertoire. */
import type { LibraryItem } from "../entities/library";
import { addDays, dayKey, parseDayKey } from "@/lib/date";

/** Growing interval ladder, in days. */
export const REVIEW_INTERVALS = [7, 14, 30, 60, 90] as const;

export type ReviewOutcome = "good" | "ok" | "poor";

/** Next interval after a review, based on how the review went. */
export function nextIntervalDays(current: number | undefined, outcome: ReviewOutcome = "good"): number {
  const base = current && current > 0 ? current : REVIEW_INTERVALS[0];
  if (outcome === "poor") return REVIEW_INTERVALS[0];
  if (outcome === "ok") return base;
  const next = REVIEW_INTERVALS.find((value) => value > base);
  return next ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

/** Patch to persist after reviewing a repertoire item on `todayKey`. */
export function scheduleNextReview(
  item: Pick<LibraryItem, "reviewIntervalDays">,
  todayKey: string,
  outcome: ReviewOutcome = "good",
): Pick<LibraryItem, "reviewIntervalDays" | "lastReviewedAt" | "nextReviewAt"> {
  const reviewIntervalDays = nextIntervalDays(item.reviewIntervalDays, outcome);
  return {
    reviewIntervalDays,
    lastReviewedAt: todayKey,
    nextReviewAt: dayKey(addDays(parseDayKey(todayKey), reviewIntervalDays)),
  };
}

/** Patch to persist when an item first enters the repertoire. */
export function enterRepertoire(todayKey: string, at: number): Pick<LibraryItem, "inRepertoire" | "repertoireAddedAt" | "reviewIntervalDays" | "nextReviewAt"> {
  return {
    inRepertoire: true,
    repertoireAddedAt: at,
    reviewIntervalDays: REVIEW_INTERVALS[0],
    nextReviewAt: dayKey(addDays(parseDayKey(todayKey), REVIEW_INTERVALS[0])),
  };
}

/** True when the item has no review date yet, or the date has arrived. */
export function isReviewDue(item: Pick<LibraryItem, "inRepertoire" | "nextReviewAt">, todayKey: string): boolean {
  if (!item.inRepertoire) return false;
  return !item.nextReviewAt || item.nextReviewAt <= todayKey;
}

/** Whole days until the next review (negative when overdue). */
export function daysUntilReview(item: Pick<LibraryItem, "nextReviewAt">, todayKey: string): number | undefined {
  if (!item.nextReviewAt) return undefined;
  const ms = parseDayKey(item.nextReviewAt).getTime() - parseDayKey(todayKey).getTime();
  return Math.round(ms / 86_400_000);
}

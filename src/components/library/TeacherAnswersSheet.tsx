import { useLiveQuery } from "@/lib/subscriptions";
import { db } from "@/lib/presentationQueries";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { MessageSquareQuote, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemId: number;
  itemTitle?: string;
}

/**
 * Read-only quick reference of the teacher's recorded answers
 * for a library item. Designed for one-handed mobile use during practice.
 */
export function TeacherAnswersSheet({ open, onOpenChange, itemId, itemTitle }: Props) {
  const { t, lang } = useI18n();
  const item = useLiveQuery(() => db.library.get(itemId), [itemId]);
  const label = itemTitle ?? item?.title ?? "";
  const answered = useLiveQuery(
    () =>
      db.helpRequests
        .where("itemId")
        .equals(itemId)
        .filter((r) => !!r.answer)
        .toArray()
        .then((rs) => rs.sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0))),
    [itemId]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] max-h-[85dvh] rounded-t-3xl bg-background p-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-6 text-left">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            {label}
          </div>
          <SheetTitle className="font-serif text-2xl">{t("teacherAnswers.title")}</SheetTitle>
          <SheetDescription className="text-[13px]">
            {t("teacherAnswers.subtitle")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-2.5">
          {answered === undefined ? (
            <>
              <div className="paper-skeleton h-24" />
              <div className="paper-skeleton h-24" />
            </>
          ) : answered.length === 0 ? (
            <EmptyState title={t("teacherAnswers.empty")} />
          ) : (
            answered.map((r) => (
              <article
                key={r.id}
                className="paper-card border-none overflow-hidden border-l-4 border-l-primary"
              >
                <div className="px-4 py-3 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t("teacherAnswers.question")}
                  </div>
                  <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
                    {r.question}
                  </p>
                </div>
                <div className="px-4 py-3 bg-accent/30 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    {t("teacherAnswers.answer")}
                  </div>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                    {r.answer}
                  </p>
                  {r.answeredAt && (
                    <div className="text-[11px] text-muted-foreground tabular-nums pt-0.5">
                      {formatDate(new Date(r.answeredAt), lang, "medium")}
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

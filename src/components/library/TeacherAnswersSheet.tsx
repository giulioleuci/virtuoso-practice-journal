import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { LibraryItem } from "@/domain/entities/library";
import type { HelpRequest } from "@/domain/ports/helpRequest";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { MessageSquareQuote, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { helpRequestsService } from "@/lib/services";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemId: number;
  itemTitle?: string;
}

/**
 * Quick reference and editing of the teacher's recorded answers
 * for a library item. Designed for one-handed mobile use during practice.
 */
export function TeacherAnswersSheet({ open, onOpenChange, itemId, itemTitle }: Props) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState<{ id: number; answer: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!editing?.answer.trim() || saving) return;
    setSaving(true);
    try {
      await helpRequestsService.answer(editing.id, editing.answer.trim());
      setEditing(null);
      toast.success(t("toast.answerSaved"));
    } catch {
      toast.error(t("rate.failed"));
    } finally {
      setSaving(false);
    }
  };
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [itemId]);
  const label = itemTitle ?? item?.title ?? "";
  const answered = usePresentationRead<HelpRequest[]>("helpRequests.answeredItem", [itemId])
    ?.slice()
    .sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0));

  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) setEditing(null); onOpenChange(value); }}>
      <SheetContent
        side="bottom"
        className="h-[85vh] max-h-[85dvh] rounded-t-3xl bg-background p-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-6 text-left">
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 [overflow-wrap:anywhere]">
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
                className="paper-card border-none overflow-hidden"
              >
                <div className="px-4 py-3 space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("teacherAnswers.question")}
                  </div>
                  <p className="text-sm leading-snug whitespace-pre-wrap break-words">
                    {r.question}
                  </p>
                </div>
                <div className="px-4 py-3 bg-accent/30 space-y-1.5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    {t("teacherAnswers.answer")}
                  </div>
                  {editing?.id === r.id ? (
                    <div className="space-y-2">
                      <Textarea autoFocus aria-label={t("recap.editAnswer")} rows={4} value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
                      <div className="flex gap-2">
                        <Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
                        <Button disabled={saving || !editing.answer.trim()} onClick={save}>{t("recap.saveAnswer")}</Button>
                      </div>
                    </div>
                  ) : <>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {r.answer}
                  </p>
                  <Button variant="outline" size="sm" className="min-h-11" onClick={() => r.id !== undefined && setEditing({ id: r.id, answer: r.answer ?? "" })}>{t("recap.editAnswer")}</Button>
                  </>}
                  {r.answeredAt && (
                    <div className="text-xs text-muted-foreground tabular-nums pt-0.5">
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

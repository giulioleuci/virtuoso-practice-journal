import { useState } from "react";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { HelpRequest } from "@/domain/ports/helpRequest";
import { helpRequestsService } from "@/lib/services";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { HelpCircle, MessageSquareQuote, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemId: number;
  itemTitle: string;
}

/** Question list and composer for one library item (used in the item page and in the sheet). */
export function ItemQuestions({ itemId }: { itemId: number }) {
  const { t, lang } = useI18n();
  const reqs = usePresentationRead<HelpRequest[]>("helpRequests.item", [itemId]);

  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const addQuestion = async () => {
    if (!draft.trim()) return;
    await helpRequestsService.add(itemId, draft.trim());
    setDraft("");
    toast.success(t("help.questionSaved"));
  };

  const saveAnswer = async (id: number) => {
    const text = (answers[id] ?? "").trim();
    if (!text) return;
    await helpRequestsService.answer(id, text);
    setAnswers((a) => { const c = { ...a }; delete c[id]; return c; });
    toast.success(t("toast.answerSaved"));
  };

  const remove = async (id: number) => {
    await helpRequestsService.remove(id);
    setDeleteId(null);
  };

  const sorted = (reqs ?? []).sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
          {/* New question composer */}
          <div className="paper-card border-none p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("help.newQuestion")}
            </div>
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("help.questionPlaceholder")}
              className="resize-none text-[15px]"
            />
            <Button
              onClick={addQuestion}
              disabled={!draft.trim()}
              className="w-full h-11 gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("help.newQuestion")}
            </Button>
          </div>

          {sorted.length === 0 ? (
            <EmptyState title={t("help.noQuestions")} />
          ) : (
            <Accordion type="single" collapsible className="border-t border-border">
              {sorted.map((r) => {
                const isAnswering = answers[r.id!] !== undefined;
                return (
                  <AccordionItem
                    key={r.id}
                    value={String(r.id)}
                    className="overflow-hidden border-b border-border"
                  >
                    <AccordionTrigger className="group px-3 py-3 hover:no-underline gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0 text-left">
                        {r.resolved ? (
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <HelpCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        )}
                        <span className="flex-1 text-[15px] leading-snug group-data-[state=closed]:line-clamp-2 group-data-[state=open]:whitespace-pre-wrap group-data-[state=open]:break-words">
                          {r.question}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      {r.answer && !isAnswering ? (
                        <div className="px-4 py-3 bg-accent/30 space-y-1.5">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                            <MessageSquareQuote className="h-3.5 w-3.5" />
                            {t("recap.saveAnswer")}
                          </div>
                          <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                            {r.answer}
                          </div>
                          {r.answeredAt && (
                            <div className="text-xs text-muted-foreground tabular-nums pt-0.5">
                              {formatDate(new Date(r.answeredAt), lang, "medium")}
                            </div>
                          )}
                        </div>
                      ) : isAnswering ? (
                        <div className="px-4 py-3 bg-accent/30 space-y-2">
                          <Textarea
                            rows={4}
                            value={answers[r.id!] ?? ""}
                            onChange={(e) => setAnswers((a) => ({ ...a, [r.id!]: e.target.value }))}
                            placeholder={t("help.answerPlaceholder")}
                            className="resize-none text-[15px] bg-background"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setAnswers((a) => { const c = { ...a }; delete c[r.id!]; return c; })}
                              className="flex-1 h-10"
                            >
                              {t("common.cancel")}
                            </Button>
                            <Button
                              onClick={() => r.id && saveAnswer(r.id)}
                              disabled={!(answers[r.id!] ?? "").trim()}
                              className="flex-[2] h-10"
                            >
                              {t("recap.saveAnswer")}
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {/* Action bar */}
                      <div className="flex items-stretch border-t border-border/50 divide-x divide-border/50">
                        {!isAnswering && (
                          <button
                            onClick={() => setAnswers((a) => ({ ...a, [r.id!]: r.answer ?? "" }))}
                            className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-primary hover:bg-primary/10 active:bg-primary/15"
                          >
                            <MessageSquareQuote className="h-3.5 w-3.5" />
                            {r.answer ? t("recap.editAnswer") : t("recap.recordAnswer")}
                          </button>
                        )}
                        <button
                          onClick={() => r.id !== undefined && setDeleteId(r.id)}
                          className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("common.delete")}
                        </button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("help.deleteQuestion")}</AlertDialogTitle>
            <AlertDialogDescription>{t("help.deleteQuestionDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId !== null && remove(deleteId)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ItemHelpSheet({ open, onOpenChange, itemId, itemTitle }: Props) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] max-h-[85dvh] rounded-t-3xl bg-background p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="font-serif text-2xl">{t("recap.title")}</SheetTitle>
          <SheetDescription>{itemTitle}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] mt-4">
          {open && <ItemQuestions itemId={itemId} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

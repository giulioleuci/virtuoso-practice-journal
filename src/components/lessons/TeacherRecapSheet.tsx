import { useEffect, useMemo, useState } from "react";
import { useAllLibrary, useAllTasks, useHelpRequests, useSubjects } from "@/presentation/hooks/useEntities";
import type { ColorKey, SubjectType } from "@/domain/entities/common";
import type { HelpRequest } from "@/domain/ports/helpRequest";
import { helpRequestsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, HelpCircle, MessageSquareQuote, ChevronRight, History as HistoryIcon } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { subjectBorderStyle, subjectColorCss } from "@/lib/subjectColors";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Optional filter: only show requests for library items of this subject. */
  subjectId?: number;
}

type Tab = "open" | "answered";

export function TeacherRecapSheet({ open, onOpenChange, subjectId }: Props) {
  const { t, lang } = useI18n();
  const helpRequests = useHelpRequests();
  const items = useAllLibrary();
  const subjects = useSubjects();
  const tasks = useAllTasks();
  const taskById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks]);

  const [tab, setTab] = useState<Tab>("open");
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");

  useEffect(() => { if (!open) { setAnsweringId(null); setAnswerDraft(""); } }, [open]);

  const list = useMemo(() => {
    const all = helpRequests ?? [];
    const subjectOf = new Map((items ?? []).map((i) => [i.id, i.subjectId]));
    const scoped =
      subjectId === undefined
        ? all
        : all.filter((h) => h.itemId !== undefined && subjectOf.get(h.itemId) === subjectId);
    const filtered = tab === "open" ? scoped.filter((h) => !h.resolved) : scoped.filter((h) => h.resolved);
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [helpRequests, tab, items, subjectId]);

  const grouped = useMemo(() => {
    const itemsMap = new Map((items ?? []).map((i) => [i.id, i]));
    const subjectsMap = new Map((subjects ?? []).map((s) => [s.id, s]));

    const map = new Map<string, { subjectName: string; subjectColor?: ColorKey; subjectType?: SubjectType; subjectCustomColor?: string; items: Map<number | "none", { itemId?: number; itemTitle: string; reqs: HelpRequest[] }> }>();
    for (const h of list) {
      const item = h.itemId !== undefined ? itemsMap.get(h.itemId) : undefined;
      const subject = item?.subjectId !== undefined ? subjectsMap.get(item.subjectId) : undefined;
      const subjectKey = subject?.name ?? "Other";
      let bucket = map.get(subjectKey);
      if (!bucket) {
        bucket = { subjectName: subjectKey, subjectColor: subject?.color, subjectType: subject?.type, subjectCustomColor: subject?.customColor, items: new Map() };
        map.set(subjectKey, bucket);
      }
      const itemKey = h.itemId ?? "none";
      let entry = bucket.items.get(itemKey);
      if (!entry) {
        entry = { itemId: h.itemId, itemTitle: item?.title ?? "General", reqs: [] };
        bucket.items.set(itemKey, entry);
      }
      entry.reqs.push(h);
    }
    return Array.from(map.values());
  }, [list, items, subjects]);

  const startAnswer = (h: HelpRequest) => {
    setAnsweringId(h.id ?? null);
    setAnswerDraft(h.answer ?? "");
  };

  const saveAnswer = async (id: number) => {
    await helpRequestsService.saveAnswer(id, answerDraft);
    setAnsweringId(null);
    setAnswerDraft("");
    toast.success(t("toast.answerSaved"));
  };

  const resolve = async (id: number) => {
    await helpRequestsService.resolve(id);
    toast.success(t("toast.markedResolved"));
  };

  const resolveAll = async () => {
    const ids = list.map((h) => h.id).filter((id): id is number => id !== undefined);
    await helpRequestsService.resolveAll(ids);
    toast.success(t("toast.allMarkedResolved"));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="px-0">
          <SheetTitle className="font-serif text-2xl">{t("recap.title")}</SheetTitle>
          <SheetDescription className="text-xs">{t("recap.subtitle")}</SheetDescription>
        </SheetHeader>

        {/* Full-width segmented tabs */}
        <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60">
          {(["open", "answered"] as Tab[]).map((tk) => (
            <button
              key={tk}
              role="tab"
              aria-selected={tab === tk}
              onClick={() => setTab(tk)}
              className={cn(
                "h-10 text-xs font-medium rounded-lg transition-colors",
                tab === tk
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tk === "open" ? t("recap.openTab") : t("recap.answeredTab")}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {list.length === 0 ? (
            <EmptyState title={tab === "open" ? t("recap.noOpenQuestions") : t("recap.noAnswers")} />
          ) : (
            <>
              {tab === "open" && (
                <Button variant="outline" size="sm" onClick={resolveAll} className="w-full h-10">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> {t("recap.resolveAll")}
                </Button>
              )}
              {grouped.map((g) => (
                <section key={g.subjectName} className="space-y-2">
                  <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground px-1">{g.subjectName}</h3>
                  <Accordion type="multiple" className="space-y-2">
                    {Array.from(g.items.values()).map((b) => (
                      <AccordionItem
                        key={b.itemTitle}
                        value={b.itemTitle}
                        className="paper-card border-none border-l-4 overflow-hidden"
                        style={subjectBorderStyle(g.subjectColor, g.subjectType, g.subjectCustomColor)}
                      >
                        <AccordionTrigger className="group px-3.5 py-3 hover:no-underline gap-2 w-full min-w-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                            <span
                              aria-hidden
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: subjectColorCss(g.subjectColor, g.subjectType, g.subjectCustomColor) }}
                            />
                            <span className="font-serif text-base flex-1 min-w-0 block group-data-[state=closed]:truncate group-data-[state=open]:whitespace-normal group-data-[state=open]:break-words leading-snug">
                              {b.itemTitle}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0 rounded-full bg-accent/60 px-2 py-0.5">
                              {b.reqs.length}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3.5 pb-3.5">
                          {b.itemId && (
                            <Link
                              to={`/library`}
                              onClick={() => onOpenChange(false)}
                              className="text-[11px] uppercase tracking-wider text-primary hover:underline inline-flex items-center gap-0.5 mb-3"
                            >
                              {t("recap.openInLibrary")} <ChevronRight className="h-3 w-3" />
                            </Link>
                          )}
                          <ul className="space-y-3">
                            {b.reqs.map((r) => {
                              const task = r.taskId ? taskById.get(r.taskId) : undefined;
                              const isAnswering = answeringId === r.id;
                              return (
                                <li key={r.id} className="rounded-lg border border-border/50 bg-background/40 overflow-hidden">
                                  {/* Question */}
                                  <div className="flex items-start gap-2 p-3 pb-2">
                                    {r.resolved ? (
                                      <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    ) : (
                                      <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    )}
                                    <p className="flex-1 text-[15px] leading-snug whitespace-pre-wrap break-words">
                                      {r.question}
                                    </p>
                                  </div>

                                  {/* Answer */}
                                  {r.answer && !isAnswering && (
                                    <div className="px-3 pb-2 flex items-start gap-2 bg-accent/30">
                                      <MessageSquareQuote className="h-4 w-4 mt-3 shrink-0 text-muted-foreground" />
                                      <div className="flex-1 py-2">
                                        <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">
                                          {r.answer}
                                        </p>
                                        {r.answeredAt && (
                                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums mt-1">
                                            {formatDate(new Date(r.answeredAt), lang, "medium")}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Inline answer editor */}
                                  {isAnswering && (
                                    <div className="px-3 pb-3 space-y-2">
                                      <Textarea
                                        rows={4}
                                        autoFocus
                                        value={answerDraft}
                                        onChange={(e) => setAnswerDraft(e.target.value)}
                                        placeholder={t("recap.answerPlaceholder")}
                                      />
                                      <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 h-10" onClick={() => setAnsweringId(null)}>
                                          {t("common.cancel")}
                                        </Button>
                                        <Button className="flex-[2] h-10" onClick={() => r.id && saveAnswer(r.id)}>
                                          {t("recap.saveAnswer")}
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Action row */}
                                  {!isAnswering && (
                                    <div className="flex items-stretch border-t border-border/50 divide-x divide-border/50">
                                      <button
                                        onClick={() => startAnswer(r)}
                                        className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10 active:bg-primary/15"
                                      >
                                        <MessageSquareQuote className="h-3.5 w-3.5" />
                                        {r.answer ? t("recap.editAnswer") : t("recap.recordAnswer")}
                                      </button>
                                      {!r.resolved && (
                                        <button
                                          onClick={() => r.id && resolve(r.id)}
                                          className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                        >
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          {t("recap.resolve")}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

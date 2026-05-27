import { useEffect, useMemo, useState } from "react";
import { useAllLibrary, useAllTasks, useHelpRequests, useSubjects } from "@/hooks/useEntities";
import { type HelpRequest, type ColorKey, type SubjectType } from "@/lib/db";
import { helpRequestsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
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
}

type Tab = "open" | "answered";

export function TeacherRecapSheet({ open, onOpenChange }: Props) {
  const { t } = useI18n();
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
    const filtered = tab === "open" ? all.filter((h) => !h.resolved) : all.filter((h) => h.resolved);
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [helpRequests, tab]);

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
      <SheetContent side="bottom" className="h-[88vh] overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("recap.title")}</SheetTitle>
          <SheetDescription>{t("recap.subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-1 paper-card p-1 w-fit">
          {(["open", "answered"] as Tab[]).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md capitalize",
                tab === tk ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >{tk === "open" ? t("recap.openTab") : t("recap.answeredTab")}</button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {list.length === 0 ? (
            <EmptyState title={tab === "open" ? t("recap.noOpenQuestions") : t("recap.noAnswers")} />
          ) : (
            <>
              {tab === "open" && (
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={resolveAll}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> {t("recap.resolveAll")}
                  </Button>
                </div>
              )}
              {grouped.map((g) => (
                <section key={g.subjectName} className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">{g.subjectName}</h3>
                  <Accordion type="multiple" className="space-y-2">
                    {Array.from(g.items.values()).map((b) => (
                      <AccordionItem
                        key={b.itemTitle}
                        value={b.itemTitle}
                        className="paper-card border-none border-l-4 px-3"
                        style={subjectBorderStyle(g.subjectColor, g.subjectType, g.subjectCustomColor)}
                      >
                        <AccordionTrigger className="group py-3 hover:no-underline gap-2 w-full min-w-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                            <span
                              aria-hidden
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: subjectColorCss(g.subjectColor, g.subjectType, g.subjectCustomColor) }}
                            />
                            <span className="font-serif text-lg flex-1 min-w-0 block group-data-[state=closed]:truncate group-data-[state=open]:whitespace-normal group-data-[state=open]:break-words">{b.itemTitle}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({b.reqs.length})</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3">
                          {b.itemId && (
                            <div className="mb-3">
                              <Link
                                to={`/library`}
                                onClick={() => onOpenChange(false)}
                                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                              >
                                {t("recap.openInLibrary")} <ChevronRight className="h-3 w-3" />
                              </Link>
                            </div>
                          )}
                          <ul className="space-y-4">
                            {b.reqs.map((r) => {
                              const task = r.taskId ? taskById.get(r.taskId) : undefined;
                              const isAnswering = answeringId === r.id;
                              return (
                                <li key={r.id} className="space-y-2 border-l-2 pl-3" style={subjectBorderStyle(g.subjectColor, g.subjectType, g.subjectCustomColor)}>
                                  <div className="flex items-start gap-2">
                                    {r.resolved ? (
                                      <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                                    ) : (
                                      <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-1" />
                                    )}
                                    <p className="flex-1 text-base leading-relaxed whitespace-pre-wrap break-words">
                                      {r.question}
                                    </p>
                                  </div>

                                  {r.answer && !isAnswering && (
                                    <div className="flex items-start gap-2">
                                      <MessageSquareQuote className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                                      <p className="flex-1 text-base leading-relaxed whitespace-pre-wrap break-words">
                                        {r.answer}
                                      </p>
                                    </div>
                                  )}

                                  {r.answeredAt && !isAnswering && (
                                    <div className="text-xs text-muted-foreground tabular-nums pl-6">
                                      {new Date(r.answeredAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                                    </div>
                                  )}

                                  {isAnswering && (
                                    <div className="space-y-2">
                                      <Textarea
                                        rows={3}
                                        value={answerDraft}
                                        onChange={(e) => setAnswerDraft(e.target.value)}
                                        placeholder={t("recap.answerPlaceholder")}
                                      />
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setAnsweringId(null)}>{t("common.cancel")}</Button>
                                        <Button size="sm" onClick={() => r.id && saveAnswer(r.id)}>{t("recap.saveAnswer")}</Button>
                                      </div>
                                    </div>
                                  )}

                                  {!isAnswering && (
                                    <div className="flex items-center gap-3 flex-wrap pl-6">
                                      <button
                                        onClick={() => startAnswer(r)}
                                        className="text-xs text-primary hover:underline"
                                      >
                                        {r.answer ? t("recap.editAnswer") : t("recap.recordAnswer")}
                                      </button>
                                      {!r.resolved && (
                                        <button
                                          onClick={() => r.id && resolve(r.id)}
                                          className="text-xs text-muted-foreground hover:text-primary"
                                        >{t("recap.resolve")}</button>
                                      )}
                                      {task && (
                                        <Link
                                          to={`/history?from=${task.date}&to=${task.date}`}
                                          onClick={() => onOpenChange(false)}
                                          title={t("common.history")}
                                          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                                        >
                                          <HistoryIcon className="h-3.5 w-3.5" /> {t("recap.viewHistory")}
                                        </Link>
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

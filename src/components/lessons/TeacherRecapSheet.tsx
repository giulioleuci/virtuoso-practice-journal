import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type HelpRequest } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, HelpCircle, MessageSquareQuote, ChevronDown, ChevronRight, History as HistoryIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Tab = "open" | "answered";

export function TeacherRecapSheet({ open, onOpenChange }: Props) {
  const helpRequests = useLiveQuery(() => db.helpRequests.toArray());
  const items = useLiveQuery(() => db.library.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());

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
    const map = new Map<string, { subjectName: string; items: Map<number | "none", { itemId?: number; itemTitle: string; reqs: HelpRequest[] }> }>();
    for (const h of list) {
      const item = items?.find((i) => i.id === h.itemId);
      const subject = subjects?.find((s) => s.id === item?.subjectId);
      const subjectKey = subject?.name ?? "Other";
      if (!map.has(subjectKey)) map.set(subjectKey, { subjectName: subjectKey, items: new Map() });
      const bucket = map.get(subjectKey)!;
      const itemKey = h.itemId ?? "none";
      if (!bucket.items.has(itemKey)) {
        bucket.items.set(itemKey, { itemId: h.itemId, itemTitle: item?.title ?? "General", reqs: [] });
      }
      bucket.items.get(itemKey)!.reqs.push(h);
    }
    return Array.from(map.values());
  }, [list, items, subjects]);

  const startAnswer = (h: HelpRequest) => {
    setAnsweringId(h.id ?? null);
    setAnswerDraft(h.answer ?? "");
  };

  const saveAnswer = async (id: number) => {
    await db.helpRequests.update(id, {
      answer: answerDraft.trim() || undefined,
      answeredAt: answerDraft.trim() ? Date.now() : undefined,
      resolved: !!answerDraft.trim(),
    });
    setAnsweringId(null);
    setAnswerDraft("");
    toast.success("Answer saved");
  };

  const resolve = async (id: number) => {
    await db.helpRequests.update(id, { resolved: true });
    toast.success("Marked resolved");
  };

  const resolveAll = async () => {
    await db.transaction("rw", db.helpRequests, async () => {
      for (const h of list) if (h.id) await db.helpRequests.update(h.id, { resolved: true });
    });
    toast.success("All marked resolved");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Ask the Teacher</SheetTitle>
          <SheetDescription>Open questions and recorded answers, grouped by subject.</SheetDescription>
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
            >{tk}</button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {list.length === 0 ? (
            <p className="paper-card p-6 text-center text-muted-foreground italic">
              {tab === "open" ? "No open questions." : "No recorded answers yet."}
            </p>
          ) : (
            <>
              {tab === "open" && (
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={resolveAll}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve all
                  </Button>
                </div>
              )}
              {grouped.map((g) => (
                <section key={g.subjectName} className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">{g.subjectName}</h3>
                  {Array.from(g.items.values()).map((b) => (
                    <div key={b.itemTitle} className="paper-card p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-serif text-lg truncate">{b.itemTitle}</div>
                        {b.itemId && (
                          <Link
                            to={`/library`}
                            onClick={() => onOpenChange(false)}
                            className="text-xs text-primary hover:underline shrink-0 inline-flex items-center gap-0.5"
                          >
                            Open <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {b.reqs.map((r) => (
                          <li key={r.id} className="text-sm border-l-2 border-border pl-2">
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="flex-1">{r.question}</span>
                              {!r.resolved && (
                                <button
                                  onClick={() => r.id && resolve(r.id)}
                                  className="text-xs text-muted-foreground hover:text-primary shrink-0"
                                >Resolve</button>
                              )}
                            </div>
                            {r.answer && answeringId !== r.id && (
                              <div className="mt-1 ml-6 text-xs text-muted-foreground italic flex items-start gap-1">
                                <MessageSquareQuote className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="flex-1">{r.answer}</span>
                              </div>
                            )}
                            {answeringId === r.id ? (
                              <div className="ml-6 mt-2 space-y-2">
                                <Textarea
                                  rows={2}
                                  value={answerDraft}
                                  onChange={(e) => setAnswerDraft(e.target.value)}
                                  placeholder="Teacher said…"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setAnsweringId(null)}>Cancel</Button>
                                  <Button size="sm" onClick={() => r.id && saveAnswer(r.id)}>Save answer</Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => startAnswer(r)}
                                className="ml-6 mt-1 text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                              >
                                {r.answer ? "Edit answer" : "Record answer"}
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

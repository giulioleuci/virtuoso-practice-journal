import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db"; // db used for useLiveQuery reads only
import { helpRequestsService } from "@/lib/services";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { HelpCircle, MessageSquareQuote, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemId: number;
  itemTitle: string;
}

export function ItemHelpSheet({ open, onOpenChange, itemId, itemTitle }: Props) {
  const reqs = useLiveQuery(
    () => db.helpRequests.where("itemId").equals(itemId).toArray(),
    [itemId]
  );

  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => { if (!open) { setDraft(""); setAnswers({}); } }, [open]);

  const addQuestion = async () => {
    if (!draft.trim()) return;
    await helpRequestsService.add(itemId, draft.trim());
    setDraft("");
    toast.success("Question saved");
  };

  const saveAnswer = async (id: number) => {
    const text = (answers[id] ?? "").trim();
    if (!text) return;
    await helpRequestsService.answer(id, text);
    setAnswers((a) => { const c = { ...a }; delete c[id]; return c; });
    toast.success("Answer saved");
  };

  const remove = async (id: number) => {
    await helpRequestsService.remove(id);
  };

  const sorted = (reqs ?? []).sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.createdAt - a.createdAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] max-h-[85dvh] rounded-t-3xl bg-background p-0 flex flex-col pt-[env(safe-area-inset-top)]"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="font-serif text-2xl">Ask the Teacher</SheetTitle>
          <SheetDescription>{itemTitle}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] mt-4 space-y-4">
          <div className="paper-card p-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">New question</div>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What do you want to ask?"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuestion(); } }}
              />
              <Button size="icon" variant="outline" onClick={addQuestion}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          {sorted.length === 0 ? (
            <p className="paper-card p-6 text-center text-muted-foreground italic">No questions yet.</p>
          ) : (
            <Accordion type="single" collapsible className="space-y-1.5">
              {sorted.map((r) => (
                <AccordionItem
                  key={r.id}
                  value={String(r.id)}
                  className="paper-card border-none"
                >
                  <AccordionTrigger className="group px-3 py-2 hover:no-underline gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0 text-left">
                      {r.resolved ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <HelpCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      )}
                      <span className="flex-1 text-sm group-data-[state=closed]:truncate group-data-[state=open]:whitespace-pre-wrap group-data-[state=open]:break-words">
                        {r.question}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-2">
                    {r.answer ? (
                      <div className="space-y-1">
                        <div className="text-sm text-foreground flex items-start gap-1.5 leading-relaxed">
                          <MessageSquareQuote className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1 whitespace-pre-wrap break-words">{r.answer}</span>
                        </div>
                        {r.answeredAt && (
                          <div className="text-xs text-muted-foreground tabular-nums pl-[22px]">
                            {new Date(r.answeredAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Textarea
                          rows={2}
                          value={answers[r.id!] ?? ""}
                          onChange={(e) => setAnswers((a) => ({ ...a, [r.id!]: e.target.value }))}
                          placeholder="Record the teacher's answer…"
                        />
                        <Button size="sm" variant="outline" onClick={() => r.id && saveAnswer(r.id)}>Save answer</Button>
                      </div>
                    )}
                    <button
                      onClick={() => r.id && remove(r.id)}
                      className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Delete
                    </button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

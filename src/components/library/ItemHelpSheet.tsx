import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { HelpCircle, MessageSquareQuote, Plus, X, ChevronDown, CheckCircle2 } from "lucide-react";
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => { if (!open) { setDraft(""); setAnswers({}); setExpandedId(null); } }, [open]);

  const addQuestion = async () => {
    if (!draft.trim()) return;
    await db.helpRequests.add({
      itemId,
      question: draft.trim(),
      resolved: false,
      createdAt: Date.now(),
    });
    setDraft("");
    toast.success("Question saved");
  };

  const saveAnswer = async (id: number) => {
    const text = (answers[id] ?? "").trim();
    if (!text) return;
    await db.helpRequests.update(id, { answer: text, answeredAt: Date.now(), resolved: true });
    setAnswers((a) => { const c = { ...a }; delete c[id]; return c; });
    toast.success("Answer saved");
  };

  const remove = async (id: number) => {
    await db.helpRequests.delete(id);
  };

  const sorted = (reqs ?? []).sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.createdAt - a.createdAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Ask the Teacher</SheetTitle>
          <SheetDescription>{itemTitle}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
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
            <ul className="space-y-1.5">
              {sorted.map((r) => {
                const expanded = expandedId === r.id;
                return (
                  <li key={r.id} className="paper-card">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : (r.id ?? null))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    >
                      {r.resolved ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="flex-1 text-sm truncate">{r.question}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {r.answer ? (
                          <div className="text-xs text-muted-foreground italic flex items-start gap-1">
                            <MessageSquareQuote className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="flex-1">{r.answer}</span>
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
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

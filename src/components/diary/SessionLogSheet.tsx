import { useEffect, useMemo, useState } from "react";
import { db, type NoteVal, type SessionQuality, type Task } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { useLiveQuery } from "dexie-react-hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  prefill?: { bpm?: number; noteVal?: NoteVal; notes?: string };
}

const QUALITIES: { val: SessionQuality; label: string; emoji: string }[] = [
  { val: "hard",  label: "Hard",   emoji: "🥵" },
  { val: "well",  label: "Well",   emoji: "🙂" },
  { val: "great", label: "Great",  emoji: "✨" },
];

export function SessionLogSheet({ open, onOpenChange, task, prefill }: Props) {
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();
  const [quality, setQuality] = useState<SessionQuality>("well");
  const [notes, setNotes] = useState("");
  const [needHelp, setNeedHelp] = useState(false);
  const [helpText, setHelpText] = useState("");

  useEffect(() => {
    if (open && task) {
      setBpm(prefill?.bpm ?? task.targetBpm);
      setNoteVal(prefill?.noteVal ?? task.noteVal);
      setQuality("well");
      setNotes(prefill?.notes ?? "");
      setNeedHelp(false);
      setHelpText("");
    }
  }, [open, task, prefill]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push("BPM out of range (20–400)");
    if (needHelp && !helpText.trim()) e.push("Describe what to ask the teacher");
    return e;
  }, [bpm, needHelp, helpText]);

  const save = async () => {
    if (!task?.id || errors.length) return;
    const now = Date.now();
    await db.transaction("rw", db.tasks, db.sessions, db.helpRequests, async () => {
      const sessionId = await db.sessions.add({
        taskId: task.id!,
        date: task.date,
        bpmReached: bpm,
        noteVal,
        quality,
        notes: notes.trim() || undefined,
        createdAt: now,
      });
      await db.tasks.update(task.id!, { done: true });
      if (needHelp) {
        await db.helpRequests.add({
          sessionId: sessionId as number,
          taskId: task.id!,
          itemId: task.itemId,
          question: helpText.trim(),
          resolved: false,
          createdAt: now,
        });
      }
    });
    toast.success("Session logged");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Log session</SheetTitle>
          {task && <p className="text-sm text-muted-foreground italic">{task.title}</p>}
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <BpmCoupler
            bpm={bpm}
            noteVal={noteVal}
            onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }}
            label="BPM reached"
          />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">How did it go?</Label>
            <div className="grid grid-cols-3 gap-2">
              {QUALITIES.map((q) => (
                <button
                  key={q.val}
                  type="button"
                  onClick={() => setQuality(q.val)}
                  className={cn(
                    "paper-card flex flex-col items-center py-3 transition-all",
                    quality === q.val ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
                  )}
                >
                  <span className="text-2xl">{q.emoji}</span>
                  <span className="text-xs mt-1">{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="A thought, a difficulty, a small win…"
              rows={3}
            />
          </div>

          <div className="paper-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Ask the teacher</div>
                <div className="text-xs text-muted-foreground">Flag this for the next lesson</div>
              </div>
              <Switch checked={needHelp} onCheckedChange={setNeedHelp} />
            </div>
            {needHelp && (
              <Textarea
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="What would you like to ask?"
                rows={3}
              />
            )}
          </div>

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              Save session
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type NoteVal, type Session, type SessionQuality } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: Session | null;
}

const QUALITIES: { val: SessionQuality; label: string; emoji: string }[] = [
  { val: "hard", label: "Hard", emoji: "🥵" },
  { val: "well", label: "Well", emoji: "🙂" },
  { val: "great", label: "Great", emoji: "✨" },
];

export function SessionDetailSheet({ open, onOpenChange, session }: Props) {
  const task = useLiveQuery(
    () => (session?.taskId ? db.tasks.get(session.taskId) : Promise.resolve(undefined)),
    [session?.taskId]
  );
  const item = useLiveQuery(
    () => (task?.itemId ? db.library.get(task.itemId) : Promise.resolve(undefined)),
    [task?.itemId]
  );
  const segment = useLiveQuery(
    () => (task?.segmentId ? db.segments.get(task.segmentId) : Promise.resolve(undefined)),
    [task?.segmentId]
  );

  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();
  const [quality, setQuality] = useState<SessionQuality>("well");
  const [notes, setNotes] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (open && session) {
      setEditing(false);
      setDate(session.date);
      setBpm(session.bpmReached);
      setNoteVal(session.noteVal);
      setQuality(session.quality ?? "well");
      setNotes(session.notes ?? "");
    }
  }, [open, session]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!date) e.push("Date required");
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push("BPM out of range");
    return e;
  }, [date, bpm]);

  const save = async () => {
    if (!session?.id || errors.length) return;
    await db.sessions.update(session.id, {
      date, bpmReached: bpm, noteVal, quality, notes: notes.trim() || undefined,
    });
    toast.success("Session updated");
    setEditing(false);
  };

  const del = async () => {
    if (!session?.id) return;
    await db.sessions.delete(session.id);
    toast.success("Session deleted");
    setConfirmDel(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Session</SheetTitle>
        </SheetHeader>

        {!session ? null : (
          <div className="mt-4 space-y-4">
            <div className="paper-card p-3 space-y-1">
              <div className="font-serif text-lg">{task?.title ?? "—"}</div>
              {item && <div className="text-xs text-muted-foreground">{item.title}{item.composer ? ` · ${item.composer}` : ""}</div>}
              {segment && <div className="text-xs text-muted-foreground italic">Segment: {segment.label}</div>}
            </div>

            {!editing ? (
              <>
                <dl className="paper-card p-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</dt>
                    <dd className="tabular-nums">{session.date}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Quality</dt>
                    <dd className="capitalize">{session.quality ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">BPM</dt>
                    <dd className="tabular-nums">{session.bpmReached ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</dt>
                    <dd>{session.noteVal ?? "—"}</dd>
                  </div>
                </dl>

                {session.notes && (
                  <div className="paper-card p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                    <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditing(true)}>Edit</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => setConfirmDel(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <BpmCoupler
                  bpm={bpm}
                  noteVal={noteVal}
                  onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }}
                  label="BPM reached"
                />

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quality</Label>
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
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                {errors.length > 0 && (
                  <ul className="text-xs text-destructive space-y-0.5">
                    {errors.map((e) => <li key={e}>• {e}</li>)}
                  </ul>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button className="flex-1" disabled={errors.length > 0} onClick={save}>Save</Button>
                </div>
              </>
            )}
          </div>
        )}

        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this session?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

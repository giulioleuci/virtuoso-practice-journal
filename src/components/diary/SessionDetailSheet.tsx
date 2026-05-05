import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type NoteVal, type Session, type SessionQuality } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/shared/StarRating";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
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
  const [layersUsed, setLayersUsed] = useState<string[]>([]);
  const [techniquesUsed, setTechniquesUsed] = useState<number[]>([]);
  const [reps, setReps] = useState<number | undefined>();
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [confirmDel, setConfirmDel] = useState(false);

  const subject = useLiveQuery(
    () => (task?.subjectId ? db.subjects.get(task.subjectId) : Promise.resolve(undefined)),
    [task?.subjectId]
  );
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);
  const layerOptions = (subject?.layers ?? []).map((l) => ({ value: l, label: l }));
  const techniqueOptions = (allTechniques ?? [])
    .filter((t) => t.subjectId === task?.subjectId)
    .map((t) => ({ value: t.id!, label: t.name }));

  useEffect(() => {
    if (open && session) {
      setEditing(false);
      setDate(session.date);
      setBpm(session.bpmReached);
      setNoteVal(session.noteVal);
      setQuality(session.quality ?? "well");
      setNotes(session.notes ?? "");
      setLayersUsed(session.layersUsed ?? []);
      setTechniquesUsed(session.techniquesUsed ?? []);
      setReps(session.reps);
      setConfidence(session.confidence ?? 3);
    }
  }, [open, session]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!date) e.push("Date required");
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push("BPM out of range");
    if (reps !== undefined && (reps < 0 || reps > 9999)) e.push("Reps out of range");
    return e;
  }, [date, bpm, reps]);

  const save = async () => {
    if (!session?.id || errors.length) return;
    await db.sessions.update(session.id, {
      date, bpmReached: bpm, noteVal, quality, notes: notes.trim() || undefined,
      layersUsed, techniquesUsed, reps, confidence,
    });
    toast.success("Session updated");
    setEditing(false);
  };

  const del = async () => {
    if (!session?.id) return;
    const taskId = session.taskId;
    await db.sessions.delete(session.id);
    if (taskId) {
      const remaining = await db.sessions.where("taskId").equals(taskId).count();
      if (remaining === 0) await db.tasks.update(taskId, { done: false });
    }
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
              <div className="font-serif text-lg">{session.snapshot?.taskTitle ?? task?.title ?? "—"}</div>
              {(session.snapshot?.itemTitle || item) && (
                <div className="text-xs text-muted-foreground">
                  {session.snapshot?.itemTitle ?? item?.title}
                  {(session.snapshot?.itemComposer ?? item?.composer)
                    ? ` · ${session.snapshot?.itemComposer ?? item?.composer}` : ""}
                </div>
              )}
              {(session.snapshot?.segmentLabel || segment) && (
                <div className="text-xs text-muted-foreground italic">
                  Segment: {session.snapshot?.segmentLabel ?? segment?.label}
                </div>
              )}
              {session.snapshot && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 pt-1">
                  Snapshot · {session.snapshot.subjectName}
                </div>
              )}
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
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Reps</dt>
                    <dd className="tabular-nums">{session.reps ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</dt>
                    <dd className="tabular-nums">{session.confidence != null ? `${session.confidence}/5` : "—"}</dd>
                  </div>
                </dl>

                {session.notes && (
                  <div className="paper-card p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                    <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
                  </div>
                )}
                {(session.layersUsed?.length || session.techniquesUsed?.length) ? (
                  <div className="paper-card p-3 space-y-2 text-xs">
                    {!!session.layersUsed?.length && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Layers</div>
                        <div className="flex flex-wrap gap-1.5">{session.layersUsed.map((l) => (
                          <span key={l} className="px-2 py-0.5 rounded-full bg-accent/60">{l}</span>
                        ))}</div>
                      </div>
                    )}
                    {!!session.techniquesUsed?.length && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Techniques</div>
                        <div className="flex flex-wrap gap-1.5">{session.techniquesUsed.map((id) => {
                          const n = (allTechniques ?? []).find((t) => t.id === id)?.name;
                          return n ? <span key={id} className="px-2 py-0.5 rounded-full bg-accent/60">{n}</span> : null;
                        })}</div>
                      </div>
                    )}
                  </div>
                ) : null}

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
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Repetitions</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={9999}
                    value={reps ?? ""}
                    onChange={(e) => setReps(e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confidence</Label>
                    <span className="text-sm tabular-nums">{confidence}/5</span>
                  </div>
                  <Slider min={1} max={5} step={1} value={[confidence]} onValueChange={(v) => setConfidence(v[0])} />
                </div>

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

                <MultiChipPicker
                  label="Layers practiced"
                  options={layerOptions}
                  value={layersUsed}
                  onChange={setLayersUsed}
                />
                <MultiChipPicker
                  label="Techniques practiced"
                  options={techniqueOptions}
                  value={techniquesUsed}
                  onChange={setTechniquesUsed}
                />

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

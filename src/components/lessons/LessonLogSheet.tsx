import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Lesson, type LessonRecurrence } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { TeacherRecapSheet } from "@/components/lessons/TeacherRecapSheet";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recurrence?: LessonRecurrence | null;
  subjectId?: number;
  lesson?: Lesson | null;
  prefilledDate?: string;
}

export function LessonLogSheet({ open, onOpenChange, recurrence, subjectId, lesson, prefilledDate }: Props) {
  const isEdit = !!lesson?.id;
  const subjId = lesson?.subjectId ?? recurrence?.subjectId ?? subjectId;

  const library = useLiveQuery(
    () => (subjId ? db.library.where("subjectId").equals(subjId).toArray() : Promise.resolve([])),
    [subjId]
  );
  const helpReqs = useLiveQuery(
    () => db.helpRequests.toArray().then((rs) => rs.filter((r) => !r.resolved)),
    []
  );
  const helpForSubject = useMemo(() => {
    if (!subjId || !library) return [];
    const itemIds = new Set(library.map((l) => l.id));
    return (helpReqs ?? []).filter((h) => h.itemId && itemIds.has(h.itemId));
  }, [helpReqs, library, subjId]);

  const existingAssignments = useLiveQuery(
    () => (lesson?.id ? db.assignments.where("lessonId").equals(lesson.id).toArray() : Promise.resolve([])),
    [lesson?.id]
  );

  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [piecesPlayed, setPiecesPlayed] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [recapOpen, setRecapOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(lesson?.date ?? prefilledDate ?? new Date().toISOString().slice(0, 10));
    setNotes(lesson?.notes ?? "");
    setPiecesPlayed(lesson?.piecesPlayed ?? []);
    setAssignments(existingAssignments?.map((a) => a.text) ?? []);
    setDraft("");
  }, [open, lesson, existingAssignments]);

  const togglePiece = (id: number) =>
    setPiecesPlayed((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const addAssignment = () => {
    const t = draft.trim();
    if (!t) return;
    setAssignments((a) => [...a, t]);
    setDraft("");
  };

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjId) e.push("No subject linked");
    if (!date) e.push("Date required");
    return e;
  }, [subjId, date]);

  const save = async () => {
    if (errors.length) return;
    await db.transaction("rw", db.lessons, db.assignments, db.helpRequests, async () => {
      let lessonId: number;
      if (isEdit && lesson?.id) {
        await db.lessons.put({
          ...lesson,
          date,
          notes: notes.trim() || undefined,
          piecesPlayed,
        });
        lessonId = lesson.id;
        // Replace assignments wholesale
        await db.assignments.where("lessonId").equals(lessonId).delete();
      } else {
        lessonId = (await db.lessons.add({
          recurrenceId: recurrence?.id,
          subjectId: subjId!,
          date,
          notes: notes.trim() || undefined,
          piecesPlayed,
          createdAt: Date.now(),
        })) as number;
      }
      if (assignments.length) {
        await db.assignments.bulkAdd(
          assignments.map((text) => ({
            lessonId,
            text,
            transformed: false,
            createdAt: Date.now(),
          }))
        );
      }
    });
    toast.success(isEdit ? "Lesson updated" : "Lesson logged");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">
            {isEdit ? "Edit lesson" : "Log lesson"}
          </SheetTitle>
          {recurrence && <p className="text-sm text-muted-foreground italic">with {recurrence.teacher}</p>}
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="What was discussed, what landed, what didn't…" />
          </div>

          {!!library?.length && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pieces played</Label>
              <div className="paper-card p-3 space-y-2">
                {library.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={piecesPlayed.includes(l.id!)}
                      onCheckedChange={() => togglePiece(l.id!)}
                    />
                    <span className="flex-1 truncate">{l.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Help requests
            </Label>
            <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setRecapOpen(true)}>
              <HelpCircle className="h-4 w-4 mr-2" /> Open Ask the Teacher recap
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assignments</Label>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAssignment(); } }}
                placeholder="Practice this scale at 80…"
              />
              <Button type="button" onClick={addAssignment} size="icon" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {assignments.length > 0 && (
              <ul className="space-y-1.5 mt-2">
                {assignments.map((a, i) => (
                  <li key={i} className="paper-card px-3 py-2 flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1">{a}</span>
                    <button
                      onClick={() => setAssignments((arr) => arr.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              {isEdit ? "Save" : "Log lesson"}
            </Button>
          </div>
        </div>
      </SheetContent>
      <TeacherRecapSheet open={recapOpen} onOpenChange={setRecapOpen} />
    </Sheet>
  );
}

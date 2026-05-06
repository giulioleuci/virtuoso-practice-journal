import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type LibraryItem, type PracticeStatus } from "@/lib/db";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryItemKindFields } from "./LibraryItemKindFields";
import { type DraftSegment } from "./SegmentsEditor";
import { type MasteryState } from "./MasterySliders";
import { libraryService } from "@/lib/services";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LibraryKind;
  /** When provided, the sheet opens in edit mode prefilled with this item. */
  item?: LibraryItem | null;
}

const STATUSES: { key: PracticeStatus; label: string }[] = [
  { key: "in_study",    label: "In study" },
  { key: "maintenance", label: "Maintenance" },
  { key: "pause",       label: "Paused" },
];

const emptyMastery: MasteryState = {
  conceptual: 0,
  analytical: 0,
  aural: 0,
  compositional: 0,
};

const BPM_MIN = 20;
const BPM_MAX = 400;

const isValidBpm = (n: number | undefined) =>
  n === undefined || (Number.isFinite(n) && n >= BPM_MIN && n <= BPM_MAX);

export function NewLibraryItemSheet({ open, onOpenChange, kind, item }: Props) {
  const isEdit = !!item?.id;
  const editingKind = item?.kind ?? kind;

  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);
  const existingSegments = useLiveQuery(
    () => (item?.id ? db.segments.where("itemId").equals(item.id).toArray() : Promise.resolve([])),
    [item?.id]
  );

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [status, setStatus] = useState<PracticeStatus>("in_study");

  const [targetBpm, setTargetBpm] = useState<number | undefined>();
  const [startBpm, setStartBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<LibraryItem["noteVal"]>();

  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);
  const [segments, setSegments] = useState<DraftSegment[]>([]);

  const [totalExercises, setTotalExercises] = useState<number | undefined>();
  const [currentExercise, setCurrentExercise] = useState<number | undefined>(1);

  const [mastery, setMastery] = useState<MasteryState>(emptyMastery);

  const subjectTechniqueOptions = useMemo(
    () => (allTechniques ?? [])
      .filter((t) => t.subjectId === subjectId)
      .map((t) => ({ value: t.id!, label: t.name })),
    [allTechniques, subjectId]
  );
  const subjectLayers = useMemo(
    () => subjects?.find((s) => s.id === subjectId)?.layers ?? [],
    [subjects, subjectId]
  );
  // Default subject when sheet opens / subjects load (create mode)
  useEffect(() => {
    if (open && !isEdit && subjects?.length && subjectId === undefined) {
      setSubjectId(subjects[0].id);
    }
  }, [open, subjects, subjectId, isEdit]);

  // Prefill on edit-open
  useEffect(() => {
    if (!open) return;
    if (isEdit && item) {
      setSubjectId(item.subjectId);
      setTitle(item.title ?? "");
      setComposer(item.composer ?? "");
      setStatus(item.status ?? "in_study");
      setTargetBpm(item.targetBpm);
      setStartBpm(item.startBpm);
      setNoteVal(item.noteVal);
      setTechniqueIds(item.techniqueIds ?? []);
      setTotalExercises(item.totalExercises);
      setCurrentExercise(item.currentExercise ?? 1);
      setMastery(item.mastery ?? emptyMastery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, item?.id]);

  // Hydrate segments from DB on edit
  useEffect(() => {
    if (open && isEdit && existingSegments) {
      setSegments(
        existingSegments.map((s) => ({
          label: s.label,
          targetBpm: s.targetBpm,
          noteVal: s.noteVal,
          layers: s.layers ?? [],
          techniqueIds: s.techniqueIds ?? [],
        }))
      );
    }
  }, [open, isEdit, existingSegments]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setTitle("");
      setComposer("");
      setStatus("in_study");
      setTargetBpm(undefined);
      setStartBpm(undefined);
      setNoteVal(undefined);
      setTechniqueIds([]);
      setSegments([]);
      setTotalExercises(undefined);
      setCurrentExercise(1);
      setMastery(emptyMastery);
      setSubjectId(undefined);
    }
  }, [open]);

  const titleLabel = useMemo(() => {
    if (isEdit) return "Edit item";
    switch (editingKind) {
      case "repertoire": return "New piece";
      case "manual":     return "New manual";
      case "technique":  return "New technique";
      case "theory":     return "New theory topic";
    }
  }, [editingKind, isEdit]);

  // ---- Validation ----
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!title.trim()) e.push("Title is required");
    if (subjectId === undefined) e.push("Pick a subject");

    if (!isValidBpm(targetBpm)) e.push(`Target BPM must be ${BPM_MIN}–${BPM_MAX}`);
    if (!isValidBpm(startBpm)) e.push(`Start BPM must be ${BPM_MIN}–${BPM_MAX}`);

    if (editingKind === "technique" && startBpm !== undefined && targetBpm !== undefined && startBpm > targetBpm) {
      e.push("Start BPM cannot exceed target BPM");
    }

    if (editingKind === "manual") {
      if (currentExercise === undefined || currentExercise < 1) e.push("Current exercise required (≥ 1)");
      if (totalExercises !== undefined && totalExercises < 1) e.push("Total exercises must be ≥ 1");
      if (
        currentExercise !== undefined &&
        totalExercises !== undefined &&
        currentExercise > totalExercises
      ) {
        e.push("Current cannot exceed total");
      }
    }

    if ((editingKind === "repertoire" || editingKind === "manual") && segments.length) {
      if (segments.some((s) => !s.label.trim())) e.push("Every segment needs a label");
      if (segments.some((s) => !isValidBpm(s.targetBpm))) e.push("Segment BPM out of range");
    }

    return e;
  }, [title, subjectId, targetBpm, startBpm, editingKind, currentExercise, totalExercises, segments]);

  const canSave = errors.length === 0;

  const save = async () => {
    if (!canSave || subjectId === undefined) return;
    const now = Date.now();
    const base: LibraryItem = {
      subjectId,
      kind: editingKind,
      title: title.trim(),
      createdAt: item?.createdAt ?? now,
    };

    if (editingKind === "repertoire") {
      base.composer = composer.trim() || undefined;
      base.status = status;
      base.targetBpm = targetBpm;
      base.noteVal = noteVal;
      base.techniqueIds = techniqueIds;
    } else if (editingKind === "manual") {
      base.composer = composer.trim() || undefined;
      base.totalExercises = totalExercises;
      base.currentExercise = currentExercise;
      base.targetBpm = targetBpm;
      base.noteVal = noteVal;
      base.techniqueIds = techniqueIds;
    } else if (editingKind === "technique") {
      base.composer = composer.trim() || undefined;
      base.startBpm = startBpm;
      base.targetBpm = targetBpm;
      base.noteVal = noteVal;
      base.techniqueIds = techniqueIds;
    } else if (editingKind === "theory") {
      base.mastery = mastery;
    }

    let itemId: number;
    if (isEdit && item?.id) {
      await db.library.put({ ...base, id: item.id });
      itemId = item.id;
      // Replace segments wholesale for simplicity & correctness
      await db.segments.where("itemId").equals(itemId).delete();
    } else {
      itemId = (await db.library.add(base)) as number;
    }

    if ((editingKind === "repertoire" || editingKind === "manual") && segments.length) {
      await db.segments.bulkAdd(
        segments.map((s) => ({
          itemId,
          label: s.label.trim(),
          targetBpm: s.targetBpm,
          noteVal: s.noteVal,
          layers: s.layers ?? [],
          techniqueIds: s.techniqueIds ?? [],
          createdAt: now,
        }))
      );
    }

    toast.success(isEdit ? `${title.trim()} updated` : `${title.trim()} added to library`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-3xl bg-background p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <SheetTitle className="font-serif text-3xl">{titleLabel}</SheetTitle>
          <SheetDescription className="italic">
            Capture only what's useful — you can refine later.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Subject */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Subject
            </Label>
            <Select
              value={subjectId !== undefined ? String(subjectId) : ""}
              onValueChange={(v) => setSubjectId(Number(v))}
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Pick a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                editingKind === "repertoire"
                  ? "Sonata in C major, K.545…"
                  : editingKind === "manual"
                  ? "Hanon — The Virtuoso Pianist"
                  : editingKind === "technique"
                  ? "C major scale, hands together"
                  : "Secondary dominants"
              }
              className="bg-card text-lg h-12"
              autoFocus
            />
          </div>

          {/* Composer */}
          {(editingKind === "repertoire" || editingKind === "manual") && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {editingKind === "manual" ? "Author" : "Composer"}
              </Label>
              <Input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder={editingKind === "manual" ? "Hanon" : "Mozart"}
                className="bg-card"
              />
            </div>
          )}

          {/* Repertoire */}
          {editingKind === "repertoire" && (
            <>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Status
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStatus(s.key)}
                      className={cn(
                        "paper-card py-2.5 text-sm font-medium transition-all",
                        status === s.key
                          ? "ring-2 ring-primary"
                          : "hover:-translate-y-0.5"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <BpmCoupler bpm={targetBpm} noteVal={noteVal} onChange={(n) => {
                setTargetBpm(n.bpm); setNoteVal(n.noteVal);
              }} />

              <MultiChipPicker
                label="Techniques"
                options={subjectTechniqueOptions}
                value={techniqueIds}
                onChange={setTechniqueIds}
                emptyHint="Add techniques in Profile to associate them here."
              />
              <SegmentsEditor segments={segments} onChange={setSegments} subjectLayers={subjectLayers} techniqueOptions={subjectTechniqueOptions} />
            </>
          )}

          {/* Manual */}
          {editingKind === "manual" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Current exercise
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={currentExercise ?? ""}
                    onChange={(e) =>
                      setCurrentExercise(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Total exercises
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={totalExercises ?? ""}
                    onChange={(e) =>
                      setTotalExercises(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="bg-card"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <BpmCoupler bpm={targetBpm} noteVal={noteVal} onChange={(n) => {
                setTargetBpm(n.bpm); setNoteVal(n.noteVal);
              }} />

              <MultiChipPicker
                label="Techniques"
                options={subjectTechniqueOptions}
                value={techniqueIds}
                onChange={setTechniqueIds}
                emptyHint="Add techniques in Profile to associate them here."
              />
              <SegmentsEditor segments={segments} onChange={setSegments} subjectLayers={subjectLayers} techniqueOptions={subjectTechniqueOptions} />
            </>
          )}

          {/* Technique */}
          {editingKind === "technique" && (
            <>
              <BpmCoupler
                bpm={startBpm}
                noteVal={noteVal}
                onChange={(n) => { setStartBpm(n.bpm); setNoteVal(n.noteVal); }}
                label="Starting tempo"
              />
              <BpmCoupler
                bpm={targetBpm}
                noteVal={noteVal}
                onChange={(n) => { setTargetBpm(n.bpm); setNoteVal(n.noteVal); }}
                label="Target tempo"
              />
              <MultiChipPicker
                label="Techniques covered"
                options={subjectTechniqueOptions}
                value={techniqueIds}
                onChange={setTechniqueIds}
                emptyHint="Add techniques in Profile to associate them here."
              />
            </>
          )}

          {/* Theory */}
          {editingKind === "theory" && <MasterySliders value={mastery} onChange={setMastery} />}

          {/* Validation summary */}
          {errors.length > 0 && (
            <div className="paper-card p-3 border border-destructive/30">
              <p className="text-xs uppercase tracking-wider text-destructive mb-1">
                Fix to save
              </p>
              <ul className="text-sm text-destructive/90 list-disc pl-5 space-y-0.5">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur">
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave} className="flex-1">
              {isEdit ? "Save changes" : "Save to library"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

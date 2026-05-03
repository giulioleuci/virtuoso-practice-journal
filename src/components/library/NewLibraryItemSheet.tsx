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
import { BpmCoupler } from "./BpmCoupler";
import { SegmentsEditor, type DraftSegment } from "./SegmentsEditor";
import { LayersEditor } from "./LayersEditor";
import { MasterySliders, type MasteryState } from "./MasterySliders";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LibraryKind;
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

export function NewLibraryItemSheet({ open, onOpenChange, kind }: Props) {
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [status, setStatus] = useState<PracticeStatus>("in_study");

  const [targetBpm, setTargetBpm] = useState<number | undefined>();
  const [startBpm, setStartBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<LibraryItem["noteVal"]>();

  const [layers, setLayers] = useState<string[]>([]);
  const [segments, setSegments] = useState<DraftSegment[]>([]);

  const [totalExercises, setTotalExercises] = useState<number | undefined>();
  const [currentExercise, setCurrentExercise] = useState<number | undefined>(1);

  const [mastery, setMastery] = useState<MasteryState>(emptyMastery);

  // Default subject when sheet opens / subjects load
  useEffect(() => {
    if (open && subjects?.length && subjectId === undefined) {
      setSubjectId(subjects[0].id);
    }
  }, [open, subjects, subjectId]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setTitle("");
      setComposer("");
      setStatus("in_study");
      setTargetBpm(undefined);
      setStartBpm(undefined);
      setNoteVal(undefined);
      setLayers([]);
      setSegments([]);
      setTotalExercises(undefined);
      setCurrentExercise(1);
      setMastery(emptyMastery);
      setSubjectId(undefined);
    }
  }, [open]);

  const titleLabel = useMemo(() => {
    switch (kind) {
      case "repertoire": return "New piece";
      case "manual":     return "New manual";
      case "technique":  return "New technique";
      case "theory":     return "New theory topic";
    }
  }, [kind]);

  const canSave = title.trim().length > 0 && subjectId !== undefined;

  const save = async () => {
    if (!canSave || subjectId === undefined) return;
    const now = Date.now();
    const base: LibraryItem = {
      subjectId,
      kind,
      title: title.trim(),
      createdAt: now,
    };

    if (kind === "repertoire") {
      base.composer = composer.trim() || undefined;
      base.status = status;
      base.targetBpm = targetBpm;
      base.noteVal = noteVal;
      base.layers = layers;
    } else if (kind === "manual") {
      base.composer = composer.trim() || undefined;
      base.totalExercises = totalExercises;
      base.currentExercise = currentExercise;
      base.targetBpm = targetBpm;
      base.noteVal = noteVal;
    } else if (kind === "technique") {
      base.startBpm = startBpm;
      base.targetBpm = targetBpm;
      base.noteVal = noteVal;
      base.layers = layers;
    } else if (kind === "theory") {
      base.mastery = mastery;
    }

    const itemId = (await db.library.add(base)) as number;

    if ((kind === "repertoire" || kind === "manual") && segments.length) {
      await db.segments.bulkAdd(
        segments.map((s) => ({
          itemId,
          label: s.label,
          targetBpm: s.targetBpm,
          noteVal: s.noteVal,
          confidence: s.confidence,
          layers: [],
          createdAt: now,
        }))
      );
    }

    toast.success(`${title.trim()} added to library`);
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
                kind === "repertoire"
                  ? "Sonata in C major, K.545…"
                  : kind === "manual"
                  ? "Hanon — The Virtuoso Pianist"
                  : kind === "technique"
                  ? "C major scale, hands together"
                  : "Secondary dominants"
              }
              className="bg-card text-lg h-12"
              autoFocus
            />
          </div>

          {/* Composer (repertoire/manual) */}
          {(kind === "repertoire" || kind === "manual") && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {kind === "manual" ? "Author" : "Composer"}
              </Label>
              <Input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder={kind === "manual" ? "Hanon" : "Mozart"}
                className="bg-card"
              />
            </div>
          )}

          {/* Repertoire-specific */}
          {kind === "repertoire" && (
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

              <LayersEditor layers={layers} onChange={setLayers} />
              <SegmentsEditor segments={segments} onChange={setSegments} />
            </>
          )}

          {/* Manual-specific */}
          {kind === "manual" && (
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

              <SegmentsEditor segments={segments} onChange={setSegments} />
            </>
          )}

          {/* Technique-specific */}
          {kind === "technique" && (
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
              <LayersEditor layers={layers} onChange={setLayers} />
            </>
          )}

          {/* Theory-specific */}
          {kind === "theory" && <MasterySliders value={mastery} onChange={setMastery} />}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur">
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave} className="flex-1">
              Save to library
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

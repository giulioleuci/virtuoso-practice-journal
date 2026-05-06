/** Kind-specific form fields for library items, extracted from NewLibraryItemSheet
 *  to keep the parent sheet focused on layout & save orchestration. */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BpmCoupler } from "./BpmCoupler";
import { SegmentsEditor, type DraftSegment } from "./SegmentsEditor";
import { MasterySliders, type MasteryState } from "./MasterySliders";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { cn } from "@/lib/utils";
import type { LibraryKind, NoteVal, PracticeStatus } from "@/lib/db";

const STATUSES: { key: PracticeStatus; label: string }[] = [
  { key: "in_study",    label: "In study" },
  { key: "maintenance", label: "Maintenance" },
  { key: "pause",       label: "Paused" },
];

interface Props {
  kind: LibraryKind;
  status: PracticeStatus; setStatus: (v: PracticeStatus) => void;
  targetBpm?: number; setTargetBpm: (v?: number) => void;
  startBpm?: number; setStartBpm: (v?: number) => void;
  noteVal?: NoteVal; setNoteVal: (v?: NoteVal) => void;
  techniqueIds: number[]; setTechniqueIds: (v: number[]) => void;
  segments: DraftSegment[]; setSegments: (v: DraftSegment[]) => void;
  totalExercises?: number; setTotalExercises: (v?: number) => void;
  currentExercise?: number; setCurrentExercise: (v?: number) => void;
  mastery: MasteryState; setMastery: (v: MasteryState) => void;
  techniqueOptions: { value: number; label: string }[];
  subjectLayers: string[];
  collectionIds?: number[]; setCollectionIds?: (v: number[]) => void;
  collectionOptions?: { value: number; label: string }[];
  onCreateCollection?: () => void;
}

export function LibraryItemKindFields(p: Props) {
  if (p.kind === "theory") {
    return <MasterySliders value={p.mastery} onChange={p.setMastery} />;
  }

  return (
    <>
      {p.kind === "repertoire" && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => p.setStatus(s.key)}
                className={cn(
                  "paper-card py-2.5 text-sm font-medium transition-all",
                  p.status === s.key ? "ring-2 ring-primary" : "hover:-translate-y-0.5",
                )}
              >{s.label}</button>
            ))}
          </div>
        </div>
      )}

      {p.kind === "manual" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current exercise</Label>
            <Input
              type="number" min={1}
              value={p.currentExercise ?? ""}
              onChange={(e) => p.setCurrentExercise(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Total exercises</Label>
            <Input
              type="number" min={1}
              value={p.totalExercises ?? ""}
              onChange={(e) => p.setTotalExercises(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-card"
              placeholder="Optional"
            />
          </div>
        </div>
      )}

      {p.kind === "technique" ? (
        <>
          <BpmCoupler bpm={p.startBpm} noteVal={p.noteVal} onChange={(n) => { p.setStartBpm(n.bpm); p.setNoteVal(n.noteVal); }} label="Starting tempo" />
          <BpmCoupler bpm={p.targetBpm} noteVal={p.noteVal} onChange={(n) => { p.setTargetBpm(n.bpm); p.setNoteVal(n.noteVal); }} label="Target tempo" />
        </>
      ) : (
        <BpmCoupler bpm={p.targetBpm} noteVal={p.noteVal} onChange={(n) => { p.setTargetBpm(n.bpm); p.setNoteVal(n.noteVal); }} />
      )}

      <MultiChipPicker
        label={p.kind === "technique" ? "Techniques covered" : "Techniques"}
        options={p.techniqueOptions}
        value={p.techniqueIds}
        onChange={p.setTechniqueIds}
        emptyHint="Add techniques in Profile to associate them here."
      />

      {p.kind === "repertoire" && p.setCollectionIds && (
        <div className="space-y-2">
          <MultiChipPicker
            label="Collections"
            options={p.collectionOptions ?? []}
            value={p.collectionIds ?? []}
            onChange={p.setCollectionIds}
            emptyHint="No collections yet."
            placeholder="Add to one or more collections…"
          />
          {p.onCreateCollection && (
            <button
              type="button"
              onClick={p.onCreateCollection}
              className="text-xs text-primary hover:underline"
            >+ New collection</button>
          )}
        </div>
      )}

      {(p.kind === "repertoire" || p.kind === "manual") && (
        <SegmentsEditor
          segments={p.segments}
          onChange={p.setSegments}
          subjectLayers={p.subjectLayers}
          techniqueOptions={p.techniqueOptions}
        />
      )}
    </>
  );
}

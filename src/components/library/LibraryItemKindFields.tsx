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
import { useI18n } from "@/lib/i18n";

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

const STATUSES: PracticeStatus[] = ["in_study", "maintenance", "pause"];

export function LibraryItemKindFields(p: Props) {
  const { t } = useI18n();

  if (p.kind === "theory") {
    return <MasterySliders value={p.mastery} onChange={p.setMastery} />;
  }

  return (
    <>
      {p.kind === "repertoire" && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("library.labelStatus")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => p.setStatus(key)}
                className={cn(
                  "paper-card py-2.5 text-sm font-medium transition-all",
                  p.status === key ? "ring-2 ring-primary" : "hover:-translate-y-0.5",
                )}
              >{t(`library.status.${key}`)}</button>
            ))}
          </div>
        </div>
      )}

      {p.kind === "manual" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("library.currentExercise")}</Label>
            <Input
              type="number" min={1}
              value={p.currentExercise ?? ""}
              onChange={(e) => p.setCurrentExercise(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("library.totalExercises")}</Label>
            <Input
              type="number" min={1}
              value={p.totalExercises ?? ""}
              onChange={(e) => p.setTotalExercises(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-card"
              placeholder={t("common.optional")}
            />
          </div>
        </div>
      )}

      {p.kind === "technique" ? (
        <>
          <BpmCoupler bpm={p.startBpm} noteVal={p.noteVal} onChange={(n) => { p.setStartBpm(n.bpm); p.setNoteVal(n.noteVal); }} label={t("library.startingTempo")} />
          <BpmCoupler bpm={p.targetBpm} noteVal={p.noteVal} onChange={(n) => { p.setTargetBpm(n.bpm); p.setNoteVal(n.noteVal); }} label={t("library.targetTempo")} />
        </>
      ) : (
        <BpmCoupler bpm={p.targetBpm} noteVal={p.noteVal} onChange={(n) => { p.setTargetBpm(n.bpm); p.setNoteVal(n.noteVal); }} />
      )}

      <MultiChipPicker
        label={p.kind === "technique" ? t("library.techniquesCovered") : t("common.subject")}
        options={p.techniqueOptions}
        value={p.techniqueIds}
        onChange={p.setTechniqueIds}
        emptyHint={t("library.addTechniquesHint2")}
      />

      {p.kind === "repertoire" && p.setCollectionIds && (
        <div className="space-y-2">
          <MultiChipPicker
            label={t("library.collections")}
            options={p.collectionOptions ?? []}
            value={p.collectionIds ?? []}
            onChange={p.setCollectionIds}
            emptyHint={t("collections.empty")}
            placeholder={t("link.assignToCollections")}
          />
          {p.onCreateCollection && (
            <button
              type="button"
              onClick={p.onCreateCollection}
              className="text-xs text-primary hover:underline"
            >{t("library.newCollectionBtn")}</button>
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

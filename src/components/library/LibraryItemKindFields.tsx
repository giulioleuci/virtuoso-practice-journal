/** Kind-specific form fields for library items, extracted from NewLibraryItemSheet
 *  to keep the parent sheet focused on layout & save orchestration. */
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BpmCoupler } from "./BpmCoupler";
import { SegmentsEditor } from "./SegmentsEditor";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import type { SegmentInput } from "@/domain/entities/library";
import type { LibraryKind, NoteVal } from "@/domain/entities/common";
import { useI18n } from "@/lib/i18n";

interface Props {
  kind: LibraryKind;
  targetBpm?: number; setTargetBpm: (v?: number) => void;
  startBpm?: number; setStartBpm: (v?: number) => void;
  noteVal?: NoteVal; setNoteVal: (v?: NoteVal) => void;
  techniqueIds: number[]; setTechniqueIds: (v: number[]) => void;
  segments: SegmentInput[]; setSegments: (v: SegmentInput[]) => void;
  techniqueOptions: { value: number; label: string }[];
  subjectLayers: string[];
  collectionIds?: number[]; setCollectionIds?: (v: number[]) => void;
  collectionOptions?: { value: number; label: string }[];
  onCreateCollection?: () => void;
}

export function LibraryItemKindFields(p: Props) {
  const { t } = useI18n();

  const collectionsBlock = p.setCollectionIds && (
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
  );

  return (
    <>
      {p.kind !== "theory" && (<>      {p.kind === "technique" ? (
        <>
          <label className="grid gap-1.5 text-xs font-medium">{t("library.startingTempo")}<Input type="number" inputMode="numeric" min={20} max={400} value={p.startBpm ?? ""} onChange={e => p.setStartBpm(e.target.value === "" ? undefined : Number(e.target.value))} /></label>
          <BpmCoupler bpm={p.targetBpm} noteVal={p.noteVal} onChange={(n) => { p.setTargetBpm(n.bpm); p.setNoteVal(n.noteVal); }} label={t("library.targetTempo")} />
        </>
      ) : (
        <BpmCoupler bpm={p.targetBpm} noteVal={p.noteVal} onChange={(n) => { p.setTargetBpm(n.bpm); p.setNoteVal(n.noteVal); }} />
      )}

      <Button type="button" variant="ghost" size="sm" disabled={p.targetBpm === undefined && p.noteVal === undefined} onClick={() => { p.setTargetBpm(undefined); p.setNoteVal(undefined); }}>{t("library.clearTempo")}</Button>
      </>)}

      <MultiChipPicker
        label={t("library.techniquesCovered")}
        options={p.techniqueOptions}
        value={p.techniqueIds}
        onChange={p.setTechniqueIds}
        emptyHint={t("library.addTechniquesHint2")}
      />

      {collectionsBlock}

      <SegmentsEditor
        itemTempo={{ targetBpm: p.targetBpm, noteVal: p.noteVal }}
        segments={p.segments}
        onChange={p.setSegments}
        subjectLayers={p.subjectLayers}
        techniqueOptions={p.techniqueOptions}
      />
    </>
  );
}

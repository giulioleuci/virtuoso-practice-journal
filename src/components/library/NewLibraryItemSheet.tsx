import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type LibraryItem, type PracticeStatus } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
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
import { libraryService, collectionsService } from "@/lib/services";
import { NewCollectionSheet } from "@/components/collections/NewCollectionSheet";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LibraryKind;
  /** When provided, the sheet opens in edit mode prefilled with this item. */
  item?: LibraryItem | null;
}


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
  const { t } = useI18n();
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
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);

  const allCollections = useLiveQuery(
    () => db.collections.filter((c) => !c.deletedAt).toArray(),
    []
  );
  const existingMemberships = useLiveQuery(
    () => item?.id ? db.collectionItems.where("itemId").equals(item.id).toArray() : Promise.resolve([]),
    [item?.id]
  );
  const collectionOptions = useMemo(
    () => (allCollections ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id!, label: c.name })),
    [allCollections]
  );

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
    if (open && !isEdit) setCollectionIds([]);
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

  // Hydrate collection memberships on edit
  useEffect(() => {
    if (open && isEdit && existingMemberships) {
      setCollectionIds(existingMemberships.map((m) => m.collectionId));
    }
  }, [open, isEdit, existingMemberships]);

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
      setCollectionIds([]);
    }
  }, [open]);

  const titleLabel = useMemo(() => {
    if (isEdit) return t("library.editItem");
    switch (editingKind) {
      case "repertoire": return t("library.newPiece");
      case "manual":     return t("library.newManual");
      case "technique":  return t("library.newTechnique");
      case "theory":     return t("library.newTheoryTopic");
    }
  }, [editingKind, isEdit, t]);

  // ---- Validation ----
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!title.trim()) e.push(t("errors.titleRequired"));
    if (subjectId === undefined) e.push(t("errors.pickSubject"));

    if (!isValidBpm(targetBpm)) e.push(t("errors.bpmRange"));
    if (!isValidBpm(startBpm)) e.push(t("errors.bpmRange"));

    if (editingKind === "technique" && startBpm !== undefined && targetBpm !== undefined && startBpm > targetBpm) {
      e.push(t("errors.bpmRange"));
    }

    if (editingKind === "manual") {
      if (currentExercise === undefined || currentExercise < 1) e.push(t("errors.bpmRange"));
      if (totalExercises !== undefined && totalExercises < 1) e.push(t("errors.bpmRange"));
      if (
        currentExercise !== undefined &&
        totalExercises !== undefined &&
        currentExercise > totalExercises
      ) {
        e.push(t("errors.bpmRange"));
      }
    }

    if ((editingKind === "repertoire" || editingKind === "manual") && segments.length) {
      if (segments.some((s) => !s.label.trim())) e.push(t("errors.titleRequired"));
      if (segments.some((s) => !isValidBpm(s.targetBpm))) e.push(t("errors.bpmRange"));
    }

    return e;
  }, [title, subjectId, targetBpm, startBpm, editingKind, currentExercise, totalExercises, segments, t]);

  const canSave = errors.length === 0;

  const save = async () => {
    if (!canSave || subjectId === undefined) return;
    const now = Date.now();
    const base: LibraryItem = {
      id: item?.id,
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

    const segmentsPayload =
      (editingKind === "repertoire" || editingKind === "manual") && segments.length
        ? segments.map((s) => ({
            label: s.label.trim(),
            targetBpm: s.targetBpm,
            noteVal: s.noteVal,
            layers: s.layers ?? [],
            techniqueIds: s.techniqueIds ?? [],
          }))
        : [];

    const savedId = await libraryService.upsert(base, segmentsPayload);
    if (editingKind === "repertoire") {
      await collectionsService.setItemCollections(savedId, collectionIds);
    }
    toast.success(isEdit ? t("toast.updated") : t("toast.added"));
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
            {t("library.captureHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Subject */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("common.subject")}
            </Label>
            <Select
              value={subjectId !== undefined ? String(subjectId) : ""}
              onValueChange={(v) => setSubjectId(Number(v))}
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={t("tasks.pickSubject")} />
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
              {t("common.title")}
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(`library.placeholder.${editingKind}`)}
              className="bg-card text-lg h-12"
              autoFocus
            />
          </div>

          {/* Composer / Author */}
          {(editingKind === "repertoire" || editingKind === "manual") && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {editingKind === "manual" ? t("library.labelAuthor") : t("library.labelComposer")}
              </Label>
              <Input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder={editingKind === "manual" ? "Hanon" : "Mozart"}
                className="bg-card"
              />
            </div>
          )}

          <LibraryItemKindFields
            kind={editingKind}
            status={status} setStatus={setStatus}
            targetBpm={targetBpm} setTargetBpm={setTargetBpm}
            startBpm={startBpm} setStartBpm={setStartBpm}
            noteVal={noteVal} setNoteVal={setNoteVal}
            techniqueIds={techniqueIds} setTechniqueIds={setTechniqueIds}
            segments={segments} setSegments={setSegments}
            totalExercises={totalExercises} setTotalExercises={setTotalExercises}
            currentExercise={currentExercise} setCurrentExercise={setCurrentExercise}
            mastery={mastery} setMastery={setMastery}
            techniqueOptions={subjectTechniqueOptions}
            subjectLayers={subjectLayers}
            collectionIds={collectionIds}
            setCollectionIds={setCollectionIds}
            collectionOptions={collectionOptions}
            onCreateCollection={() => setNewCollectionOpen(true)}
          />

          {/* Validation summary */}
          {errors.length > 0 && (
            <div className="paper-card p-3 border border-destructive/30">
              <p className="text-xs uppercase tracking-wider text-destructive mb-1">
                {t("library.fixToSave")}
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
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={!canSave} className="flex-1">
              {isEdit ? t("library.saveChanges") : t("library.saveToLibrary")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      <NewCollectionSheet
        open={newCollectionOpen}
        onOpenChange={setNewCollectionOpen}
        collection={null}
        onSaved={(id) => setCollectionIds([...collectionIds, id])}
      />
    </Sheet>
  );
}

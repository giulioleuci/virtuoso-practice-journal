import { useEffect, useMemo, useRef, useState } from "react";
import { useCollectionLinksByItem, useCollections, useSegmentsByItem, useSubjects, useTechniques } from "@/presentation/hooks/useEntities";
import type { LibraryKind } from "@/domain/entities/common";
import type { LibraryItem, SegmentInput } from "@/domain/entities/library";
import { useI18n } from "@/lib/i18n";
import { getSubjectLayers, getSubjectLayerLabel } from "@/lib/domain/subjectLayers";
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
import { LIBRARY_KINDS } from "@/lib/constants";
import { libraryItemInputSchema, segmentInputSchema } from "@/lib/schemas";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelect } from "@/components/diary/WhenFields";
import { libraryService } from "@/lib/services";
import { NewCollectionSheet } from "@/components/collections/NewCollectionSheet";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LibraryKind;
  collectionId?: number;
  defaultSubjectId?: number;
  /** When provided, the sheet opens in edit mode prefilled with this item. */
  item?: LibraryItem | null;
}



export function NewLibraryItemSheet({ open, onOpenChange, kind, item, collectionId, defaultSubjectId }: Props) {
  const { t } = useI18n();
  const isEdit = !!item?.id;
  const [editingKind, setEditingKind] = useState<LibraryKind>(item?.kind ?? kind);

  const subjects = useSubjects();
  const allTechniques = useTechniques();
  const existingSegments = useSegmentsByItem(item?.id);

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [catalog, setCatalog] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  

  const [targetBpm, setTargetBpm] = useState<number | undefined>();
  const [startBpm, setStartBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<LibraryItem["noteVal"]>();

  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);
  const [segments, setSegments] = useState<SegmentInput[]>([]);

  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const hydratedSegments = useRef(false);
  const hydratedMemberships = useRef(false);

  const allCollections = useCollections();
  const existingMemberships = useCollectionLinksByItem(item?.id);
  const collectionOptions = useMemo(
    () => (allCollections ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name })),
    [allCollections]
  );

  const subjectTechniqueOptions = useMemo(
    () => (allTechniques ?? [])
      .filter((t) => t.subjectId === subjectId)
      .map((t) => ({ value: t.id, label: t.name })),
    [allTechniques, subjectId]
  );
  const layerOptions = useMemo(
    () => {
      const subject = subjects?.find((s) => s.id === subjectId);
      return getSubjectLayers(subject).map(layer => ({ value: layer, label: getSubjectLayerLabel(subject, layer, t) }));
    },
    [subjects, subjectId, t]
  );
  // Default subject when sheet opens / subjects load (create mode)
  useEffect(() => {
    if (open && !isEdit && subjects?.length && subjectId === undefined) {
      setSubjectId(defaultSubjectId ?? subjects[0].id);
    }
  }, [open, subjects, subjectId, isEdit, defaultSubjectId]);

  // Prefill on edit-open
  useEffect(() => {
    if (!open) return;
    hydratedSegments.current = false;
    hydratedMemberships.current = false;
    setEditingKind(item?.kind ?? kind);
    setSaveError(undefined);
    if (isEdit && item) {
      setSubjectId(item.subjectId);
      setTitle(item.title ?? "");
      setComposer(item.composer ?? "");
      setCatalog(item.catalog ?? "");
      setNotes(item.notes ?? "");
      
      setTargetBpm(item.targetBpm);
      setStartBpm(item.startBpm);
      setNoteVal(item.noteVal);
      setTechniqueIds(item.techniqueIds ?? []);

    }
    if (open && !isEdit) setCollectionIds(collectionId === undefined ? [] : [collectionId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, item?.id]);

  // Hydrate segments from DB on edit
  useEffect(() => {
    if (open && isEdit && existingSegments && !hydratedSegments.current) {
      hydratedSegments.current = true;
      setSegments(
        existingSegments.map((s) => ({
          id: s.id,
          position: s.position,
          barStart: s.barStart,
          barEnd: s.barEnd,
          notes: s.notes,
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
    if (open && isEdit && existingMemberships && !hydratedMemberships.current) {
      hydratedMemberships.current = true;
      setCollectionIds(existingMemberships.map((m) => m.collectionId));
    }
  }, [open, isEdit, existingMemberships]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setTitle("");
      setComposer("");
      setCatalog("");
      setNotes("");
      setSaveError(undefined);
      
      setTargetBpm(undefined);
      setStartBpm(undefined);
      setNoteVal(undefined);
      setTechniqueIds([]);
      setSegments([]);
      setSubjectId(undefined);
      setCollectionIds([]);
    }
  }, [open]);

  const titleLabel = isEdit ? t("library.editItem") : t("library.add");
  const errors = useMemo(() => {
    const result: string[] = [];
    const parsed = libraryItemInputSchema.safeParse({ subjectId, kind: editingKind, title, composer, catalog, notes, startBpm, targetBpm, noteVal, techniqueIds });
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      result.push(t(field === "title" ? "errors.titleRequired" : field === "subjectId" ? "errors.pickSubject" : field === "targetBpm" && (targetBpm === undefined || noteVal === undefined) ? "library.error.tempoPair" : "library.error.fields"));
    }
    if (segments.some(s => !segmentInputSchema.safeParse(s).success)) result.push(t("segments.invalid"));
    return [...new Set(result)];
  }, [subjectId, editingKind, title, composer, catalog, notes, startBpm, targetBpm, noteVal, techniqueIds, segments, t]);
  const loading = isEdit && (existingSegments === undefined || existingMemberships === undefined);
  const canSave = errors.length === 0 && !saving && !loading;

  const save = async () => {
    if (!canSave || subjectId === undefined) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await libraryService.upsert({
        ...item, subjectId, kind: editingKind, title: title.trim(), composer: composer.trim() || undefined,
        catalog: catalog.trim() || undefined, notes: notes.trim() || undefined,
        targetBpm, startBpm, noteVal, techniqueIds, createdAt: item?.createdAt ?? Date.now(),
      }, segments, collectionIds);
      toast.success(isEdit ? t("toast.updated") : t("toast.added"));
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error && error.message.startsWith("library.error.") ? t(error.message) : t("errors.couldNotSave"));
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92dvh] rounded-t-3xl bg-background p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <SheetTitle className="font-serif text-3xl">{titleLabel}</SheetTitle>
          <SheetDescription className="italic">
            {t("library.captureHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          <label className="grid gap-1.5 text-xs font-medium">{t("library.materialType")}
            <Select value={editingKind} onValueChange={(value) => setEditingKind(value as LibraryKind)} ><SelectTrigger aria-label={t("library.materialType")} className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>{LIBRARY_KINDS.map(k => <SelectItem key={k.key} value={String(k.key)}>{t(k.tKey)}</SelectItem>)}</SelectContent></Select>
          </label>
          {/* Subject */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">
              {t("common.subject")}
            </Label>
            <Select
              value={subjectId !== undefined ? String(subjectId) : ""}
              onValueChange={(v) => setSubjectId(Number(v))}
            >
              <SelectTrigger aria-label={t("common.subject")} className="bg-card">
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
            <Label className="text-xs font-medium text-foreground">
              {t("common.title")}
            </Label>
            <Input
              aria-label={t("common.title")}
              aria-invalid={!title.trim()}
              aria-describedby={!title.trim() ? "library-title-error" : undefined}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(`library.placeholder.${editingKind}`)}
              className="bg-card text-lg h-12"
              autoFocus
            />
            {!title.trim() && <p id="library-title-error" className="text-xs text-muted-foreground">{t("errors.titleRequired")}</p>}
          </div>

          <details className="space-y-3">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t("library.optionalDetails")}</summary>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium">{t("library.authorComposer")}<Input maxLength={120} value={composer} onChange={e => setComposer(e.target.value)} /></label>
            <label className="grid gap-1.5 text-xs font-medium">{t("library.catalog")}<Input maxLength={60} value={catalog} onChange={e => setCatalog(e.target.value)} /></label>
          </div>
          <label className="grid gap-1.5 text-xs font-medium">{t("library.stableNotes")}<Textarea rows={2} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
          </details>

          <LibraryItemKindFields
            kind={editingKind}
            
            targetBpm={targetBpm} setTargetBpm={setTargetBpm}
            startBpm={startBpm} setStartBpm={setStartBpm}
            noteVal={noteVal} setNoteVal={setNoteVal}
            techniqueIds={techniqueIds} setTechniqueIds={setTechniqueIds}
            segments={segments} setSegments={setSegments}
            techniqueOptions={subjectTechniqueOptions}
            layerOptions={layerOptions}
            collectionIds={collectionIds}
            setCollectionIds={setCollectionIds}
            collectionOptions={collectionOptions}
            onCreateCollection={() => setNewCollectionOpen(true)}
          />

          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        </div>

        <SheetFooter className="shrink-0 flex-col gap-2 px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-border bg-background sm:flex-col sm:space-x-0">
          {errors.length > 0 && <p id="library-save-errors" aria-live="polite" className="text-xs text-muted-foreground">{errors.join(" · ")}</p>}
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={!canSave} aria-describedby={errors.length ? "library-save-errors" : undefined} className="flex-1 whitespace-normal">
              {isEdit ? t("collections.saveChanges") : t("library.saveToLibrary")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      <NewCollectionSheet
        open={newCollectionOpen}
        onOpenChange={setNewCollectionOpen}
        collection={null}
        kind="collection"
        onSaved={(id) => setCollectionIds([...collectionIds, id])}
      />
    </Sheet>
  );
}

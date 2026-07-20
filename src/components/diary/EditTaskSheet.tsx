import { useEffect, useMemo, useState } from "react";
import { useSubjects, useTechniques } from "@/presentation/hooks/useEntities";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { LibraryKind, NoteVal } from "@/domain/entities/common";
import type { Task, TaskRecurrence, TaskLinkType } from "@/domain/entities/task";
import { getSubjectLayers } from "@/lib/domain/subjectLayers";
import { useI18n } from "@/lib/i18n";
import { collectionsService, tasksService } from "@/lib/services";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { LinkTargetFields } from "./LinkTargetFields";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
}

export function EditTaskSheet({ open, onOpenChange, task }: Props) {
  const { t } = useI18n();
  const subjects = useSubjects();
  const allTechniques = useTechniques();

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [linkType, setLinkType] = useState<TaskLinkType>("free");
  const [itemId, setItemId] = useState<number | undefined>();
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();
  const [layers, setLayers] = useState<string[]>([]);
  const [techniqueIds, setTechniqueIds] = useState<number[]>([]);
  const [executionNotes, setExecutionNotes] = useState("");

  useEffect(() => {
    if (open && task) {
      setSubjectId(task.subjectId);
      setLinkType(task.linkType ?? (task.collectionId ? "collection" : task.itemId ? "item" : "free"));
      setItemId(task.itemId);
      setSegmentIds(task.segmentIds ?? []);
      setCollectionId(task.collectionId);
      setTitle(task.title);
      setDate(task.date);
      setBpm(task.targetBpm);
      setNoteVal(task.noteVal);
      setLayers(task.layers ?? []);
      setTechniqueIds(task.techniqueIds ?? []);
      setExecutionNotes(task.executionNotes ?? "");
    }
  }, [open, task]);

  const selectedSubject = useMemo(
    () => subjects?.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );
  const isTheorySubject = selectedSubject?.type === "theory";
  const subjectLayers = useMemo(
    () => getSubjectLayers(selectedSubject),
    [selectedSubject],
  );
  const techniqueOptions = useMemo(
    () => (allTechniques ?? [])
      .filter((tech) => tech.subjectId === subjectId)
      .map((tech) => ({ value: tech.id, label: tech.name })),
    [allTechniques, subjectId]
  );

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push(t("errors.pickSubject"));
    if (!title.trim()) e.push(t("errors.titleRequired"));
    if (!date) e.push(t("errors.dateRequired"));
    if (linkType === "item" && !itemId) e.push(t("errors.pickItem"));
    if (linkType === "collection" && !collectionId) e.push(t("errors.pickCollection"));
    if (bpm !== undefined && (bpm < 20 || bpm > 400)) e.push(t("errors.bpmRange"));
    return e;
  }, [subjectId, title, date, bpm, linkType, itemId, collectionId, t]);

  const save = async () => {
    if (!task?.id || errors.length || subjectId === undefined) return;
    await tasksService.update(task.id, {
      subjectId,
      linkType,
      itemId: linkType === "item" ? itemId : undefined,
      segmentIds: linkType === "item" ? segmentIds : undefined,
      collectionId: linkType === "collection" ? collectionId : undefined,
      title: title.trim(), date, targetBpm: bpm, noteVal,
      layers: isTheorySubject ? [...THEORY_LAYERS] : layers,
      techniqueIds,
      executionNotes: executionNotes.trim() || undefined,
    });
    toast.success(t("toast.taskUpdated"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("tasks.editTask")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.subject")}</Label>
            <Select
              value={subjectId?.toString() ?? ""}
              onValueChange={(v) => { setSubjectId(Number(v)); setItemId(undefined); setSegmentIds([]); setCollectionId(undefined); }}
            >
              <SelectTrigger><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <LinkTargetFields
            subjectId={subjectId}
            linkType={linkType}
            setLinkType={setLinkType}
            itemId={itemId}
            setItemId={setItemId}
            segmentIds={segmentIds}
            setSegmentIds={setSegmentIds}
            collectionId={collectionId}
            setCollectionId={setCollectionId}
          />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <BpmCoupler bpm={bpm} noteVal={noteVal} onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }} />

          {!isTheorySubject && (
            <MultiChipPicker
              label={t("tasks.layers")}
              options={subjectLayers.map((l) => ({ value: l, label: l }))}
              value={layers}
              onChange={setLayers}
              emptyHint={t("tasks.defineLayersHint")}
            />
          )}
          <MultiChipPicker
            label={t("tasks.techniques")}
            options={techniqueOptions}
            value={techniqueIds}
            onChange={setTechniqueIds}
            emptyHint={t("tasks.addTechniquesHint")}
          />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("tasks.executionNotes")}</Label>
            <Textarea
              value={executionNotes}
              onChange={(e) => setExecutionNotes(e.target.value)}
              placeholder={t("tasks.executionNotesPlaceholder")}
              rows={3}
            />
          </div>

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>{t("common.save")}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type EditableTaskRecurrence = TaskRecurrence;

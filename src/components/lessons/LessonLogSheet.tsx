import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Lesson, type LessonRecurrence } from "@/lib/db"; // db used for useLiveQuery reads only
import { lessonsService } from "@/lib/services";
import { today } from "@/lib/recurrence";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

export interface LessonLogContext {
  recurrence?: LessonRecurrence | null;
  subjectId?: number;
  lesson?: Lesson | null;
  prefilledDate?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  context?: LessonLogContext;
}

export function LessonLogSheet({ open, onOpenChange, context }: Props) {
  const { recurrence, subjectId, lesson, prefilledDate } = context || {};
  const { t } = useI18n();
  const isEdit = !!lesson?.id;
  const subjId = lesson?.subjectId ?? recurrence?.subjectId ?? subjectId;

  const existingAssignments = useLiveQuery(
    () => (lesson?.id ? db.assignments.where("lessonId").equals(lesson.id).toArray() : Promise.resolve([])),
    [lesson?.id]
  );

  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [assignments, setAssignments] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  

  useEffect(() => {
    if (!open) return;
    setDate(lesson?.date ?? prefilledDate ?? today());
    setNotes(lesson?.notes ?? "");
    setAssignments(existingAssignments?.map((a) => a.text) ?? []);
    setDraft("");
  }, [open, lesson, existingAssignments]);


  const addAssignment = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setAssignments((a) => [...a, trimmed]);
    setDraft("");
  };

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjId) e.push(t("errors.noSubjectLinked"));
    if (!date) e.push(t("errors.dateRequired"));
    return e;
  }, [subjId, date, t]);

  const save = async () => {
    if (errors.length) return;
    if (isEdit && lesson?.id) {
      await lessonsService.updateLesson(lesson, date, notes, assignments);
    } else {
      await lessonsService.log(subjId!, recurrence, date, notes, assignments);
    }
    toast.success(isEdit ? t("toast.lessonUpdated") : t("toast.lessonLogged"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">
            {isEdit ? t("lesson.edit") : t("lesson.log")}
          </SheetTitle>
          {recurrence && <p className="text-sm text-muted-foreground italic">{t("lesson.with", { teacher: recurrence.teacher })}</p>}
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("lesson.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("lesson.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder={t("lesson.notesPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("lesson.assignments")}</Label>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAssignment(); } }}
                placeholder={t("lesson.assignmentPlaceholder")}
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
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              {isEdit ? t("common.save") : t("lesson.log")}
            </Button>
          </div>
        </div>
      </SheetContent>
      
    </Sheet>
  );
}

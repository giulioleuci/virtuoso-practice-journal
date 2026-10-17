import { useEffect, useMemo, useState } from "react";
import { useLessons } from "@/presentation/hooks/useEntities";
import type { Lesson, LessonRecurrence } from "@/domain/entities/lesson";
import { lessonsService } from "@/lib/services";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/** Date and notes of a lesson; homework lives on the lesson box and the assignments page. */
export function LessonLogSheet({ open, onOpenChange, context }: Props) {
  const { recurrence, subjectId, lesson: given, prefilledDate } = context || {};
  const { t } = useI18n();
  const lessons = useLessons();
  // A lesson already exists for that slot and day once homework was added to it.
  const lesson = given ?? (recurrence && prefilledDate ? lessons?.find((l) => l.recurrenceId === recurrence.id && l.date === prefilledDate) : undefined);
  const isEdit = !!lesson?.id;
  const subjId = lesson?.subjectId ?? recurrence?.subjectId ?? subjectId;

  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(lesson?.date ?? prefilledDate ?? today());
    setNotes(lesson?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson?.id, prefilledDate]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjId) e.push(t("errors.noSubjectLinked"));
    if (!date) e.push(t("errors.dateRequired"));
    return e;
  }, [subjId, date, t]);

  const save = async () => {
    if (errors.length) return;
    if (lesson?.id) await lessonsService.updateLesson(lesson, date, notes);
    else if (subjId !== undefined) await lessonsService.log(subjId, recurrence, date, notes);
    toast.success(isEdit ? t("toast.lessonUpdated") : t("toast.lessonLogged"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{isEdit ? t("lesson.edit") : t("lesson.log")}</SheetTitle>
          {recurrence && <p className="text-sm text-muted-foreground italic">{t("lesson.with", { teacher: recurrence.teacher })}</p>}
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("common.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("lesson.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={t("lesson.notesPlaceholder")} />
          </div>

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>{isEdit ? t("common.save") : t("lesson.log")}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Lesson, type LessonRecurrence } from "@/lib/db"; // db used for useLiveQuery reads only
import { lessonsService, pendingAssignmentsService } from "@/lib/services";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Plus, X, Check, Inbox, Pencil } from "lucide-react";
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

interface AssignmentDraft {
  text: string;
  /** If set, this row came from pendingAssignments and must be consumed on save. */
  pendingId?: number;
}

export function LessonLogSheet({ open, onOpenChange, context }: Props) {
  const { recurrence, subjectId, lesson, prefilledDate } = context || {};
  const { t } = useI18n();
  const isEdit = !!lesson?.id;
  const subjId = lesson?.subjectId ?? recurrence?.subjectId ?? subjectId;
  const recId = lesson?.recurrenceId ?? recurrence?.id;

  const existingAssignments = useLiveQuery(
    () => (lesson?.id ? db.assignments.where("lessonId").equals(lesson.id).toArray() : Promise.resolve([])),
    [lesson?.id]
  );

  /** Live pending drafts scoped to this subject (any recurrence, or matching one). */
  const pendingLive = useLiveQuery(async () => {
    if (!subjId) return [];
    const rows = await db.pendingAssignments.where("subjectId").equals(subjId).toArray();
    return rows.filter((r) => !recId || r.recurrenceId == null || r.recurrenceId === recId);
  }, [subjId, recId]);

  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [draft, setDraft] = useState("");
  /** Pending IDs the user explicitly dismissed while the sheet is open — don't re-add. */
  const [dismissedPendingIds, setDismissedPendingIds] = useState<Set<number>>(new Set());

  // Seed local state on open
  useEffect(() => {
    if (!open) return;
    setDate(lesson?.date ?? prefilledDate ?? today());
    setNotes(lesson?.notes ?? "");
    setAssignments((existingAssignments ?? []).map((a) => ({ text: a.text })));
    setDraft("");
    setDismissedPendingIds(new Set());
  }, [open, lesson, existingAssignments, prefilledDate]);

  // Merge any newly-appearing pending drafts into the local list (react to async additions).
  useEffect(() => {
    if (!open || !pendingLive) return;
    setAssignments((cur) => {
      const knownPendingIds = new Set(cur.filter((a) => a.pendingId != null).map((a) => a.pendingId!));
      const toAppend: AssignmentDraft[] = [];
      for (const p of pendingLive) {
        if (p.id == null) continue;
        if (knownPendingIds.has(p.id) || dismissedPendingIds.has(p.id)) continue;
        toAppend.push({ text: p.text, pendingId: p.id });
      }
      return toAppend.length ? [...cur, ...toAppend] : cur;
    });
  }, [pendingLive, open, dismissedPendingIds]);

  const addAssignment = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setAssignments((a) => [...a, { text: trimmed }]);
    setDraft("");
  };

  const removeAssignment = (idx: number) => {
    setAssignments((arr) => {
      const removed = arr[idx];
      if (removed?.pendingId != null) {
        setDismissedPendingIds((s) => new Set(s).add(removed.pendingId!));
      }
      return arr.filter((_, j) => j !== idx);
    });
  };

  const pendingCount = assignments.filter((a) => a.pendingId != null).length;

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjId) e.push(t("errors.noSubjectLinked"));
    if (!date) e.push(t("errors.dateRequired"));
    return e;
  }, [subjId, date, t]);

  const save = async () => {
    if (errors.length) return;
    const texts = assignments.map((a) => a.text);
    const consumedIds = assignments.map((a) => a.pendingId).filter((n): n is number => n != null);
    if (isEdit && lesson?.id) {
      await lessonsService.updateLesson(lesson, date, notes, texts);
    } else if (subjId !== undefined) {
      await lessonsService.log(subjId, recurrence, date, notes, texts);
    }
    if (consumedIds.length) await pendingAssignmentsService.removeMany(consumedIds);
    toast.success(isEdit ? t("toast.lessonUpdated") : t("toast.lessonLogged"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
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
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("lesson.assignments")}</Label>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
                  <Inbox className="h-3 w-3" />
                  {t("homework.pendingMerged", { count: pendingCount })}
                </span>
              )}
            </div>
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
                    {a.pendingId != null ? (
                      <Inbox className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                    {editingIdx === i ? (
                      <Input
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                        }}
                        onBlur={commitEdit}
                        className="h-8 flex-1"
                      />
                    ) : (
                      <span className="flex-1 break-words">{a.text}</span>
                    )}
                    <button
                      onClick={() => startEdit(i)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeAssignment(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("common.remove")}
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

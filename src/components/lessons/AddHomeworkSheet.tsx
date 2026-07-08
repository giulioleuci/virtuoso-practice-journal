import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSubjects, useRecurrences } from "@/hooks/useEntities";
import { pendingAssignmentsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Optional prefill of subject + recurrence (e.g. from a "Log lesson" context). */
  defaultSubjectId?: number;
  defaultRecurrenceId?: number;
}

/**
 * Small sheet to capture homework asynchronously during a lesson.
 * Drafts are stored in `pendingAssignments`; they get merged into the
 * LessonLogSheet the next time the user opens (or is already viewing) it.
 */
export function AddHomeworkSheet({ open, onOpenChange, defaultSubjectId, defaultRecurrenceId }: Props) {
  const { t } = useI18n();
  const subjects = useSubjects();
  const recurrences = useRecurrences();

  const [subjectId, setSubjectId] = useState<number | undefined>(defaultSubjectId);
  const [recurrenceId, setRecurrenceId] = useState<number | undefined>(defaultRecurrenceId);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubjectId(defaultSubjectId);
    setRecurrenceId(defaultRecurrenceId);
    setDraft("");
  }, [open, defaultSubjectId, defaultRecurrenceId]);

  const eligibleRecurrences = useMemo(
    () => (recurrences ?? []).filter((r) => !subjectId || r.subjectId === subjectId),
    [recurrences, subjectId],
  );

  const currentPending = useLiveQuery(
    () => (subjectId ? db.pendingAssignments.where("subjectId").equals(subjectId).toArray() : Promise.resolve([])),
    [subjectId],
  );

  const add = async () => {
    if (!subjectId || !draft.trim()) return;
    await pendingAssignmentsService.add(subjectId, draft, recurrenceId);
    setDraft("");
    toast.success(t("toast.homeworkAdded"));
  };

  const subjectName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("homework.title")}</SheetTitle>
          <p className="text-sm text-muted-foreground">{t("homework.subtitle")}</p>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("homework.subject")}</Label>
            <Select
              value={subjectId?.toString() ?? ""}
              onValueChange={(v) => { setSubjectId(v ? Number(v) : undefined); setRecurrenceId(undefined); }}
            >
              <SelectTrigger><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subjectId && eligibleRecurrences.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("homework.recurrence")} ({t("common.optional")})
              </Label>
              <Select
                value={recurrenceId?.toString() ?? "none"}
                onValueChange={(v) => setRecurrenceId(v === "none" ? undefined : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {eligibleRecurrences.map((r) => (
                    <SelectItem key={r.id} value={r.id!.toString()}>{r.teacher}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("homework.text")}</Label>
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("homework.textPlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }}
            />
            <Button className="w-full" onClick={add} disabled={!subjectId || !draft.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t("homework.add")}
            </Button>
          </div>

          {subjectId && !!currentPending?.length && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("homework.pendingFor", { subject: subjectName(subjectId) })}
              </Label>
              <ul className="space-y-1.5">
                {currentPending.map((p) => (
                  <li key={p.id} className="paper-card px-3 py-2 flex items-start gap-2 text-sm">
                    <span className="flex-1 break-words">{p.text}</span>
                    <button
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => p.id && pendingAssignmentsService.remove(p.id)}
                      aria-label={t("common.remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSubjects } from "@/hooks/useEntities";
import { pendingAssignmentsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Subject the lesson belongs to. Required — homework is always tied to a lesson. */
  subjectId: number;
  /** Optional recurrence id for the lesson this homework belongs to. */
  recurrenceId?: number;
  /** Optional label shown as context (e.g. teacher name + subject). */
  lessonLabel?: string;
}

/**
 * Small sheet to capture homework asynchronously during a lesson.
 * Subject/recurrence are always fixed by the caller — homework is scoped to
 * the lesson the user is currently in, never picked ad-hoc.
 */
export function AddHomeworkSheet({ open, onOpenChange, subjectId, recurrenceId, lessonLabel }: Props) {
  const { t } = useI18n();
  const subjects = useSubjects();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft("");
  }, [open]);

  const currentPending = useLiveQuery(
    () => db.pendingAssignments.where("subjectId").equals(subjectId).toArray(),
    [subjectId],
  );

  const add = async () => {
    if (!draft.trim()) return;
    await pendingAssignmentsService.add(subjectId, draft, recurrenceId);
    setDraft("");
    toast.success(t("toast.homeworkAdded"));
  };

  const subjectName = subjects?.find((s) => s.id === subjectId)?.name ?? "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("homework.title")}</SheetTitle>
          <p className="text-sm text-muted-foreground">{lessonLabel ?? subjectName}</p>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("homework.text")}</Label>
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("homework.textPlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }}
            />
            <Button className="w-full" onClick={add} disabled={!draft.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t("homework.add")}
            </Button>
          </div>

          {!!currentPending?.length && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("homework.pendingFor", { subject: subjectName })}
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

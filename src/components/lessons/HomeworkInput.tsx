import { useState } from "react";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import { lessonsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";

/** One-line capture for homework given in a lesson: Enter adds it to that day's lesson, creating the lesson on first use. */
export function HomeworkInput({ recurrence, date, className }: { recurrence: LessonRecurrence; date: string; className?: string }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try { await lessonsService.addAssignment(await lessonsService.ensureFor(recurrence.subjectId, recurrence, date), text); }
    catch { setDraft(text); toast.error(t("errors.couldNotSave")); }
  };
  return (
    <form className={className ?? "flex gap-2"} onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("homework.textPlaceholder")} aria-label={t("homework.add")} className="min-w-0 flex-1" />
      <Button type="submit" variant="outline" className="shrink-0" disabled={!draft.trim()}><Plus aria-hidden="true" />{t("common.add")}</Button>
    </form>
  );
}

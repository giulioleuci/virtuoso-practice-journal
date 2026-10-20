import { useState } from "react";
import type { Task } from "@/domain/entities/task";
import { useI18n } from "@/lib/i18n";
import { tasksService } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Archive, CalendarPlus, CheckSquare } from "lucide-react";
import { toast } from "sonner";

export function CarryoverBatchActions({ tasks, todayKey, selectedIds, onSelectionChange }: {
  tasks: Task[];
  todayKey: string;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const ids = tasks.flatMap(task => task.id === undefined ? [] : [task.id]);
  const selected = tasks.filter(task => task.id !== undefined && selectedIds.includes(task.id));
  const allSelected = ids.length > 0 && selected.length === ids.length;
  const apply = async (archive: boolean) => {
    if (busy || !selected.length) return;
    setBusy(true);
    const completed: number[] = [];
    try {
      for (const task of selected) {
        if (task.id === undefined) continue;
        if (archive) await tasksService.skip(task.id);
        else await tasksService.carryOver(task, todayKey);
        completed.push(task.id);
      }
      toast.success(t(archive ? "toast.ignored" : "toast.movedToToday"));
    } catch {
      toast.error(t("diary.batchError"));
    } finally {
      onSelectionChange(selectedIds.filter(id => !completed.includes(id)));
      setBusy(false);
    }
  };
  return (
    <div className="mb-3 space-y-2 border-y border-border py-3" aria-busy={busy}>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <Checkbox checked={allSelected ? true : selected.length ? "indeterminate" : false}
          disabled={busy} onCheckedChange={() => onSelectionChange(allSelected ? [] : ids)} />
        {t("diary.selectAll", { count: ids.length })}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="max-sm:min-h-11" disabled={busy || !selected.length} onClick={() => apply(false)}>
          <CalendarPlus className="mr-2 h-4 w-4" />{t("diary.moveSelected", { count: selected.length })}
        </Button>
        <Button size="sm" variant="outline" className="max-sm:min-h-11" disabled={busy || !selected.length} onClick={() => apply(true)}>
          <Archive className="mr-2 h-4 w-4" />{t("diary.archiveSelected")}
        </Button>
        {!!selected.length && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckSquare className="h-3 w-3" />{selected.length}</span>}
      </div>
    </div>
  );
}
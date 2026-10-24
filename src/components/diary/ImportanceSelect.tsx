import { TASK_IMPORTANCE, type TaskImportance } from "@/domain/entities/task";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Importance picker shared by the task forms and the routine group rows; an unset value shows as "medium". */
export function ImportanceSelect({ id, value, onChange, ariaLabel }: { id?: string; value?: TaskImportance; onChange: (value: TaskImportance) => void; ariaLabel?: string }) {
  const { t } = useI18n();
  return (
    <Select value={value ?? "medium"} onValueChange={(next) => onChange(next as TaskImportance)}>
      <SelectTrigger id={id} aria-label={ariaLabel}><SelectValue /></SelectTrigger>
      <SelectContent>{TASK_IMPORTANCE.map((level) => <SelectItem key={level} value={level}>{t(`importance.${level}`)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

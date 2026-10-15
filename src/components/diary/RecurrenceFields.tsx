/** Repeat / recurrence subform used by NewTaskPage. */
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { expandTaskRecurrence } from "@/lib/recurrence";
import { useI18n } from "@/lib/i18n";
import { buildRecurrence, type RecurrenceState, type EndMode } from "./recurrence-state";

interface Props {
  state: RecurrenceState;
  setState: (patch: Partial<RecurrenceState>) => void;
  nextLessonDate?: string;
}

export function RecurrenceFields({ state, setState, nextLessonDate }: Props) {
  const { t } = useI18n();
  const DAYS = [0,1,2,3,4,5,6].map((i) => t(`weekday.${i}`).slice(0, 1));
  const recurrence = useMemo(() => buildRecurrence(state, nextLessonDate), [state, nextLessonDate]);
  const previewDates = useMemo(
    () => (recurrence ? expandTaskRecurrence(recurrence).slice(0, 6) : []),
    [recurrence],
  );

  const toggleDay = (d: number) =>
    setState({
      days: state.days.includes(d) ? state.days.filter((x) => x !== d) : [...state.days, d],
    });

  return (
    <div className="paper-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{t("recurrence.repeat")}</div>
          <div className="text-xs text-muted-foreground">{t("recurrence.scheduleDesc")}</div>
        </div>
        <Switch checked={state.enabled} onCheckedChange={(v) => setState({ enabled: v })} />
      </div>

      {state.enabled && (
        <div className="space-y-3 pt-1">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("teacher.startDate")}</Label>
            <Input type="date" value={state.startDate} onChange={(e) => setState({ startDate: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("recurrence.pattern")}</Label>
            <Select value={state.kind} onValueChange={(v) => setState({ kind: v as RecurrenceState["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekdays">{t("recurrence.specificDays")}</SelectItem>
                <SelectItem value="interval">{t("recurrence.interval")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.kind === "weekdays" ? (
            <div className="flex justify-between gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "flex-1 h-9 rounded-md text-sm font-medium transition-colors",
                    state.days.includes(i)
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent/50 text-muted-foreground hover:bg-accent",
                  )}
                >{d}</button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("recurrence.every")}</span>
              <Input
                type="number" min={1} max={60}
                value={state.everyX}
                onChange={(e) => setState({ everyX: Number(e.target.value) || 1 })}
                className="w-20 tabular-nums"
              />
              <span className="text-sm text-muted-foreground">{t("recurrence.daysWord")}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("recurrence.ends")}</Label>
            <Select value={state.endMode} onValueChange={(v) => setState({ endMode: v as EndMode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="never">{t("recurrence.endSchoolYear")}</SelectItem>
                <SelectItem value="nextLesson" disabled={!nextLessonDate}>
                  {t("recurrence.untilNextLesson")}{nextLessonDate ? ` (${nextLessonDate})` : ` ${t("recurrence.untilNextLessonNone")}`}
                </SelectItem>
                <SelectItem value="date">{t("recurrence.onADate")}</SelectItem>
                <SelectItem value="count">{t("recurrence.afterNOccurrences")}</SelectItem>
              </SelectContent>
            </Select>
            {state.endMode === "date" && (
              <Input type="date" value={state.endDate} onChange={(e) => setState({ endDate: e.target.value })} />
            )}
            {state.endMode === "count" && (
              <Input
                type="number" min={1} max={200}
                value={state.occurrences}
                onChange={(e) => setState({ occurrences: Number(e.target.value) || 1 })}
                className="w-24 tabular-nums"
              />
            )}
          </div>

          {previewDates.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("recurrence.nextLabel")} {previewDates.join(", ")}
              {recurrence && expandTaskRecurrence(recurrence).length > previewDates.length && "…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

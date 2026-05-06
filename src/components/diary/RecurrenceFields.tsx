/** Repeat / recurrence subform extracted from NewTaskSheet to keep that file focused. */
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { expandTaskRecurrence, schoolYearEnd } from "@/lib/recurrence";
import type { TaskRecurrence } from "@/lib/db";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export type EndMode = "never" | "nextLesson" | "date" | "count";

export interface RecurrenceState {
  enabled: boolean;
  kind: "weekdays" | "interval";
  days: number[];
  everyX: number;
  startDate: string;
  endMode: EndMode;
  endDate: string;
  occurrences: number;
}

interface Props {
  state: RecurrenceState;
  setState: (patch: Partial<RecurrenceState>) => void;
  nextLessonDate?: string;
}

export function buildRecurrence(state: RecurrenceState, nextLessonDate?: string): TaskRecurrence | undefined {
  if (!state.enabled) return undefined;
  return {
    kind: state.kind,
    days: state.kind === "weekdays" ? [...state.days].sort() : undefined,
    everyXDays: state.kind === "interval" ? state.everyX : undefined,
    startDate: state.startDate,
    endDate:
      state.endMode === "date" && state.endDate
        ? state.endDate
        : state.endMode === "nextLesson" && nextLessonDate
        ? nextLessonDate
        : state.endMode === "never"
        ? schoolYearEnd(new Date())
        : undefined,
    occurrences: state.endMode === "count" ? state.occurrences : undefined,
  };
}

export function RecurrenceFields({ state, setState, nextLessonDate }: Props) {
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
          <div className="font-medium">Repeat</div>
          <div className="text-xs text-muted-foreground">Generate this task on a schedule</div>
        </div>
        <Switch checked={state.enabled} onCheckedChange={(v) => setState({ enabled: v })} />
      </div>

      {state.enabled && (
        <div className="space-y-3 pt-1">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start date</Label>
            <Input type="date" value={state.startDate} onChange={(e) => setState({ startDate: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pattern</Label>
            <Select value={state.kind} onValueChange={(v) => setState({ kind: v as RecurrenceState["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekdays">Specific days of week</SelectItem>
                <SelectItem value="interval">Every X days</SelectItem>
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
              <span className="text-sm text-muted-foreground">Every</span>
              <Input
                type="number" min={1} max={60}
                value={state.everyX}
                onChange={(e) => setState({ everyX: Number(e.target.value) || 1 })}
                className="w-20 tabular-nums"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ends</Label>
            <Select value={state.endMode} onValueChange={(v) => setState({ endMode: v as EndMode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="never">End of school year (Jun 30)</SelectItem>
                <SelectItem value="nextLesson" disabled={!nextLessonDate}>
                  Until next lesson{nextLessonDate ? ` (${nextLessonDate})` : " — none scheduled"}
                </SelectItem>
                <SelectItem value="date">On a date</SelectItem>
                <SelectItem value="count">After N occurrences</SelectItem>
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
              Next: {previewDates.join(", ")}
              {recurrence && expandTaskRecurrence(recurrence).length > previewDates.length && "…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

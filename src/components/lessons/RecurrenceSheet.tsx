import { useEffect, useMemo, useState } from "react";
import { useSubjects } from "@/presentation/hooks/useEntities";
import type { ColorKey } from "@/domain/entities/common";
import type { LessonRecurrence, LessonScheduleSlot, LessonFrequency } from "@/domain/entities/lesson";
import { lessonsService } from "@/lib/services";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recurrence?: LessonRecurrence | null;
}

const COLORS: ColorKey[] = ["terracotta", "sage", "gold", "blue", "plum"];

const defaultSlot = (): LessonScheduleSlot => ({
  dayOfWeek: 1,
  startTime: "17:00",
  endTime: "18:00",
  frequency: "weekly",
});

export function RecurrenceSheet({ open, onOpenChange, recurrence }: Props) {
  const { t } = useI18n();
  const DAYS = [0,1,2,3,4,5,6].map((i) => t(`weekday.${i}`));
  const subjects = useSubjects();
  const isEdit = !!recurrence?.id;

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [teacher, setTeacher] = useState("");
  const [schedules, setSchedules] = useState<LessonScheduleSlot[]>([defaultSlot()]);
  const [startDate, setStartDate] = useState(() => today());
  const [color, setColor] = useState<ColorKey>("terracotta");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setSaveError(undefined);
    if (recurrence) {
      setSubjectId(recurrence.subjectId);
      setTeacher(recurrence.teacher);
      setSchedules(recurrence.schedules?.length ? recurrence.schedules.map((s) => ({ ...s })) : [defaultSlot()]);
      setStartDate(recurrence.startDate);
      setColor(recurrence.color);
    } else {
      setSubjectId(undefined);
      setTeacher("");
      setSchedules([defaultSlot()]);
      setStartDate(today());
      setColor("terracotta");
    }
  // Hydrate once per opening, preserving edits through unrelated live refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recurrence?.id]);

  const updateSlot = (idx: number, patch: Partial<LessonScheduleSlot>) => {
    setSchedules((arr) => arr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addSlot = () => setSchedules((arr) => [...arr, defaultSlot()]);
  const removeSlot = (idx: number) =>
    setSchedules((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)));

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push(t("errors.pickSubject"));
    if (!teacher.trim()) e.push(t("errors.teacherRequired"));
    if (!startDate) e.push(t("errors.dateRequired"));
    if (!schedules.length) e.push(t("teacher.schedules"));
    for (const s of schedules) {
      if (!s.startTime || !s.endTime || s.startTime >= s.endTime) {
        e.push(t("errors.endTimeAfterStart"));
        break;
      }
    }
    return e;
  }, [subjectId, teacher, schedules, startDate, t]);

  const save = async () => {
    if (errors.length || subjectId === undefined || saving) return;
    setSaving(true);
    setSaveError(undefined);
    const base: Omit<LessonRecurrence, "id"> = {
      subjectId,
      teacher: teacher.trim(),
      schedules,
      startDate,
      color,
      createdAt: recurrence?.createdAt ?? Date.now(),
    };
    try {
      await lessonsService.upsertRecurrence(base, isEdit ? recurrence?.id : undefined);
      toast.success(isEdit ? t("toast.updated") : t("toast.added"));
      onOpenChange(false);
    } catch { setSaveError(t("errors.couldNotSave")); }
    finally { setSaving(false); }
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}
      title={isEdit ? t("teacher.edit") : t("teacher.new")}
      footer={<div className="flex w-full gap-2">
        <Button variant="outline" className="flex-1" disabled={saving} onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
        <Button className="flex-1" disabled={errors.length > 0 || saving} onClick={save}>{isEdit ? t("common.save") : t("common.add")}</Button>
      </div>}>
        <fieldset disabled={saving} className="min-w-0 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("common.subject")}</Label>
            <Select value={subjectId?.toString() ?? ""} onValueChange={(v) => setSubjectId(Number(v))}>
              <SelectTrigger aria-label={t("common.subject")}><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("teacher.teacherName")}</Label>
            <Input aria-label={t("teacher.teacherName")} value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder={t("common.name")} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">{t("teacher.schedules")}</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addSlot} className="-mr-2 min-h-11">
                <Plus className="h-4 w-4 mr-1" /> {t("teacher.addSchedule")}
              </Button>
            </div>

            <ul className="space-y-3">
              {schedules.map((slot, i) => (
                <li key={i} className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t("teacher.scheduleN", { n: i + 1 })}
                    </span>
                    {schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        aria-label={t("common.delete")}
                        className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive -mr-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">{t("teacher.day")}</Label>
                      <Select value={slot.dayOfWeek.toString()} onValueChange={(v) => updateSlot(i, { dayOfWeek: Number(v) })}>
                        <SelectTrigger aria-label={t("teacher.day")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d, k) => <SelectItem key={k} value={k.toString()}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">{t("teacher.frequency")}</Label>
                      <Select value={slot.frequency} onValueChange={(v) => updateSlot(i, { frequency: v as LessonFrequency })}>
                        <SelectTrigger aria-label={t("teacher.frequency")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">{t("teacher.freq.weekly")}</SelectItem>
                          <SelectItem value="biweekly">{t("teacher.freq.biweekly")}</SelectItem>
                          <SelectItem value="monthly">{t("teacher.freq.monthly")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">{t("teacher.start")}</Label>
                      <Input aria-label={t("teacher.start")} type="time" value={slot.startTime} onChange={(e) => updateSlot(i, { startTime: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">{t("teacher.end")}</Label>
                      <Input aria-label={t("teacher.end")} type="time" value={slot.endTime} onChange={(e) => updateSlot(i, { endTime: e.target.value })} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("teacher.startDate")}</Label>
            <Input aria-label={t("teacher.startDate")} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">{t("teacher.color")}</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-11 w-11 rounded-full border-2 transition-colors",
                    color === c ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: `hsl(var(--key-${c}))` }}
                  aria-label={t(`subjects.color.${c}`)}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>

          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </fieldset>
    </ResponsiveSheet>
  );
}

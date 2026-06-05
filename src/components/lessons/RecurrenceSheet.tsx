import { useEffect, useMemo, useState } from "react";
import { useSubjects } from "@/hooks/useEntities";
import { type ColorKey, type LessonRecurrence, type LessonScheduleSlot, type LessonFrequency } from "@/lib/db";
import { lessonsService } from "@/lib/services";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

  useEffect(() => {
    if (!open) return;
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
  }, [open, recurrence]);

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
    if (!schedules.length) e.push(t("teacher.schedules"));
    for (const s of schedules) {
      if (s.startTime >= s.endTime) {
        e.push(t("errors.endTimeAfterStart"));
        break;
      }
    }
    return e;
  }, [subjectId, teacher, schedules, t]);

  const save = async () => {
    if (errors.length || subjectId === undefined) return;
    const base: Omit<LessonRecurrence, "id"> = {
      subjectId,
      teacher: teacher.trim(),
      schedules,
      startDate,
      color,
      createdAt: recurrence?.createdAt ?? Date.now(),
    };
    await lessonsService.upsertRecurrence(base, isEdit ? recurrence?.id : undefined);
    toast.success(isEdit ? t("toast.updated") : t("toast.added"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] max-h-[90dvh] rounded-t-2xl bg-background p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="font-serif text-2xl">
            {isEdit ? t("teacher.edit") : t("teacher.new")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.subject")}</Label>
            <Select value={subjectId?.toString() ?? ""} onValueChange={(v) => setSubjectId(Number(v))}>
              <SelectTrigger><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.teacherName")}</Label>
            <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder={t("teacher.namePlaceholder")} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.schedules")}</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addSlot} className="-mr-2">
                <Plus className="h-4 w-4 mr-1" /> {t("teacher.addSchedule")}
              </Button>
            </div>

            <ul className="space-y-3">
              {schedules.map((slot, i) => (
                <li key={i} className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("teacher.scheduleN", { n: i + 1 })}
                    </span>
                    {schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        aria-label={t("common.delete")}
                        className="text-muted-foreground hover:text-destructive p-1 -mr-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("teacher.day")}</Label>
                      <Select value={slot.dayOfWeek.toString()} onValueChange={(v) => updateSlot(i, { dayOfWeek: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d, k) => <SelectItem key={k} value={k.toString()}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("teacher.frequency")}</Label>
                      <Select value={slot.frequency} onValueChange={(v) => updateSlot(i, { frequency: v as LessonFrequency })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("teacher.start")}</Label>
                      <Input type="time" value={slot.startTime} onChange={(e) => updateSlot(i, { startTime: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("teacher.end")}</Label>
                      <Input type="time" value={slot.endTime} onChange={(e) => updateSlot(i, { endTime: e.target.value })} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.startDate")}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.color")}</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-10 w-10 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: `hsl(var(--key-${c}))` }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-border bg-background/80 backdrop-blur flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
            {isEdit ? t("common.save") : t("common.add")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

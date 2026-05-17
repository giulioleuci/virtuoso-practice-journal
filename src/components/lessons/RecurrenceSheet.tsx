import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ColorKey, type LessonRecurrence } from "@/lib/db"; // db used for useLiveQuery reads only
import { lessonsService } from "@/lib/services";
import { today } from "@/lib/recurrence";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recurrence?: LessonRecurrence | null;
}

const COLORS: ColorKey[] = ["terracotta", "sage", "gold", "blue", "plum"];

export function RecurrenceSheet({ open, onOpenChange, recurrence }: Props) {
  const { t } = useI18n();
  const DAYS = [0,1,2,3,4,5,6].map((i) => t(`weekday.${i}`));
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const isEdit = !!recurrence?.id;

  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [teacher, setTeacher] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [startDate, setStartDate] = useState(() => today());
  const [color, setColor] = useState<ColorKey>("terracotta");

  useEffect(() => {
    if (!open) return;
    if (recurrence) {
      setSubjectId(recurrence.subjectId);
      setTeacher(recurrence.teacher);
      setFrequency(recurrence.frequency);
      setDayOfWeek(recurrence.dayOfWeek);
      setStartTime(recurrence.startTime);
      setEndTime(recurrence.endTime);
      setStartDate(recurrence.startDate);
      setColor(recurrence.color);
    } else {
      setSubjectId(undefined);
      setTeacher("");
      setFrequency("weekly");
      setDayOfWeek(1);
      setStartTime("17:00");
      setEndTime("18:00");
      setStartDate(today());
      setColor("terracotta");
    }
  }, [open, recurrence]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!subjectId) e.push(t("errors.pickSubject"));
    if (!teacher.trim()) e.push(t("errors.teacherRequired"));
    if (startTime >= endTime) e.push(t("errors.endTimeAfterStart"));
    return e;
  }, [subjectId, teacher, startTime, endTime, t]);

  const save = async () => {
    if (errors.length) return;
    const base: Omit<LessonRecurrence, "id"> = {
      subjectId: subjectId!,
      teacher: teacher.trim(),
      frequency,
      dayOfWeek,
      startTime,
      endTime,
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
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">
            {isEdit ? t("teacher.edit") : t("teacher.new")}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.subject")}</Label>
            <Select value={subjectId?.toString() ?? ""} onValueChange={(v) => setSubjectId(Number(v))}>
              <SelectTrigger><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.teacherName")}</Label>
            <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder={t("teacher.namePlaceholder")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.frequency")}</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t("teacher.freq.weekly")}</SelectItem>
                  <SelectItem value="biweekly">{t("teacher.freq.biweekly")}</SelectItem>
                  <SelectItem value="monthly">{t("teacher.freq.monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.day")}</Label>
              <Select value={dayOfWeek.toString()} onValueChange={(v) => setDayOfWeek(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.start")}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("teacher.end")}</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
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

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button className="flex-1" disabled={errors.length > 0} onClick={save}>
              {isEdit ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

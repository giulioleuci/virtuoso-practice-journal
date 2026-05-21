import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SessionQuality, type NoteVal } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { sessionsService } from "@/lib/services";
import { today } from "@/lib/recurrence";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StarRating } from "@/components/shared/StarRating";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { cn } from "@/lib/utils";
import { SessionIcon } from "@/lib/icons";
import { toast } from "sonner";

const QUALITY_VALS: { val: SessionQuality; symbol: string; label: string }[] = [
  { val: "hard", symbol: "♭", label: "Hard" },
  { val: "improve", symbol: "♮", label: "Improve" },
  { val: "well", symbol: "♯", label: "Well" },
  { val: "great", symbol: "✦", label: "Great" },
];

interface Props {
  className?: string;
}

export function SessionFAB({ className }: Props) {
  const { t } = useI18n();
  const todayKey = today();

  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [itemId, setItemId] = useState<number | undefined>();
  const [quality, setQuality] = useState<SessionQuality>("well");
  const [confidence, setConfidence] = useState<number | undefined>();
  const [bpm, setBpm] = useState<number | undefined>();
  const [noteVal, setNoteVal] = useState<NoteVal | undefined>();
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayKey);

  const subjects = useLiveQuery(() => db.subjects.filter((s) => !s.deletedAt).toArray(), []);
  const libraryItems = useLiveQuery(
    () => subjectId
      ? db.library.where("subjectId").equals(subjectId).filter((i) => !i.deletedAt).toArray()
      : Promise.resolve([]),
    [subjectId]
  );

  const reset = () => {
    setSubjectId(undefined);
    setItemId(undefined);
    setQuality("well");
    setConfidence(undefined);
    setBpm(undefined);
    setNoteVal(undefined);
    setNotes("");
    setDate(todayKey);
  };

  const save = async () => {
    if (!subjectId) return;

    // Find or create a free-form task for this date
    let taskId: number | undefined;

    if (itemId) {
      const item = await db.library.get(itemId);
      const existingTask = await db.tasks
        .where("itemId").equals(itemId)
        .and((t) => t.date === date && !t.deletedAt)
        .first();

      if (existingTask) {
        taskId = existingTask.id;
      } else {
        taskId = (await db.tasks.add({
          date,
          subjectId,
          linkType: "item",
          itemId,
          title: item?.title ?? t("common.unnamed"),
          done: false,
          createdAt: Date.now(),
        })) as number;
      }
    } else {
      taskId = (await db.tasks.add({
        date,
        subjectId,
        linkType: "free",
        title: t("diary.freeSession"),
        done: false,
        createdAt: Date.now(),
      })) as number;
    }

    const task = await db.tasks.get(taskId!);
    if (!task) return;

    await sessionsService.logWithCompletion(task, {
      date,
      bpmReached: bpm,
      noteVal,
      confidence,
      quality,
      notes,
      layersUsed: [],
      techniquesUsed: [],
    });

    toast.success(t("toast.sessionLogged"));
    setOpen(false);
    reset();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-24 right-4 z-40",
          "h-14 w-14 rounded-full shadow-lg",
          "bg-primary text-primary-foreground",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          className
        )}
        aria-label={t("diary.freeSession")}
      >
        <SessionIcon className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl">{t("diary.freeSession")}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 mt-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.date")}</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.subject")}</Label>
              <Select value={subjectId?.toString() ?? ""} onValueChange={(v) => { setSubjectId(Number(v)); setItemId(undefined); }}>
                <SelectTrigger><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
                <SelectContent>
                  {(subjects ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subjectId && (libraryItems?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("link.item")} ({t("common.optional")})</Label>
                <Select value={itemId?.toString() ?? ""} onValueChange={(v) => setItemId(v ? Number(v) : undefined)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {(libraryItems ?? []).map((i) => (
                      <SelectItem key={i.id} value={i.id!.toString()}>{i.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <BpmCoupler
              bpm={bpm}
              noteVal={noteVal}
              onChange={({ bpm: b, noteVal: n }) => { setBpm(b); setNoteVal(n); }}
              label={t("session.bpmReached")}
            />

            <StarRating
              label={t("session.confidenceLabel")}
              value={confidence}
              onChange={setConfidence}
            />

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("session.qualityLabel")}</Label>
              <div className="grid grid-cols-4 gap-2">
                {QUALITY_VALS.map((q) => (
                  <button
                    key={q.val}
                    type="button"
                    onClick={() => setQuality(q.val)}
                    className={cn(
                      "paper-card flex flex-col items-center py-3 transition-all",
                      quality === q.val ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
                    )}
                  >
                    <span className="text-2xl font-serif leading-none">{q.symbol}</span>
                    <span className="text-xs mt-1">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("session.notes")}</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("session.notesPlaceholder")}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1" disabled={!subjectId} onClick={save}>
                {t("session.saveSession")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

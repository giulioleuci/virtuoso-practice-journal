import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { StudyRoutineWizard } from "./StudyRoutineWizard";
import type { StudyRoutine } from "@/lib/db";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  routine: StudyRoutine | null;
}

export function EditStudyRoutineSheet({ open, onOpenChange, routine }: Props) {
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("studyRoutine.editTitle")}</SheetTitle>
        </SheetHeader>
        <div className="mt-5">
          {routine && (
            <StudyRoutineWizard
              key={routine.id}
              subjectId={routine.subjectId}
              date={today}
              initial={routine}
              onCreated={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

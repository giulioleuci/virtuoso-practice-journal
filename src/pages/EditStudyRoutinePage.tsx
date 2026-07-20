import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { db, type StudyRoutine } from "@/lib/presentationQueries";
import { useI18n } from "@/lib/i18n";
import { StudyRoutineWizard } from "@/components/diary/StudyRoutineWizard";

export default function EditStudyRoutinePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const routineId = Number(id);
  const [routine, setRoutine] = useState<StudyRoutine | null | undefined>(undefined);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = Number.isFinite(routineId) ? await db.studyRoutines.get(routineId) : undefined;
      if (!cancelled) setRoutine(r ?? null);
    })();
    return () => { cancelled = true; };
  }, [routineId]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/tasks");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="text-muted-foreground hover:text-foreground"
          aria-label={t("common.back")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="font-serif text-3xl flex-1">{t("studyRoutine.editTitle")}</h2>
      </div>

      {routine === undefined ? (
        <div className="paper-skeleton h-40 w-full" />
      ) : routine === null ? (
        <p className="paper-card p-6 text-center text-muted-foreground italic">
          {t("tasks.noTasks")}
        </p>
      ) : (
        <StudyRoutineWizard
          key={routine.id}
          subjectId={routine.subjectId}
          date={today}
          initial={routine}
          onCreated={goBack}
          onCancel={goBack}
        />
      )}
    </div>
  );
}

import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useStudyRoutine } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoutineBuilder } from "@/components/diary/RoutineBuilder";

/** Create (`/tasks/routines/new`) or edit (`/tasks/routines/edit/:id`) a study routine. */
export default function RoutinePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const routineId = id === undefined ? undefined : Number(id);
  const routine = useStudyRoutine(routineId !== undefined && Number.isFinite(routineId) ? routineId : undefined);
  const toRoutines = () => navigate("/tasks?tab=routines");

  return (
    <div className="pb-24">
      <PageHeader
        title={t(id ? "routine.editTitle" : "routine.newTitle")}

        actions={<Button asChild variant="outline"><Link to="/tasks?tab=routines"><ChevronLeft />{t("routine.back")}</Link></Button>}
      />
      {id === undefined ? (
        <RoutineBuilder onDone={toRoutines} onCancel={toRoutines} />
      ) : routine === undefined ? (
        <div className="paper-skeleton h-40 w-full" />
      ) : routine === null ? (
        <EmptyState title={t("tasks.noTasks")} />
      ) : (
        <RoutineBuilder key={routine.id} initial={routine} onDone={toRoutines} onCancel={toRoutines} />
      )}
    </div>
  );
}

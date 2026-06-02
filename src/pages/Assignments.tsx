import { useState } from "react";
import { useAssignments, useLessons, useSubjects } from "@/hooks/useEntities";
import { useNavigate } from "react-router-dom";

import { lessonsService } from "@/lib/services";
import { today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Wand2, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { subjectBorderStyle } from "@/lib/subjectColors";

const PAGE_SIZE = 5;

export default function Assignments() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const assignments = useAssignments();
  const lessons = useLessons();
  const subjects = useSubjects();

  const [page, setPage] = useState(0);

  const pending = (assignments ?? []).filter((a) => !a.transformed && !a.ignored);
  const totalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = pending.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/lessons"))}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("assignments.back")}
        </button>
        <h2 className="font-serif text-3xl">{t("assignments.title")}</h2>
        <p className="text-sm text-muted-foreground italic">
          {t("assignments.description")}
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="paper-card p-10 text-center">
          <p className="font-serif text-xl italic text-foreground/85">{t("assignments.allCaughtUp")}</p>
          <p className="text-sm text-muted-foreground italic mt-2">
            {t("assignments.noneWaiting")}
          </p>
        </div>
      ) : (
        <section className="space-y-2">
          <ul className="space-y-2">
            {slice.map((a) => {
              const lesson = lessons?.find((l) => l.id === a.lessonId);
              const subject = subjects?.find((s) => s.id === lesson?.subjectId);
              return (
                <li
                  key={a.id}
                  className="paper-card overflow-hidden border-l-4 p-0"
                  style={subjectBorderStyle(subject?.color, subject?.type, subject?.customColor)}
                >
                  {/* Body: assignment text + meta */}
                  <div className="flex items-start gap-2.5 p-3.5 pb-2">
                    <Wand2 className="h-4 w-4 text-primary shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] leading-snug break-words">{a.text}</p>
                      {lesson && (
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1.5 truncate">
                          {lesson.date}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!a.id) return;
                        await lessonsService.ignoreAssignment(a.id);
                        toast(t("toast.ignored"));
                      }}
                      className="h-9 w-9 -mr-1.5 -mt-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-accent shrink-0"
                      aria-label={t("common.ignore")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Footer: full-width primary action */}
                  <button
                    onClick={() =>
                      navigate("/tasks/new", {
                        state: {
                          date: today(),
                          prefill: { subjectId: lesson?.subjectId, title: a.text, assignmentId: a.id },
                        },
                      })
                    }
                    className="w-full h-11 inline-flex items-center justify-center gap-2 text-sm uppercase tracking-wider text-primary border-t border-border/40 bg-primary/[0.04] hover:bg-primary/10 active:bg-primary/15 transition-colors"
                  >
                    <Wand2 className="h-4 w-4" /> {t("assignments.makeTask")}
                  </button>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="ghost" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">{safePage + 1} / {totalPages}</span>
              <Button size="sm" variant="ghost" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

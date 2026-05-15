import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { today } from "@/lib/recurrence";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Wand2, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 5;

export default function Assignments() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const assignments = useLiveQuery(() => db.assignments.toArray());
  const lessons = useLiveQuery(() => db.lessons.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());

  const [page, setPage] = useState(0);

  const pending = (assignments ?? []).filter((a) => !a.transformed && !a.ignored);
  const totalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = pending.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const subjectName = (id?: number) => subjects?.find((s) => s.id === id)?.name ?? "—";

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
              return (
                <li key={a.id} className="paper-card p-4 flex gap-3">
                  <Wand2 className="h-4 w-4 text-primary shrink-0 mt-1" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm break-words">{a.text}</p>
                    {lesson && (
                      <p className="text-xs text-muted-foreground">
                        {subjectName(lesson.subjectId)} · {lesson.date}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate("/tasks/new", {
                            state: {
                              date: today(),
                              prefill: { subjectId: lesson?.subjectId, title: a.text, assignmentId: a.id },
                            },
                          })
                        }
                      >
                        {t("assignments.makeTask")}
                      </Button>
                      <button
                        onClick={async () => {
                          if (!a.id) return;
                          await db.assignments.update(a.id, { ignored: true });
                          toast(t("toast.ignored"));
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent ml-auto"
                        aria-label={t("common.ignore")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
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

import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useAllLibrary, useAllTasks, useAssignments, useLessons, useProfile, useSessionsInRange, useSubjects } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { addDays, dayKey, endOfWeek, formatDate, startOfWeek } from "@/lib/date";
import { NOTE_GLYPH } from "@/lib/constants";

/** Print-optimised one-page weekly summary for the teacher (Save as PDF via the print dialog). */
export default function PrintSummary() {
  const { t, lang } = useI18n();
  const profile = useProfile();
  const [searchParams] = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const subjectId = subjectParam ? Number(subjectParam) : undefined;
  const subjects = useSubjects();
  const subjectName = subjects?.find((s) => s.id === subjectId)?.name;

  const now = new Date();
  const from = dayKey(startOfWeek(now));
  const to = dayKey(endOfWeek(now));

  const sessions = useSessionsInRange(from, to);
  const tasks = useAllTasks();
  const items = useAllLibrary();
  const lessons = useLessons();
  const assignments = useAssignments();

  const taskById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks]);
  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  const list = useMemo(() => {
    const all = sessions ?? [];
    if (subjectId === undefined) return all;
    return all.filter((session) => taskById.get(session.taskId)?.subjectId === subjectId);
  }, [sessions, subjectId, taskById]);
  const practiceDays = new Set(list.map((session) => session.date)).size;

  const pieces = useMemo(() => {
    const map = new Map<string, { title: string; composer?: string; count: number; topBpm: number; noteVal?: string }>();
    for (const session of list) {
      const task = taskById.get(session.taskId);
      const item = task?.itemId !== undefined ? itemById.get(task.itemId) : undefined;
      const title = item?.title ?? task?.title ?? t("history.untitled");
      const key = title;
      const current = map.get(key) ?? { title, composer: item?.composer, count: 0, topBpm: 0, noteVal: session.noteVal };
      current.count += 1;
      if ((session.bpmReached ?? 0) > current.topBpm) {
        current.topBpm = session.bpmReached ?? 0;
        current.noteVal = session.noteVal;
      }
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [list, taskById, itemById, t]);

  const weekLessonIds = useMemo(
    () => new Set((lessons ?? []).filter((lesson) => lesson.date >= from && lesson.date <= to).map((lesson) => lesson.id)),
    [lessons, from, to],
  );
  const weekAssignments = useMemo(
    () =>
      (assignments ?? []).filter((assignment) => {
        if (!weekLessonIds.has(assignment.lessonId) || assignment.ignored) return false;
        if (subjectId === undefined) return true;
        return (lessons ?? []).find((lesson) => lesson.id === assignment.lessonId)?.subjectId === subjectId;
      }),
    [assignments, weekLessonIds, subjectId, lessons],
  );

  const notes = useMemo(
    () => list.filter((session) => session.notes?.trim()).slice(0, 8),
    [list],
  );

  return (
    <div className="print-summary min-h-screen bg-background text-foreground px-5 py-6 max-w-3xl mx-auto">
      <div className="no-print flex items-center justify-between mb-5">
        <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 min-h-[44px] text-sm font-medium"
        >
          <Printer className="h-4 w-4" /> {t("print.print")}
        </button>
      </div>

      <header className="border-b border-border pb-3 mb-4">
        <h1 className="font-serif text-3xl leading-tight">{t("print.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(from, lang, "medium")} – {formatDate(to, lang, "medium")}
          {profile?.name ? ` · ${profile.name}` : ""}
          {subjectName ? ` · ${subjectName}` : ""}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("print.sessions")}</p>
          <p className="text-xl tabular-nums">{list.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("print.practiceDays")}</p>
          <p className="text-xl tabular-nums">{practiceDays} / 7</p>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="font-serif text-xl mb-2">{t("print.pieces")}</h2>
        {pieces.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("print.noPieces")}</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <tbody>
              {pieces.map((piece) => (
                <tr key={piece.title} className="border-b border-border/60 align-top">
                  <td className="py-1.5 pr-2">
                    <span className="break-words">{piece.title}</span>
                    {piece.composer && <span className="text-muted-foreground italic"> · {piece.composer}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                    {piece.topBpm ? `${piece.noteVal ? NOTE_GLYPH[piece.noteVal as keyof typeof NOTE_GLYPH] : "♩"}=${piece.topBpm}` : "—"}
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                    {t("history.sessions", { count: piece.count })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-5">
        <h2 className="font-serif text-xl mb-2">{t("print.assignments")}</h2>
        {weekAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("print.noAssignments")}</p>
        ) : (
          <ul className="space-y-1 text-sm list-disc pl-5">
            {weekAssignments.map((assignment) => (
              <li key={assignment.id} className="break-words">{assignment.text}</li>
            ))}
          </ul>
        )}
      </section>

      {notes.length > 0 && (
        <section>
          <h2 className="font-serif text-xl mb-2">{t("print.notes")}</h2>
          <ul className="space-y-1.5 text-sm">
            {notes.map((session) => (
              <li key={session.id} className="break-words">
                <span className="tabular-nums text-muted-foreground">{formatDate(session.date, lang, "dayMonth")} — </span>
                {session.notes}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-6 pt-3 border-t border-border text-[11px] text-muted-foreground">
        {t("print.generated").replace("{date}", formatDate(dayKey(addDays(now, 0)), lang, "medium"))}
      </footer>
    </div>
  );
}

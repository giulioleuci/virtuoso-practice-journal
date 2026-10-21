import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useAllLibrary, useAssignments, useLessons, useProfile, useSessionsInRange, useSubjects } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { addDays, dayKey, endOfWeek, formatDate, getDefaultWeekStartsOn, startOfWeek } from "@/lib/date";
import { tempoLabel } from "@/lib/format";
import type { NoteVal } from "@/domain/entities/common";
import { PageSkeleton } from "@/components/shared/Loading";
import { StateNotice } from "@/components/shared/StateNotice";
import { topMark } from "@/domain/logic/sessionMetrics";

/** Print-optimised weekly summary for the teacher (Save as PDF via the print dialog). */
export default function PrintSummary() {
  const { t, lang } = useI18n();
  const profile = useProfile();
  const [searchParams] = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const subjectId = subjectParam ? Number(subjectParam) : undefined;
  const subjects = useSubjects();
  const subjectName = subjects?.find((s) => s.id === subjectId)?.name;

  const now = new Date();
  const weekStart = profile?.weekStartsOn ?? getDefaultWeekStartsOn(lang);
  const from = dayKey(startOfWeek(now, weekStart));
  const to = dayKey(endOfWeek(now, weekStart));

  const sessions = useSessionsInRange(from, to);
  const items = useAllLibrary();
  const lessons = useLessons();
  const assignments = useAssignments();

  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  const list = useMemo(() => {
    const all = sessions ?? [];
    if (subjectId === undefined) return all;
    return all.filter((session) => session.subjectId === subjectId);
  }, [sessions, subjectId]);
  const practiceDays = new Set(list.map((session) => session.date)).size;

  const pieces = useMemo(() => {
    const map = new Map<string, { key: string; title: string; composer?: string; count: number; topBpm: number; noteVal?: NoteVal }>();
    for (const session of list) {
      const item = session.itemId !== undefined ? itemById.get(session.itemId) : undefined;
      const title = item?.title ?? session.snapshot?.itemTitle ?? session.snapshot?.taskTitle ?? t("history.untitled");
      const key = session.itemId !== undefined ? `item:${session.itemId}` : session.taskId !== undefined ? `task:${session.taskId}` : `free:${session.subjectId}:${title}`;
      const top = topMark(session.marks);
      const current = map.get(key) ?? { key, title, composer: item?.composer ?? session.snapshot?.itemComposer, count: 0, topBpm: 0, noteVal: top?.noteVal };
      current.count += 1;
      if ((top?.bpm ?? 0) > current.topBpm) {
        current.topBpm = top?.bpm ?? 0;
        current.noteVal = top?.noteVal;
      }
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [list, itemById, t]);

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

  if ([profile, subjects, sessions, items, lessons, assignments].some(value => value === undefined)) return <PageSkeleton />;
  if (subjectParam !== null && !subjectName) return <div className="space-y-4">
    <h1 className="font-serif text-3xl">{t("print.title")}</h1>
    <StateNotice action={<Link className="inline-flex min-h-11 items-center text-primary hover:underline" to="/print/weekly">{t("library.allSubjects")}</Link>}>{t("subjects.notFound")}</StateNotice>
  </div>;

  return (
    <div className="print-summary min-h-screen bg-background text-foreground px-5 py-6 [overflow-wrap:anywhere] max-w-3xl mx-auto">
      <div className="no-print flex items-center justify-between gap-3 mb-5">
        <Link to="/history" className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground min-h-[44px]">
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.sessions")}</p>
          <p className="text-xl tabular-nums">{list.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.practiceDays")}</p>
          <p className="text-xl tabular-nums">{practiceDays} / 7</p>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="font-serif text-xl mb-2">{t("print.pieces")}</h2>
        {pieces.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("print.noPieces")}</p>
        ) : (
          <table className="w-full table-fixed text-sm border-collapse">
            <colgroup><col className="w-[48%]" /><col className="w-[24%]" /><col className="w-[28%]" /></colgroup>
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th scope="col" className="py-2">{t("progress.item")}</th><th scope="col" className="py-2 text-right">{t("progress.bpm")}</th><th scope="col" className="py-2 pl-3 text-right">{t("print.sessions")}</th></tr></thead>
            <tbody>
              {pieces.map((piece) => (
                <tr key={piece.key} className="border-b border-border/60 align-top">
                  <td className="py-1.5 pr-2">
                    <span className="break-words">{piece.title}</span>
                    {piece.composer && <span className="text-muted-foreground italic"> · {piece.composer}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {piece.topBpm ? tempoLabel(piece.noteVal, piece.topBpm) : "—"}
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">
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

      <footer className="mt-6 pt-3 border-t border-border text-xs text-muted-foreground">
        {t("print.generated").replace("{date}", formatDate(dayKey(addDays(now, 0)), lang, "medium"))}
      </footer>
    </div>
  );
}

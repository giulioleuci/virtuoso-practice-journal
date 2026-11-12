import { compareTempos, convertTempo } from "@/domain/logic/tempo";
import type { Tempo } from "@/domain/entities/common";
import { Fragment, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useLibrary, useAssignments, useLessons, useProfile, useSegments, useSessionsInRange, useSubjects } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { addDays, dayKey, endOfWeek, formatDate, getDefaultWeekStartsOn, parseDayKey, startOfWeek } from "@/lib/date";
import { tempoLabel } from "@/lib/format";
import type { NoteVal } from "@/domain/entities/common";
import { PageSkeleton } from "@/components/shared/Loading";
import { Switch } from "@/components/ui/switch";
import { StateNotice } from "@/components/shared/StateNotice";
import { isAndroid, printHtml } from "@/lib/platform";
import { topMark } from "@/domain/logic/sessionMetrics";

/** Print-optimised weekly summary for the teacher (Save as PDF via the print dialog). */
export default function PrintSummary() {
  const { t, lang } = useI18n();
  const pageRef = useRef<HTMLDivElement>(null);
  const profile = useProfile();
  const [searchParams] = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const subjectId = subjectParam ? Number(subjectParam) : undefined;
  const subjects = useSubjects();
  const subjectName = subjects?.find((s) => s.id === subjectId)?.name;

  const now = new Date();
  const weekStart = profile?.weekStartsOn ?? getDefaultWeekStartsOn(lang);
  const lessons = useLessons();
  const [sinceLesson, setSinceLesson] = useState(true);
  // Day after the last past lesson (of the subject, if filtered) up to today; no such lesson: the calendar week.
  const lastLesson = (lessons ?? []).filter((l) => l.date < dayKey(now) && (subjectId === undefined || l.subjectId === subjectId)).reduce<string | undefined>((max, l) => (!max || l.date > max ? l.date : max), undefined);
  const lessonRange = sinceLesson && lastLesson ? lastLesson : undefined;
  const from = lessonRange ? dayKey(addDays(parseDayKey(lessonRange), 1)) : dayKey(startOfWeek(now, weekStart));
  const to = lessonRange ? dayKey(now) : dayKey(endOfWeek(now, weekStart));
  const rangeDays = Math.round((parseDayKey(to).getTime() - parseDayKey(from).getTime()) / 864e5) + 1;

  const sessions = useSessionsInRange(from, to);
  // Previous week: the seven days before the summary range, for the +BPM comparison.
  const prevSessions = useSessionsInRange(dayKey(addDays(parseDayKey(from), -7)), dayKey(addDays(parseDayKey(from), -1)));
  const segments = useSegments();
  const items = useLibrary();
  const assignments = useAssignments();

  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  const list = useMemo(() => {
    const all = sessions ?? [];
    if (subjectId === undefined) return all;
    return all.filter((session) => session.subjectId === subjectId);
  }, [sessions, subjectId]);
  const practiceDays = new Set(list.map((session) => session.date)).size;

  const pieces = useMemo(() => {
    const keyOf = (session: (typeof list)[number], title: string) =>
      session.itemId !== undefined ? `item:${session.itemId}` : session.taskId !== undefined ? `task:${session.taskId}` : `free:${session.subjectId}:${title}`;
    const better = (m: { bpm?: number; noteVal?: NoteVal }, best?: Tempo): best is Tempo =>
      m.bpm !== undefined && m.noteVal !== undefined && (!best || compareTempos({ bpm: m.bpm, noteVal: m.noteVal }, best) > 0);
    // Previous-week max per piece and per section.
    const prevMax = new Map<string, Tempo>();
    for (const session of prevSessions ?? []) {
      if (subjectId !== undefined && session.subjectId !== subjectId) continue;
      const key = keyOf(session, session.snapshot?.itemTitle ?? session.snapshot?.taskTitle ?? "");
      for (const m of session.marks) {
        if (m.bpm === undefined || !m.noteVal) continue;
        const tempo = { bpm: m.bpm, noteVal: m.noteVal };
        for (const k of [key, m.segmentId !== undefined ? `${key}#${m.segmentId}` : undefined]) {
          if (k && (!prevMax.has(k) || compareTempos(tempo, prevMax.get(k)!) > 0)) prevMax.set(k, tempo);
        }
      }
    }
    const segName = new Map((segments ?? []).map((seg) => [seg.id, seg.label]));
    type Frag = { id: number; name: string; count: number; top?: Tempo; target?: NoteVal; delta?: number };
    type Piece = { key: string; title: string; composer?: string; count: number; topBpm: number; noteVal?: NoteVal; target?: NoteVal; fragments: Map<number, Frag> };
    const map = new Map<string, Piece>();
    for (const session of list) {
      const item = session.itemId !== undefined ? itemById.get(session.itemId) : undefined;
      const title = item?.title ?? session.snapshot?.itemTitle ?? session.snapshot?.taskTitle ?? t("history.untitled");
      const key = keyOf(session, title);
      const top = topMark(session.marks);
      const current: Piece = map.get(key) ?? { key, title, composer: item?.composer ?? session.snapshot?.itemComposer, count: 0, topBpm: 0, noteVal: top?.noteVal, fragments: new Map() };
      current.count += 1;
      if (top && better(top, current.noteVal ? { bpm: current.topBpm, noteVal: current.noteVal } : undefined)) {
        current.topBpm = top.bpm ?? 0;
        current.noteVal = top.noteVal;
      }
      current.target ??= top?.targetNoteVal;
      const seen = new Set<number>();
      for (const m of session.marks) {
        if (m.segmentId === undefined) continue;
        const frag = current.fragments.get(m.segmentId) ?? { id: m.segmentId, name: segName.get(m.segmentId) ?? t("history.untitled"), count: 0 };
        if (!seen.has(m.segmentId)) { frag.count += 1; seen.add(m.segmentId); }
        if (better(m, frag.top)) frag.top = { bpm: m.bpm!, noteVal: m.noteVal! };
        frag.target ??= m.targetNoteVal;
        current.fragments.set(m.segmentId, frag);
      }
      map.set(key, current);
    }
    // Delta vs previous week's max, expressed in the target note value (falls back to the reached one).
    const delta = (cur: Tempo | undefined, prev: Tempo | undefined, target?: NoteVal) => {
      if (!cur || !prev) return undefined;
      const unit = target ?? cur.noteVal;
      return Math.round(convertTempo(cur, unit) - convertTempo(prev, unit));
    };
    return Array.from(map.values()).sort((a, b) => b.count - a.count).map((piece) => ({
      ...piece,
      delta: delta(piece.noteVal ? { bpm: piece.topBpm, noteVal: piece.noteVal } : undefined, prevMax.get(piece.key), piece.target),
      fragmentList: Array.from(piece.fragments.values()).map((f) => ({ ...f, delta: delta(f.top, prevMax.get(`${piece.key}#${f.id}`), f.target) })),
    }));
  }, [list, prevSessions, segments, subjectId, itemById, t]);

  const weekLessonIds = useMemo(
    () => new Set((lessons ?? []).filter((lesson) => lesson.date >= (lessonRange ?? from) && lesson.date <= to).map((lesson) => lesson.id)),
    [lessons, from, to, lessonRange],
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

  // Android WebView ignores window.print(): ship the page plus the stylesheet rules as one standalone document.
  const print = () => {
    if (!isAndroid() || !pageRef.current) return window.print();
    const css = Array.from(document.styleSheets).map((sheet) => { try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join(""); } catch { return ""; } }).join("");
    const html = `<!doctype html><html class="${document.documentElement.className}"><head><meta charset="utf-8"><style>${css}</style></head><body>${pageRef.current.outerHTML}</body></html>`;
    void printHtml(html, t("print.title")).catch(() => window.print());
  };

  return (
    <div ref={pageRef} className="print-summary min-h-screen bg-background text-foreground px-5 py-6 [overflow-wrap:anywhere] max-w-3xl mx-auto">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Link to="/history" className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
        <button
          type="button"
          onClick={print}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 min-h-[44px] text-sm font-medium sm:order-3 sm:w-auto"
        >
          <Printer className="h-4 w-4" /> {t("print.print")}
        </button>
        <label className="flex min-h-[44px] w-full items-center gap-3 border-t border-border text-sm sm:w-auto sm:border-t-0">
          <Switch checked={sinceLesson} onCheckedChange={setSinceLesson} /> {t("print.sinceLesson")}
        </label>
      </div>

      <header className="border-b border-border pb-3 mb-4">
        <h1 className="font-serif text-3xl leading-tight text-balance">{t("print.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground font-numeric">
          {formatDate(from, lang, "medium")} – {formatDate(to, lang, "medium")}
        </p>
        {(profile?.name || subjectName) && (
          <p className="text-sm text-muted-foreground">{[profile?.name, subjectName].filter(Boolean).join(" · ")}</p>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.sessions")}</p>
          <p className="text-xl tabular-nums">{list.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("print.practiceDays")}</p>
          <p className="text-xl tabular-nums">{practiceDays} / {rangeDays}</p>
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
                <Fragment key={piece.key}>
                <tr className="border-b border-border/60 align-top">
                  <td className="py-1.5 pr-2">
                    <span className="break-words">{piece.title}</span>
                    {piece.composer && <span className="text-muted-foreground italic"> · {piece.composer}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {piece.topBpm ? tempoLabel(piece.noteVal, piece.topBpm) : "—"}
                    <BpmDelta value={piece.delta} />
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">
                    {t("history.sessions", { count: piece.count })}
                  </td>
                </tr>
                {piece.fragmentList.map((frag) => (
                  <tr key={`${piece.key}#${frag.id}`} className="border-b border-border/40 align-top text-xs">
                    <td className="py-1 pl-4 pr-2 text-muted-foreground"><span className="break-words">↳ {frag.name}</span></td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">
                      {frag.top ? tempoLabel(frag.top.noteVal, frag.top.bpm) : "—"}
                      <BpmDelta value={frag.delta} />
                    </td>
                    <td className="py-1 pl-3 text-right tabular-nums text-muted-foreground">{t("history.sessions", { count: frag.count })}</td>
                  </tr>
                ))}
                </Fragment>
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

/** Change of the weekly max tempo vs the previous week's max; hidden when either week has no tempo. */
function BpmDelta({ value }: { value?: number }) {
  const { t } = useI18n();
  if (value === undefined) return null;
  const text = value > 0 ? `+${value}` : `${value}`;
  return <span className="block text-[0.7rem] text-foreground/70" title={t("print.bpmDeltaHint")}>{t("print.bpmDelta", { value: text })}</span>;
}

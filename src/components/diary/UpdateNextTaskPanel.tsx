import { compareTempos } from "@/domain/logic/tempo";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { tempoOwner } from "@/domain/logic/tempoProgression";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Session } from "@/domain/entities/session";
import { carryMarksToPlan, entryFor, followUpTasks, tempoProposal } from "@/domain/logic/plan";
import { formatDate } from "@/lib/date";
import { tempoLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { tasksService } from "@/lib/services";
import { useActiveTasks } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/** Opt-in carry of a session's musical results to the next matching task, previewed per section; nothing changes before "Apply". */
export function UpdateNextTaskPanel({ session }: { session: Session }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const tasks = useActiveTasks();
  const routines = usePresentationRead<import("@/domain/ports/studyRoutine").StudyRoutine[]>("routines.active");
  const [picked, setPicked] = useState<(number | undefined)[] | null>(null);
  const [extras, setExtras] = useState(false);
  const next = useMemo(() => followUpTasks(
    { id: session.taskId, date: session.date, subjectId: session.subjectId ?? -1, title: session.snapshot?.taskTitle ?? "", itemId: session.itemId, collectionId: session.collectionId },
    session.marks,
    tasks ?? [],
  )[0], [session, tasks]);
  if (tasks === undefined) return null;

  const heading = <h2 id="next-task" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("nextTask.title")}</h2>;
  if (!next) {
    const segmentIds = session.marks.flatMap((m) => (m.segmentId === undefined ? [] : [m.segmentId]));
    return (
      <section aria-labelledby="next-task" className="space-y-2">
        {heading}
        <p className="text-sm text-muted-foreground">{t("nextTask.none")}</p>
        <Button size="sm" variant="outline" className="max-sm:min-h-11" onClick={() => navigate("/tasks/new", { state: { prefill: { subjectId: session.subjectId, itemId: session.itemId, collectionId: session.collectionId, title: session.snapshot?.taskTitle, segmentIds } } })}>
          {t("nextTask.create")}
        </Button>
      </section>
    );
  }

  // Pre-select only real progress: a faster tempo in the same figure. A slower or re-figured result stays opt-in.
  const faster = (id: number | undefined) => {
    const e = next.plan.find((x) => x.segmentId === id); const m = entryFor(session.marks, id);
    return !!e?.bpm && !!e.noteVal && !!m?.bpm && !!m.noteVal && compareTempos({ bpm: m.bpm,noteVal: m.noteVal },{ bpm: e.bpm,noteVal: e.noteVal }) > 0;
  };
  const owner = tempoOwner(next);
  const rule = owner?.kind === "routine" ? routines?.find(r => r.id === owner.id)?.tempoRule : owner ? tasks.find(t => t.id === owner.id)?.tempoRule : undefined;
  const managed = (_id: number | undefined) => !!rule?.enabled;
  const tempo = new Set((picked ?? tempoProposal(next.plan, session.marks).filter(id => !managed(id) && faster(id))).filter(id => !managed(id)));
  const labels = new Map((session.snapshot?.segments ?? []).map((s) => [Number(s.id), s.label]));
  const rows = next.plan.flatMap((e) => { const m = entryFor(session.marks, e.segmentId); return m ? [{ e, m }] : []; });
  const toggle = (segmentId: number | undefined, on: boolean) => setPicked([...tempo].filter((id) => id !== segmentId).concat(on ? [segmentId] : []));
  const apply = async () => {
    const before = { plan: next.plan, customized: next.customized };
    await tasksService.update(next.id!, { plan: carryMarksToPlan(next.plan, session.marks, { tempo, extras }), ...(next.studyRoutineId !== undefined ? { customized: true } : {}) });
    toast.success(t("nextTask.applied"), { action: { label: t("common.undo"), onClick: () => void tasksService.update(next.id!, before) } });
  };

  return (
    <section aria-labelledby="next-task" className="space-y-3">
      {heading}
      <p className="text-sm font-medium">{next.title} · {formatDate(next.date, lang, "medium")}</p>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map(({ e, m }) => (
          <li key={e.segmentId ?? "whole"} className="space-y-1 py-3 text-sm">
            {e.segmentId !== undefined && <div className="font-medium">{labels.get(e.segmentId) ?? "—"}</div>}
            <div className="tabular-nums text-muted-foreground">
              {t("nextTask.planned")}: {e.bpm ? tempoLabel(e.noteVal, e.bpm) : "—"} · {t("nextTask.reached")}: {m.bpm ? tempoLabel(m.noteVal, m.bpm) : "—"}
            </div>
            {m.bpm && !managed(e.segmentId) ? (
              <label className="flex min-h-11 items-center gap-2"><Checkbox checked={tempo.has(e.segmentId)} onCheckedChange={(on) => toggle(e.segmentId, on === true)} />{t("nextTask.useAsTarget")}</label>
            ) : (
              <p className="text-xs text-muted-foreground">{t(managed(e.segmentId) ? "tempo.title" : "nextTask.noTempo")}</p>
            )}
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={extras} onCheckedChange={(on) => setExtras(on === true)} />{t("nextTask.extras")}</label>
      <Button size="sm" className="max-sm:min-h-11" disabled={!tempo.size && !extras} onClick={() => void apply()}>{t("nextTask.apply")}</Button>
    </section>
  );
}

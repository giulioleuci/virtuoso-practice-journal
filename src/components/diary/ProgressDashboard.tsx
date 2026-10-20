import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import type { Subject } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";

import { weeklyProgress, type ProgressWeek } from "@/domain/logic/progress";
import { useI18n } from "@/lib/i18n";
import { ChartData } from "@/components/shared/ChartData";
import { formatDate, dayKey } from "@/lib/date";
import { FilterPanel, FilterSelect } from "@/components/shared/FilterPanel";

const WEEK_OPTIONS = [4, 12, 26] as const;

export interface ProgressFilterLabels { subject?: string; item?: string; segment?: string; weeks: number }

export function ProgressDashboard({ from, to, onFiltersChange }: { from?: string; to?: string; onFiltersChange?: (f: ProgressFilterLabels) => void }) {
  const { t } = useI18n();
  const sessions = usePresentationRead<Session[]>("sessions.all");
  const tasks = usePresentationRead<Task[]>("tasks.all");
  const subjects = usePresentationRead<Subject[]>("subjects.active");
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [weeks, setWeeks] = useState<number>(12);
  const library = usePresentationRead<LibraryItem[]>("library.active");
  const segments = usePresentationRead<Segment[]>("segments.active");
  const [itemId, setItemId] = useState<number | undefined>();
  const [segmentId, setSegmentId] = useState<number | undefined>();
  const items = useMemo(() => (library ?? []).filter((i) => subjectId == null || i.subjectId === subjectId).sort((a, b) => a.title.localeCompare(b.title)), [library, subjectId]);
  const itemSegments = useMemo(() => (segments ?? []).filter((x) => itemId != null && x.itemId === itemId), [segments, itemId]);
  useEffect(() => {
    onFiltersChange?.({
      subject: subjects?.find((x) => x.id === subjectId)?.name,
      item: library?.find((x) => x.id === itemId)?.title,
      segment: segments?.find((x) => x.id === segmentId)?.label,
      weeks,
    });
  }, [onFiltersChange, subjects, library, segments, subjectId, itemId, segmentId, weeks]);
  const pickSubject = (id?: number) => { setSubjectId(id); setItemId(undefined); setSegmentId(undefined); };

  const data = useMemo(
    () =>
      weeklyProgress(sessions ?? [], (tasks ?? []).map((x) => ({ id: x.id, subjectId: x.subjectId, itemId: x.itemId, plan: x.plan })), { subjectId, itemId, segmentId, from, to }, weeks, to || dayKey(new Date()))
        .map((w) => ({ ...w, label: w.weekKey.slice(5) })),
    [sessions, tasks, subjectId, itemId, segmentId, from, to, weeks],
  );

  if ([sessions, tasks, subjects, library, segments].some(value => value === undefined)) return <div className="paper-skeleton h-40" />;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-serif text-2xl">{t("progress.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("progress.subtitle")}</p>
      </div>
      <FilterPanel filters={[
        ...(subjectId != null ? [{ key: "subject", label: `${t("common.subject")}: ${subjects?.find(s => s.id === subjectId)?.name ?? subjectId}`, onRemove: () => pickSubject(undefined) }] : []),
        ...(itemId != null ? [{ key: "item", label: library?.find(i => i.id === itemId)?.title ?? String(itemId), onRemove: () => { setItemId(undefined); setSegmentId(undefined); } }] : []),
        ...(segmentId != null ? [{ key: "segment", label: segments?.find(s => s.id === segmentId)?.label ?? String(segmentId), onRemove: () => setSegmentId(undefined) }] : []),
        ...(weeks !== 12 ? [{ key: "weeks", label: t("progress.weeks", { count: weeks }), onRemove: () => setWeeks(12) }] : []),
      ]} onReset={() => { pickSubject(undefined); setWeeks(12); }}>
        <FilterSelect label={t("common.subject")} value={subjectId == null ? "all" : String(subjectId)} onChange={value => pickSubject(value === "all" ? undefined : Number(value))} options={[{ value: "all", label: t("library.allSubjects") }, ...(subjects ?? []).map(s => ({ value: String(s.id), label: s.name }))]} />
        <FilterSelect label={t("progress.item")} value={itemId == null ? "all" : String(itemId)} onChange={value => { setItemId(value === "all" ? undefined : Number(value)); setSegmentId(undefined); }} options={[{ value: "all", label: t("progress.allItems") }, ...items.map(i => ({ value: String(i.id), label: i.title }))]} />
        {itemId != null && itemSegments.length > 0 && <FilterSelect label={t("progress.segment")} value={segmentId == null ? "all" : String(segmentId)} onChange={value => setSegmentId(value === "all" ? undefined : Number(value))} options={[{ value: "all", label: t("progress.allSegments") }, ...itemSegments.map(s => ({ value: String(s.id), label: s.label }))]} />}
        <FilterSelect label={t("analytics.pdfWeeks")} value={String(weeks)} onChange={value => setWeeks(Number(value))} options={WEEK_OPTIONS.map(n => ({ value: String(n), label: t("progress.weeks", { count: n }) }))} />
      </FilterPanel>
      <ChartCard title={t("progress.confidence")} data={data} dataKey="confidence" kind="line" domain={[1, 5]} />
      <ChartCard title={t("progress.mood")} data={data} dataKey="mood" kind="line" domain={[1, 5]} />
      <ChartCard title={t("progress.focus")} data={data} dataKey="focus" kind="line" domain={[1, 5]} />
      <p className="text-xs italic text-muted-foreground">{t("progress.contextHint")}</p>
      <ChartCard title={t("progress.consistency")} data={data} dataKey="activeDays" kind="bar" domain={[0, 7]} />
      <ChartCard title={t("progress.goals")} data={data} dataKey="goalRate" kind="line" domain={[0, 100]} unit="%" />
      {itemId != null ? (
        <ChartCard title={t("progress.bpm")} data={data} dataKey="bpm" kind="line" />
      ) : (
        <p className="text-xs text-muted-foreground italic text-center">{t("progress.bpmHint")}</p>
      )}
    </section>
  );
}

type Row = ProgressWeek & { label: string };

function ChartCard({ title, data, dataKey, kind, domain, unit }: { title: string; data: Row[]; dataKey: keyof ProgressWeek; kind: "line" | "bar"; domain?: [number, number]; unit?: string }) {
  const { t, lang } = useI18n();
  const values = data.map((d) => d[dataKey]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const latest = values.at(-1);
  const axis = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="font-serif text-xl tabular-nums">{latest != null ? `${latest}${unit ?? ""}` : "—"}</div>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-6 text-center">{t("progress.noData")}</p>
      ) : (
        <div className="h-36" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "line" ? (
              <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
                <YAxis tick={axis} domain={domain ?? ["auto", "auto"]} allowDecimals={false} />
                <Line type="monotone" dataKey={dataKey} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
                <YAxis tick={axis} domain={domain} allowDecimals={false} />
                <Bar dataKey={dataKey} fill="hsl(var(--primary) / 0.7)" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <ChartData label={title} valueLabel={`${title}${unit ? ` (${unit})` : ""}`} points={data.map(row => { const value = row[dataKey]; return { label: formatDate(row.weekKey, lang, "medium"), y: typeof value === "number" ? value : null }; })} />
    </div>
  );
}

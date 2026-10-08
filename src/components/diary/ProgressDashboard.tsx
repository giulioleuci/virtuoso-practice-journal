import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import type { Subject } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { weeklyProgress, type ProgressWeek } from "@/domain/logic/progress";
import { useI18n } from "@/lib/i18n";
import { dayKey } from "@/lib/date";
import { cn } from "@/lib/utils";

const WEEK_OPTIONS = [4, 12, 26] as const;

export function ProgressDashboard({ from, to }: { from?: string; to?: string }) {
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
  const pickSubject = (id?: number) => { setSubjectId(id); setItemId(undefined); setSegmentId(undefined); };

  const data = useMemo(
    () =>
      weeklyProgress(sessions ?? [], (tasks ?? []).map((x) => ({ id: x.id, subjectId: x.subjectId, itemId: x.itemId, targetBpm: x.targetBpm })), { subjectId, itemId, segmentId, from, to }, weeks, to || dayKey(new Date()))
        .map((w) => ({ ...w, label: w.weekKey.slice(5) })),
    [sessions, tasks, subjectId, itemId, segmentId, from, to, weeks],
  );

  const chip = (active: boolean) =>
    cn("min-h-9 px-3 rounded-full text-xs border whitespace-nowrap transition-colors", active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-serif text-2xl">{t("progress.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("progress.subtitle")}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button className={chip(subjectId == null)} onClick={() => pickSubject(undefined)}>{t("common.all")}</button>
        {(subjects ?? []).map((s) => (
          <button key={s.id} className={chip(subjectId === s.id)} onClick={() => pickSubject(s.id)}>{s.name}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={itemId != null ? String(itemId) : "all"} onValueChange={(v) => { setItemId(v === "all" ? undefined : Number(v)); setSegmentId(undefined); }}>
          <SelectTrigger aria-label={t("progress.item")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("progress.allItems")}</SelectItem>
            {items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {itemId != null && itemSegments.length > 0 && (
          <Select value={segmentId != null ? String(segmentId) : "all"} onValueChange={(v) => setSegmentId(v === "all" ? undefined : Number(v))}>
            <SelectTrigger aria-label={t("progress.segment")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("progress.allSegments")}</SelectItem>
              {itemSegments.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex gap-2">
        {WEEK_OPTIONS.map((n) => (
          <button key={n} className={chip(weeks === n)} onClick={() => setWeeks(n)}>{t("progress.weeks", { count: n })}</button>
        ))}
      </div>
      <ChartCard title={t("progress.quality")} data={data} dataKey="quality" kind="line" domain={[1, 4]} />
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
  const { t } = useI18n();
  const values = data.map((d) => d[dataKey]).filter((v): v is number => typeof v === "number" && v > 0);
  const latest = values.at(-1);
  const axis = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
  return (
    <div className="paper-card p-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="font-serif text-xl tabular-nums">{latest != null ? `${latest}${unit ?? ""}` : "—"}</div>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-6 text-center">{t("progress.noData")}</p>
      ) : (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "line" ? (
              <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
                <YAxis tick={axis} domain={domain ?? ["auto", "auto"]} allowDecimals={false} />
                <Line type="monotone" dataKey={dataKey} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
                <YAxis tick={axis} domain={domain} allowDecimals={false} />
                <Bar dataKey={dataKey} fill="hsl(var(--primary) / 0.7)" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

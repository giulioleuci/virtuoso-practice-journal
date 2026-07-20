import { useMemo } from "react";
import { useSegmentsByItem, useTasksByItem, useTechniques } from "@/presentation/hooks/useEntities";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { Lang, TheoryLayer } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { Activity } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: LibraryItem;
}

/** Tracks sessions for a library item (and per-segment) and shows latest values + sparklines. */
export function ItemAnalysisSheet({ open, onOpenChange, item }: Props) {
  const { t, lang } = useI18n();

  const tasks = useTasksByItem(item.id);
  const sessions = usePresentationRead<Session[]>("sessions.segmentHistory", [item.id]);
  const segments = useSegmentsByItem(item.id);
  const techniques = useTechniques();

  const tasksById = useMemo(() => {
    const m = new Map<number, Task>();
    (tasks ?? []).forEach((tk) => tk.id && m.set(tk.id, tk));
    return m;
  }, [tasks]);

  /** Sessions whose task targets the given segmentId. */
  const sessionsForSegment = (segId: number): Session[] =>
    (sessions ?? []).filter((s) => {
      const tk = tasksById.get(s.taskId);
      return tk?.segmentIds?.includes(segId);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-2xl flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {t("library.analysis.title")}
          </SheetTitle>
          <SheetDescription className="italic truncate">{item.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <AnalysisBlock
            label={t("library.analysis.overall")}
            sessions={sessions ?? []}
            kind={item.kind}
            techniques={techniques ?? []}
            lang={lang}
            t={t}
          />

          {(segments ?? []).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("library.analysis.bySegment")}
              </h3>
              <div className="space-y-3">
                {(segments ?? []).map((seg: Segment) => (
                  <AnalysisBlock
                    key={seg.id}
                    label={seg.label}
                    sessions={sessionsForSegment(seg.id)}
                    kind={item.kind}
                    techniques={techniques ?? []}
                    lang={lang}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface BlockProps {
  label: string;
  sessions: Session[];
  kind: LibraryItem["kind"];
  techniques: { id?: number; name: string }[];
  lang: Lang;
  t: (k: string, p?: Record<string, string | number>) => string;
}

function AnalysisBlock({ label, sessions, kind, techniques, lang, t }: BlockProps) {
  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [sessions]
  );

  const latest = <K extends keyof Session>(key: K) =>
    sorted.find((s) => s[key] != null);

  const latestBpm = latest("bpmReached");
  const latestConfidence = latest("confidence");

  const layerLatest = (layer: TheoryLayer) =>
    sorted.find((s) => s.layerScores?.[layer] != null);
  const usedLayers = THEORY_LAYERS.filter((l) => layerLatest(l));

  const techniqueIds = useMemo(() => {
    const ids = new Set<number>();
    sessions.forEach((s) => {
      if (s.techniqueScores) Object.keys(s.techniqueScores).forEach((id) => ids.add(Number(id)));
    });
    return Array.from(ids);
  }, [sessions]);
  const techLatest = (id: number) =>
    sorted.find((s) => s.techniqueScores?.[id] != null);

  const hasAny =
    latestBpm || latestConfidence || usedLayers.length > 0 || techniqueIds.length > 0;

  const fmt = (iso: string) => formatDate(iso, lang, "dayMonth");

  return (
    <div className="paper-card p-4 space-y-3">
      <div className="font-serif text-lg leading-tight">{label}</div>

      {!hasAny && (
        <p className="text-xs italic text-muted-foreground">{t("library.analysis.noData")}</p>
      )}

      {latestBpm && (
        <Row
          name={t("library.analysis.bpm")}
          latest={`${latestBpm.bpmReached}`}
          date={fmt(latestBpm.date)}
          points={extractPoints(sessions, (s) => s.bpmReached ?? null)}
          unit=" BPM"
        />
      )}

      {latestConfidence && (
        <Row
          name={t("library.analysis.confidence")}
          latest={`${latestConfidence.confidence}/5`}
          date={fmt(latestConfidence.date)}
          points={extractPoints(sessions, (s) => s.confidence ?? null)}
          max={5}
        />
      )}

      {usedLayers.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("library.analysis.layers")}
          </div>
          {usedLayers.map((layer) => {
            const last = layerLatest(layer);
            const score = last?.layerScores?.[layer];
            if (!last || score == null) return null;
            return (
              <Row
                key={layer}
                name={t(`library.mastery.${layer}`)}
                latest={`${score}/100`}
                date={fmt(last.date)}
                points={extractPoints(sessions, (s) => s.layerScores?.[layer] ?? null)}
                max={100}
              />
            );
          })}
        </div>
      )}

      {techniqueIds.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("library.analysis.techniques")}
          </div>
          {techniqueIds.map((id) => {
            const last = techLatest(id);
            const score = last?.techniqueScores?.[id];
            const name = techniques.find((tk) => tk.id === id)?.name ?? `#${id}`;
            if (!last || score == null) return null;
            return (
              <Row
                key={id}
                name={name}
                latest={`${score}/100`}
                date={fmt(last.date)}
                points={extractPoints(sessions, (s) => s.techniqueScores?.[id] ?? null)}
                max={100}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Pt { date: string; v: number }

function extractPoints(sessions: Session[], pick: (s: Session) => number | null): Pt[] {
  return sessions
    .map((s) => {
      const v = pick(s);
      return v == null ? null : { date: s.date, v };
    })
    .filter((p): p is Pt => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface RowProps {
  name: string;
  latest: string;
  date: string;
  points: Pt[];
  max?: number;
  unit?: string;
}

function Row({ name, latest, date, points, max, unit = "" }: RowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{name}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">{date}</div>
      </div>
      <Sparkline points={points} max={max} />
      <div className="text-sm font-serif tabular-nums text-primary whitespace-nowrap min-w-[3.5rem] text-right">
        {latest}{unit}
      </div>
    </div>
  );
}

function Sparkline({ points, max }: { points: Pt[]; max?: number }) {
  const w = 64, h = 22;
  if (points.length === 0) return <div style={{ width: w, height: h }} />;
  const values = points.map((p) => p.v);
  const lo = max != null ? 0 : Math.min(...values);
  const hi = max ?? Math.max(...values);
  const range = Math.max(1, hi - lo);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const path = points
    .map((p, i) => {
      const y = h - ((p.v - lo) / range) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-16 shrink-0" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

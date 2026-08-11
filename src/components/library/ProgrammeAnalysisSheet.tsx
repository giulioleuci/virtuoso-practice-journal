import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { PerformanceEvent } from "@/domain/entities/performance";
import type { Session } from "@/domain/entities/session";
import type { ReadinessBreakdown } from "@/domain/logic/readiness";
import { useI18n } from "@/lib/i18n";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Progress } from "@/components/ui/progress";
import { PieceDrilldownSheet } from "./PieceDrilldownSheet";

export interface ProgrammeEntry {
  item: LibraryItem;
  readiness: ReadinessBreakdown;
  sessions: Session[];
  segments: Segment[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PerformanceEvent | null;
  entries: ProgrammeEntry[];
}


const shorten = (value: string, max = 18) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** Read-only analysis of a performance programme: readiness comparison plus per-piece breakdown. */
export function ProgrammeAnalysisSheet({ open, onOpenChange, event, entries }: Props) {
  const { t } = useI18n();
  const [drilldown, setDrilldown] = useState<ProgrammeEntry | null>(null);



  const bars = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => a.readiness.overall - b.readiness.overall)
        .map((entry) => ({ name: shorten(entry.item.title), value: entry.readiness.overall })),
    [entries],
  );

  const overall = entries.length
    ? Math.round(entries.reduce((sum, entry) => sum + entry.readiness.overall, 0) / entries.length)
    : 0;

  const barColor = (value: number) =>
    value >= 75 ? "hsl(var(--primary))" : value >= 45 ? "hsl(var(--muted-foreground))" : "hsl(var(--destructive))";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("performances.analysis")}
      description={event?.name}
      className="sm:max-w-lg"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("performances.analysisEmpty")}</p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("performances.readiness")}</span>
              <span className="tabular-nums font-medium text-foreground">{overall}%</span>
            </div>
            <Progress value={overall} className="h-2" />
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium">{t("performances.analysisCompare")}</h4>
            <div style={{ height: Math.max(140, bars.length * 42) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} layout="vertical" margin={{ left: 4, right: 28, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} label={{ position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `${v}%` }}>
                    {bars.map((bar) => (
                      <Cell key={bar.name} fill={barColor(bar.value)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-medium">{t("performances.analysisPerPiece")}</h4>
            {entries.map((entry) => {
              const { item, readiness } = entry;
              const radar = [
                { axis: t("performances.bpm"), value: readiness.bpm },

                { axis: t("performances.mastery"), value: readiness.mastery },
                { axis: t("performances.frequency"), value: readiness.frequency },
              ];
              return (
                <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-base leading-tight break-words min-w-0">{item.title}</span>
                    <span className="text-xs tabular-nums font-medium shrink-0">{readiness.overall}%</span>
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radar} outerRadius="72%">
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {t("performances.bpm")} {readiness.bpm}% · {t("performances.mastery")} {readiness.mastery}% · {t("performances.frequency")} {readiness.frequency}%
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {t("performances.recentSessions").replace("{count}", String(readiness.recentSessions))}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDrilldown(entry)}
                    className="w-full inline-flex items-center justify-between gap-2 rounded-md border border-border px-3 min-h-[44px] text-sm text-primary hover:bg-accent/40 active:bg-accent/60"
                  >
                    {t("performances.analysisDetails")}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

              );
            })}
          </section>
        </div>
      )}
      </ResponsiveSheet>

      <PieceDrilldownSheet
        open={drilldown !== null}
        onOpenChange={(next) => !next && setDrilldown(null)}
        item={drilldown?.item ?? null}
        sessions={drilldown?.sessions ?? []}
        segments={drilldown?.segments ?? []}
        readiness={drilldown?.readiness ?? null}
      />
    </>
  );
}


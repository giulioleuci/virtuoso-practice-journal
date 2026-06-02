import { useMemo } from "react";
import { useTechniques, useItem, useTasksByItem } from "@/hooks/useEntities";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, THEORY_LAYERS, type Session } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { NOTE_GLYPH, QUALITY_SYMBOL, QUALITY_VALS } from "@/lib/constants";
import { BackIcon, TrendIcon, ChartIcon } from "@/lib/icons";
import { weeklySessionCounts } from "@/lib/domain/analytics";
import { formatDate, getDefaultWeekStartsOn } from "@/lib/date";
import type { Lang } from "@/lib/db";
import { Button } from "@/components/ui/button";


const QUALITY_ORDER = ["hard", "improve", "well", "great"];

interface ChartPoint { x: number; y: number; label: string }

function formatDay(date: string, lang: Lang): string {
  return formatDate(date, lang, "dayMonth");
}

function LineChart({ points, target, color = "hsl(var(--primary))", targetColor = "hsl(var(--muted-foreground))" }: {
  points: ChartPoint[];
  target?: number;
  color?: string;
  targetColor?: string;
}) {
  const w = 320, h = 80;
  if (points.length === 0) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground italic">No data</div>;

  const values = points.map((p) => p.y);
  const allValues = target != null ? [...values, target] : values;
  const lo = Math.min(...allValues) * 0.95;
  const hi = Math.max(...allValues) * 1.05;
  const range = Math.max(1, hi - lo);
  const xStep = points.length > 1 ? w / (points.length - 1) : w / 2;

  const toX = (i: number) => i * xStep;
  const toY = (v: number) => h - ((v - lo) / range) * (h - 4) - 2;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.y).toFixed(1)}`).join(" ");
  const targetY = target != null ? toY(target) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
      {targetY != null && (
        <line x1={0} y1={targetY} x2={w} y2={targetY} stroke={targetColor} strokeWidth={1} strokeDasharray="4 3" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.y)} r={3} fill={color} />
      ))}
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-2 h-14">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${Math.max(2, (d.count / max) * 48)}px`,
              backgroundColor: d.color,
              opacity: d.count === 0 ? 0.2 : 1,
            }}
          />
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ItemAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const itemId = id ? Number(id) : null;

  const item = useItem(itemId ?? undefined);
  const tasks = useTasksByItem(itemId ?? undefined);
  const profile = useLiveQuery(() => db.profile.get("me"));

  const sessions = useLiveQuery(async () => {
    const ids = (tasks ?? []).map((t) => t.id).filter(Boolean);
    if (!ids.length) return [];
    return db.sessions.where("taskId").anyOf(ids).sortBy("date");
  }, [tasks]);

  const techniques = useTechniques();

  const isTheory = item?.kind === "theory";

  const bpmPoints = useMemo((): ChartPoint[] => {
    const points: ChartPoint[] = [];
    for (const s of sessions ?? []) {
      if (s.bpmReached == null) continue;
      points.push({ x: points.length, y: s.bpmReached, label: formatDay(s.date, lang) });
    }
    return points;
  }, [sessions, lang]);

  const confidencePoints = useMemo((): ChartPoint[] => {
    const points: ChartPoint[] = [];
    for (const s of sessions ?? []) {
      if (s.confidence == null) continue;
      points.push({ x: points.length, y: s.confidence, label: formatDay(s.date, lang) });
    }
    return points;
  }, [sessions, lang]);

  const qualityDist = useMemo(() => {
    const counts: Record<string, number> = { hard: 0, improve: 0, well: 0, great: 0 };
    for (const s of sessions ?? []) {
      if (s.quality) counts[s.quality]++;
    }
    const QUALITY_COLORS = ["hsl(var(--key-terracotta))", "hsl(var(--key-gold))", "hsl(var(--key-sage))", "hsl(var(--key-blue))"];
    return QUALITY_VALS.map((q, i) => ({
      label: q.symbol,
      count: counts[q.val] ?? 0,
      color: QUALITY_COLORS[i],
    }));
  }, [sessions]);

  const sessionsPerWeek = useMemo((): ChartPoint[] => {
    if (!sessions?.length) return [];
    const weekStartsOn = profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);
    return weeklySessionCounts(sessions, 12, weekStartsOn).map(({ weekKey, count }, i) => ({
      x: i,
      y: count,
      label: formatDay(weekKey, lang),
    }));
  }, [sessions, lang, profile]);

  const theoryLayerPoints = useMemo(() => {
    if (!isTheory || !sessions?.length) return null;
    return THEORY_LAYERS.map((layer) => {
      const pts: ChartPoint[] = [];
      for (const s of sessions) {
        const score = s.layerScores?.[layer];
        if (score == null) continue;
        pts.push({ x: pts.length, y: score, label: formatDay(s.date, lang) });
      }
      return { layer, points: pts };
    });
  }, [sessions, isTheory, lang]);

  const recentSessions = useMemo(
    () => [...(sessions ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    [sessions]
  );

  if (!item) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <BackIcon className="h-4 w-4 mr-1" /> {t("common.back")}
        </Button>
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const LAYER_COLORS = ["hsl(var(--key-terracotta))", "hsl(var(--key-gold))", "hsl(var(--key-sage))", "hsl(var(--key-blue))", "hsl(var(--key-plum))"];

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
          <BackIcon className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl truncate">{item.title}</h2>
          {item.composer && <p className="text-sm text-muted-foreground italic">{item.composer}</p>}
        </div>
      </div>

      {(sessions?.length ?? 0) === 0 ? (
        <div className="paper-card p-6 text-center text-muted-foreground italic">
          {t("analysis.noData")}
        </div>
      ) : (
        <>
          {/* BPM trend */}
          {!isTheory && bpmPoints.length > 0 && (
            <section className="paper-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendIcon className="h-4 w-4 text-primary" />
                <h3 className="font-serif text-lg">{t("analysis.bpmTrend")}</h3>
                {item.targetBpm && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t("analysis.target")}: {NOTE_GLYPH[item.noteVal ?? "quarter"]} = {item.targetBpm}
                  </span>
                )}
              </div>
              <LineChart
                points={bpmPoints}
                target={item.targetBpm}
                color="hsl(var(--key-terracotta))"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{bpmPoints[0]?.label}</span>
                <span>{bpmPoints[bpmPoints.length - 1]?.label}</span>
              </div>
            </section>
          )}

          {/* Theory layer trends */}
          {isTheory && theoryLayerPoints && (
            <section className="paper-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <ChartIcon className="h-4 w-4 text-primary" />
                <h3 className="font-serif text-lg">{t("analysis.theoryLayers")}</h3>
              </div>
              {theoryLayerPoints.map(({ layer, points }, idx) => (
                points.length > 0 && (
                  <div key={layer} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{t(`library.mastery.${layer}`)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {points[points.length - 1]?.y}/100
                      </span>
                    </div>
                    <LineChart points={points} color={LAYER_COLORS[idx]} />
                  </div>
                )
              ))}
            </section>
          )}

          {/* Quality distribution */}
          <section className="paper-card p-4 space-y-3">
            <h3 className="font-serif text-lg">{t("analysis.qualityTrend")}</h3>
            <BarChart data={qualityDist} />
          </section>

          {/* Confidence trend */}
          {confidencePoints.length > 0 && (
            <section className="paper-card p-4 space-y-3">
              <h3 className="font-serif text-lg">{t("analysis.confidenceTrend")}</h3>
              <LineChart points={confidencePoints} target={5} color="hsl(var(--key-plum))" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{confidencePoints[0]?.label}</span>
                <span>{confidencePoints[confidencePoints.length - 1]?.label}</span>
              </div>
            </section>
          )}

          {/* Sessions per week */}
          {sessionsPerWeek.length > 1 && (
            <section className="paper-card p-4 space-y-3">
              <h3 className="font-serif text-lg">{t("analysis.sessionsPerWeek")}</h3>
              <BarChart
                data={sessionsPerWeek.map((p) => ({
                  label: p.label.split(" ")[0] ?? "",
                  count: p.y,
                  color: "hsl(var(--key-sage))",
                }))}
              />
            </section>
          )}

          {/* Session log */}
          <section className="space-y-3">
            <h3 className="font-serif text-xl">{t("analysis.allSessions")}</h3>
            <ul className="space-y-2">
              {recentSessions.map((s) => (
                <li key={s.id} className="paper-card p-3 flex items-start gap-3">
                  <div className="shrink-0 text-center min-w-[2.5rem]">
                    <div className="font-serif text-xl leading-none">
                      {s.quality ? QUALITY_SYMBOL[s.quality] : "—"}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {formatDate(s.date, lang, "weekdayShort")}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                        {s.bpmReached && <span>{NOTE_GLYPH[s.noteVal ?? "quarter"]} = {s.bpmReached}</span>}
                        {s.confidence != null && <span>★ {s.confidence}/5</span>}
                      </div>
                    </div>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.notes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

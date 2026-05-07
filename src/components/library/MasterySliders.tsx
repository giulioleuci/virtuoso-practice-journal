import { useI18n } from "@/lib/i18n";
import { THEORY_LAYERS } from "@/lib/db";

export interface MasteryState {
  conceptual: number;
  analytical: number;
  aural: number;
  compositional: number;
}

interface Props {
  value: MasteryState;
  size?: number;
}

/** Display-only radar chart for theory mastery. Values come from sessions, not direct editing. */
export function MasterySliders({ value, size = 200 }: Props) {
  const { t } = useI18n();
  const cx = size / 2, cy = size / 2;
  const r = size * 0.39;
  const angles = THEORY_LAYERS.map((_, i) => (-Math.PI / 2) + (i * 2 * Math.PI) / THEORY_LAYERS.length);

  const point = (val: number, i: number): [number, number] => {
    const rr = (val / 100) * r;
    return [cx + rr * Math.cos(angles[i]), cy + rr * Math.sin(angles[i])];
  };

  const polygon = THEORY_LAYERS.map((k, i) => point(value[k], i).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={THEORY_LAYERS.map((_, i) => {
            const x = cx + r * s * Math.cos(angles[i]);
            const y = cy + r * s * Math.sin(angles[i]);
            return `${x},${y}`;
          }).join(" ")}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
      ))}
      {THEORY_LAYERS.map((_, i) => {
        const x = cx + r * Math.cos(angles[i]);
        const y = cy + r * Math.sin(angles[i]);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />;
      })}
      <polygon
        points={polygon}
        fill="hsl(var(--primary) / 0.25)"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
      />
      {THEORY_LAYERS.map((k, i) => {
        const [x, y] = point(value[k], i);
        return <circle key={k} cx={x} cy={y} r={3} fill="hsl(var(--primary))" />;
      })}
      {THEORY_LAYERS.map((k, i) => {
        const lx = cx + (r + 14) * Math.cos(angles[i]);
        const ly = cy + (r + 14) * Math.sin(angles[i]);
        return (
          <text
            key={k}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            {t(`library.mastery.${k}`)}
          </text>
        );
      })}
    </svg>
  );
}

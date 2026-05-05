import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export interface MasteryState {
  conceptual: number;
  analytical: number;
  aural: number;
  compositional: number;
}

const FIELDS: { key: keyof MasteryState; label: string; hint: string }[] = [
  { key: "conceptual",    label: "Conceptual",    hint: "Understanding the rules" },
  { key: "analytical",    label: "Analytical",    hint: "Recognizing on the page" },
  { key: "aural",         label: "Aural",         hint: "Hearing it" },
  { key: "compositional", label: "Compositional", hint: "Writing with it" },
];

interface Props {
  value: MasteryState;
  onChange: (next: MasteryState) => void;
}

export function MasterySliders({ value, onChange }: Props) {
  // Radar geometry
  const size = 200;
  const cx = size / 2, cy = size / 2;
  const r = 78;
  const angles = FIELDS.map((_, i) => (-Math.PI / 2) + (i * 2 * Math.PI) / FIELDS.length);
  const point = (val: number, i: number) => {
    const rr = (val / 100) * r;
    return [cx + rr * Math.cos(angles[i]), cy + rr * Math.sin(angles[i])];
  };
  const polygon = FIELDS.map((f, i) => point(value[f.key], i).join(",")).join(" ");

  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mastery</Label>
      <div className="paper-card p-4 space-y-5">
        {/* Radar */}
        <div className="flex justify-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-56 h-56">
            {[0.25, 0.5, 0.75, 1].map((s) => (
              <polygon
                key={s}
                points={FIELDS.map((_, i) => {
                  const x = cx + r * s * Math.cos(angles[i]);
                  const y = cy + r * s * Math.sin(angles[i]);
                  return `${x},${y}`;
                }).join(" ")}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
            ))}
            {FIELDS.map((_, i) => {
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
            {FIELDS.map((f, i) => {
              const [x, y] = point(value[f.key], i);
              return <circle key={f.key} cx={x} cy={y} r={3} fill="hsl(var(--primary))" />;
            })}
            {FIELDS.map((f, i) => {
              const lx = cx + (r + 14) * Math.cos(angles[i]);
              const ly = cy + (r + 14) * Math.sin(angles[i]);
              return (
                <text
                  key={f.key}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}
                >
                  {f.label}
                </text>
              );
            })}
          </svg>
        </div>

        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-medium text-sm">{f.label}</div>
                <div className="text-xs text-muted-foreground italic">{f.hint}</div>
              </div>
              <div className="font-serif text-lg tabular-nums text-primary">
                {value[f.key]}
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>
            <Slider
              value={[value[f.key]]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => onChange({ ...value, [f.key]: v[0] })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

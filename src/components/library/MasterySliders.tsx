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
  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mastery</Label>
      <div className="paper-card p-4 space-y-5">
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

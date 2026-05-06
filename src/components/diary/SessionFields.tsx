/** Shared form fields for logging or editing a Session. */
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { StarRating } from "@/components/shared/StarRating";
import { cn } from "@/lib/utils";
import type { NoteVal, SessionQuality } from "@/lib/db";

const QUALITIES: { val: SessionQuality; label: string; emoji: string }[] = [
  { val: "hard", label: "Hard", emoji: "🥵" },
  { val: "well", label: "Well", emoji: "🙂" },
  { val: "great", label: "Great", emoji: "✨" },
];

export interface SessionFieldsValue {
  bpm: number | undefined;
  noteVal: NoteVal | undefined;
  reps: number | undefined;
  confidence: number | undefined;
  quality: SessionQuality;
  notes: string;
  layersUsed: string[];
  techniquesUsed: number[];
}

interface Props {
  value: SessionFieldsValue;
  onChange: (patch: Partial<SessionFieldsValue>) => void;
  layerOptions: { value: string; label: string }[];
  techniqueOptions: { value: number; label: string }[];
  layerEmptyHint?: string;
  techniqueEmptyHint?: string;
}

export function SessionFields({
  value, onChange, layerOptions, techniqueOptions, layerEmptyHint, techniqueEmptyHint,
}: Props) {
  return (
    <>
      <BpmCoupler
        bpm={value.bpm}
        noteVal={value.noteVal}
        onChange={({ bpm: b, noteVal: n }) => onChange({ bpm: b, noteVal: n })}
        label="BPM reached"
      />

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Repetitions</Label>
        <Input
          type="number" inputMode="numeric" min={0} max={9999}
          value={value.reps ?? ""}
          onChange={(e) => onChange({ reps: e.target.value === "" ? undefined : Number(e.target.value) })}
          placeholder="e.g. 10"
        />
      </div>

      <StarRating
        label="Confidence"
        value={value.confidence}
        onChange={(c) => onChange({ confidence: c })}
      />

      <MultiChipPicker
        label="Layers practiced"
        options={layerOptions}
        value={value.layersUsed}
        onChange={(v) => onChange({ layersUsed: v })}
        emptyHint={layerEmptyHint}
      />
      <MultiChipPicker
        label="Techniques practiced"
        options={techniqueOptions}
        value={value.techniquesUsed}
        onChange={(v) => onChange({ techniquesUsed: v })}
        emptyHint={techniqueEmptyHint}
      />

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">How did it go?</Label>
        <div className="grid grid-cols-3 gap-2">
          {QUALITIES.map((q) => (
            <button
              key={q.val}
              type="button"
              onClick={() => onChange({ quality: q.val })}
              className={cn(
                "paper-card flex flex-col items-center py-3 transition-all",
                value.quality === q.val ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
              )}
            >
              <span className="text-2xl">{q.emoji}</span>
              <span className="text-xs mt-1">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
        <Textarea
          rows={3}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="A thought, a difficulty, a small win…"
        />
      </div>
    </>
  );
}

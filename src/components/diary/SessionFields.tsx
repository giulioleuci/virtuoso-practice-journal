/** Shared form fields for logging or editing a Session. */
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { StarRating } from "@/components/shared/StarRating";
import { cn } from "@/lib/utils";
import type { NoteVal, SessionQuality } from "@/lib/db";
import { THEORY_LAYERS, type TheoryLayer } from "@/lib/db";
import { useI18n } from "@/lib/i18n";

const QUALITY_VALS: { val: SessionQuality; emoji: string }[] = [
  { val: "hard", emoji: "🥵" },
  { val: "well", emoji: "🙂" },
  { val: "great", emoji: "✨" },
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
  layerScores: Record<string, number>;
}

interface Props {
  value: SessionFieldsValue;
  onChange: (patch: Partial<SessionFieldsValue>) => void;
  layerOptions: { value: string; label: string }[];
  techniqueOptions: { value: number; label: string }[];
  layerEmptyHint?: string;
  techniqueEmptyHint?: string;
  /** When true, replace layer chip picker with per-dimension score sliders. */
  isTheory?: boolean;
}

export function SessionFields({
  value, onChange, layerOptions, techniqueOptions, layerEmptyHint, techniqueEmptyHint, isTheory,
}: Props) {
  const { t } = useI18n();
  return (
    <>
      {!isTheory && (
        <BpmCoupler
          bpm={value.bpm}
          noteVal={value.noteVal}
          onChange={({ bpm: b, noteVal: n }) => onChange({ bpm: b, noteVal: n })}
          label={t("session.bpmReached")}
        />
      )}

      {!isTheory && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("session.repetitions")}</Label>
          <Input
            type="number" inputMode="numeric" min={0} max={9999}
            value={value.reps ?? ""}
            onChange={(e) => onChange({ reps: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="e.g. 10"
          />
        </div>
      )}

      <StarRating
        label={t("session.confidenceLabel")}
        value={value.confidence}
        onChange={(c) => onChange({ confidence: c })}
      />

      {isTheory ? (
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("session.theoryScores")}
          </Label>
          <div className="paper-card p-4 space-y-4">
            {THEORY_LAYERS.map((layer) => {
              const score = value.layerScores[layer] ?? 0;
              return (
                <div key={layer} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="font-medium text-sm">{t(`library.mastery.${layer}`)}</div>
                      <div className="text-xs text-muted-foreground italic">{t(`library.mastery.${layer}.hint`)}</div>
                    </div>
                    <div className="font-serif text-lg tabular-nums text-primary">
                      {score}
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                  </div>
                  <Slider
                    value={[score]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(v) =>
                      onChange({
                        layerScores: { ...value.layerScores, [layer]: v[0] },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <MultiChipPicker
          label={t("session.layers")}
          options={layerOptions}
          value={value.layersUsed}
          onChange={(v) => onChange({ layersUsed: v })}
          emptyHint={layerEmptyHint}
        />
      )}

      <MultiChipPicker
        label={t("session.techniquesPracticed")}
        options={techniqueOptions}
        value={value.techniquesUsed}
        onChange={(v) => onChange({ techniquesUsed: v })}
        emptyHint={techniqueEmptyHint}
      />

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("session.qualityLabel")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {QUALITY_VALS.map((q) => (
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
              <span className="text-xs mt-1">{{ hard: t("session.qualityHard"), well: t("session.qualityWell"), great: t("session.qualityGreat") }[q.val]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("session.notes")}</Label>
        <Textarea
          rows={3}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={t("session.notesPlaceholder")}
        />
      </div>
    </>
  );
}

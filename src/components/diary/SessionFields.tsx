/** Shared form fields for logging or editing a Session. */
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { StarRating } from "@/components/shared/StarRating";
import { cn } from "@/lib/utils";
import type { NoteVal, SessionQuality } from "@/lib/db";
import { useI18n } from "@/lib/i18n";

/** Musical notation symbols used as quality indicators. */
const QUALITY_VALS: { val: SessionQuality; symbol: string; labelKey: string }[] = [
  { val: "hard",    symbol: "♭", labelKey: "session.qualityHard" },
  { val: "improve", symbol: "♮", labelKey: "session.qualityImprove" },
  { val: "well",    symbol: "♯", labelKey: "session.qualityWell" },
  { val: "great",   symbol: "✦", labelKey: "session.qualityGreat" },
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
  techniqueScores: Record<number, number>;
}

interface Props {
  value: SessionFieldsValue;
  onChange: (patch: Partial<SessionFieldsValue>) => void;
  layerOptions: { value: string; label: string }[];
  techniqueOptions: { value: number; label: string }[];
  layerEmptyHint?: string;
  techniqueEmptyHint?: string;
  /** When true, hide BPM/reps fields and use translated theory layer labels in sliders. */
  isTheory?: boolean;
  /** When true, hide per-session metric inputs (bpm, reps, confidence, quality).
   *  Used in granular segment mode where metrics are captured per segment. */
  hideMetrics?: boolean;
}

export function SessionFields({
  value, onChange, layerOptions, techniqueOptions, layerEmptyHint, techniqueEmptyHint, isTheory, hideMetrics,
}: Props) {
  const { t } = useI18n();
  return (
    <>
      {!hideMetrics && !isTheory && (
        <BpmCoupler
          bpm={value.bpm}
          noteVal={value.noteVal}
          onChange={({ bpm: b, noteVal: n }) => onChange({ bpm: b, noteVal: n })}
          label={t("session.bpmReached")}
        />
      )}

      {!hideMetrics && !isTheory && (
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

      {!hideMetrics && (
        <StarRating
          label={t("session.confidenceLabel")}
          value={value.confidence}
          onChange={(c) => onChange({ confidence: c })}
        />
      )}

      {/* Layer chip picker — both theory and instrument */}
      <MultiChipPicker
        label={t("session.layers")}
        options={layerOptions}
        value={value.layersUsed}
        onChange={(v) => onChange({ layersUsed: v })}
        emptyHint={layerEmptyHint}
      />

      {/* Layer scores accordion — collapsed by default, shown when layers are selected */}
      {value.layersUsed.length > 0 && (
        <Accordion type="single" collapsible className="paper-card overflow-hidden">
          <AccordionItem value="layer-scores" className="border-none">
            <AccordionTrigger className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground">
              {t("session.layerScores")}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4 pt-1">
                {value.layersUsed.map((layer) => {
                  const score = value.layerScores[layer] ?? 0;
                  return (
                    <div key={layer} className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {isTheory ? t(`library.mastery.${layer}`) : layer}
                          </div>
                          {isTheory && (
                            <div className="text-xs text-muted-foreground italic">
                              {t(`library.mastery.${layer}.hint`)}
                            </div>
                          )}
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <MultiChipPicker
        label={t("session.techniquesPracticed")}
        options={techniqueOptions}
        value={value.techniquesUsed}
        onChange={(v) => onChange({ techniquesUsed: v })}
        emptyHint={techniqueEmptyHint}
      />

      {/* Technique scores accordion — collapsed by default, shown when techniques are selected */}
      {value.techniquesUsed.length > 0 && (
        <Accordion type="single" collapsible className="paper-card overflow-hidden">
          <AccordionItem value="technique-scores" className="border-none">
            <AccordionTrigger className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground">
              {t("session.techniqueScores")}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4 pt-1">
                {value.techniquesUsed.map((id) => {
                  const label = techniqueOptions.find((o) => o.value === id)?.label ?? String(id);
                  const score = value.techniqueScores[id] ?? 0;
                  return (
                    <div key={id} className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="font-medium text-sm">{label}</div>
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
                            techniqueScores: { ...value.techniqueScores, [id]: v[0] },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {!hideMetrics && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("session.qualityLabel")}</Label>
          <div className="grid grid-cols-4 gap-2">
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
                <span className="text-2xl font-serif leading-none">{q.symbol}</span>
                <span className="text-xs mt-1">{t(q.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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

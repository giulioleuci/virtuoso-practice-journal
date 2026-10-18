import { toast } from "sonner";
import { RATING_KEYS, type SegmentMark } from "@/domain/entities/common";
import { emptyEntry } from "@/domain/logic/plan";
import { missingRatings } from "@/domain/logic/sessionMetrics";
import { NOTE_GLYPH } from "@/domain/constants/noteValues";
import { useI18n } from "@/lib/i18n";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { RatingFields } from "@/components/shared/RatingFields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface Option<T extends string | number> { value: T; label: string }

/** One row per section: confidence and tempo first, optional context and skills on demand. */
export function MarksEditor({ marks, onChange, sections, seed = emptyEntry, layerOptions, techniqueOptions, isTheory, showTempo = !isTheory, requireRatings = true, showErrors = false }: {
  marks: SegmentMark[];
  onChange: (marks: SegmentMark[]) => void;
  /** Sections on offer; empty or missing means one whole-scope entry. */
  sections?: { id: number; label: string }[];
  /** Entry added when a section is switched to studied (plan targets, never ratings). */
  seed?: (segmentId: number) => SegmentMark;
  layerOptions: Option<string>[];
  techniqueOptions: Option<number>[];
  isTheory: boolean;
  showTempo?: boolean;
  /** New sessions need confidence; edits of older records do not. */
  requireRatings?: boolean;
  showErrors?: boolean;
}) {
  const { t } = useI18n();
  const rows: { id?: number; label: string }[] = sections?.length ? sections : [{ label: "" }];
  const patch = (segmentId: number | undefined, p: Partial<SegmentMark>) => onChange(marks.map((m) => (m.segmentId === segmentId ? { ...m, ...p } : m)));
  const setStudied = (segmentId: number, on: boolean) => onChange(on ? [...marks, seed(segmentId)] : marks.filter((m) => m.segmentId !== segmentId));
  const applyToOthers = (from: SegmentMark) => {
    const before = marks;
    onChange(marks.map((m) => (m === from ? m : { ...m, mood: from.mood, focus: from.focus, confidence: from.confidence })));
    toast(t("rating.applied"), { action: { label: t("common.undo"), onClick: () => onChange(before) } });
  };

  return (
    <div className="divide-y divide-border">
      {rows.map(({ id, label }) => {
        const m = marks.find((x) => x.segmentId === id);
        const missing = m && requireRatings ? missingRatings(m) : [];
        const others = m ? marks.filter((x) => x !== m) : [];
        const replaces = m ? others.filter((x) => RATING_KEYS.some((k) => x[k] !== undefined && x[k] !== m[k])).length : 0;
        return (
          <section key={id ?? "whole"} aria-label={label || undefined} className="space-y-4 py-5 first:pt-0 last:pb-0">
            {id !== undefined && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-lg font-semibold leading-tight">{label}</h2>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <Switch checked={!!m} onCheckedChange={(on) => setStudied(id, on)} aria-label={`${label}: ${t("rating.studied")}`} />
                  {m ? t("rating.studied") : t("rating.notStudied")}
                </label>
              </div>
            )}
            {m && (
              <>
                {showErrors && missing.length > 0 && <p className="text-xs font-medium text-destructive">{t("rating.missing", { fields: missing.map((key) => (key === "confidence" ? t("session.confidenceLabel") : t(`rating.${key}`))).join(", ") })}</p>}
                <RatingFields mark={m} onChange={(p) => patch(id, p)} requireRatings={requireRatings} showErrors={showErrors}>
                  {showTempo && m.targetBpm !== undefined && <p className="text-xs tabular-nums text-muted-foreground">{t("diary.targetBpm", { note: NOTE_GLYPH[m.targetNoteVal ?? "quarter"], bpm: m.targetBpm })}</p>}
                  {showTempo && <BpmCoupler bpm={m.bpm} noteVal={m.noteVal} onChange={({ bpm, noteVal }) => patch(id, { bpm, noteVal })} label={t("session.bpmReached")} />}
                </RatingFields>
                {others.length > 0 && missingRatings(m).length === 0 && (
                  <div className="space-y-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => applyToOthers(m)}>{t("rating.applyToOthers")}</Button>
                    {replaces > 0 && <p className="text-xs text-muted-foreground">{t("rating.applyReplaces", { count: replaces })}</p>}
                  </div>
                )}
                <details open={isTheory} className="border-t border-border pt-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    {t("session.editWorkedOn", { layers: m.layers.length, techniques: m.techniques.length })}
                  </summary>
                  <div className="mt-3 space-y-4">
                    <MultiChipPicker label={t("session.layers")} options={layerOptions} value={m.layers} onChange={(layers) => patch(id, { layers })} />
                    <MultiChipPicker label={t("session.techniquesPracticed")} options={techniqueOptions} value={m.techniques} onChange={(techniques) => patch(id, { techniques })} />
                  </div>
                </details>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

import { useMemo } from "react";
import { Copy } from "lucide-react";
import type { Subject, SegmentEntry } from "@/domain/entities/common";
import type { Segment } from "@/domain/entities/library";
import { getSubjectLayers } from "@/lib/domain/subjectLayers";
import { useI18n } from "@/lib/i18n";
import { useTechniques } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";

/** Tempo, layers and techniques planned for each selected section of a task. */
export function PlanEditor({ plan, onChange, sections, subject }: { plan: SegmentEntry[]; onChange: (plan: SegmentEntry[]) => void; sections?: Segment[]; subject?: Subject }) {
  const { t } = useI18n();
  const techniques = useTechniques();
  const isTheory = subject?.type === "theory";
  const layerOptions = useMemo(() => getSubjectLayers(subject).map((l) => ({ value: l, label: isTheory ? t(`library.mastery.${l}`) : l })), [subject, isTheory, t]);
  const techniqueOptions = useMemo(() => (techniques ?? []).filter((x) => x.subjectId === subject?.id).map((x) => ({ value: x.id, label: x.name })), [techniques, subject?.id]);
  const patch = (i: number, p: Partial<SegmentEntry>) => onChange(plan.map((e, j) => (j === i ? { ...e, ...p } : e)));

  return (
    <div className="space-y-6">
      {plan.length > 1 && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(plan.map((e) => ({ ...plan[0], segmentId: e.segmentId })))}>
          <Copy />{t("tasks.copyFirstToAll")}
        </Button>
      )}
      {plan.map((entry, i) => (
        <section key={entry.segmentId ?? "whole"} className="space-y-4 border-t border-border pt-4 first:border-t-0 first:pt-0">
          {entry.segmentId !== undefined && <h3 className="font-serif text-lg font-semibold">{sections?.find((s) => s.id === entry.segmentId)?.label}</h3>}
          <BpmCoupler bpm={entry.bpm} noteVal={entry.noteVal} onChange={({ bpm, noteVal }) => patch(i, { bpm, noteVal })} label={t("tasks.targetTempo")} />
          <MultiChipPicker label={t("tasks.layersToPractice")} options={layerOptions} value={entry.layers} onChange={(layers) => patch(i, { layers })} emptyHint={t("tasks.defineLayersHint")} />
          <MultiChipPicker label={t("tasks.techniquesToFocus")} options={techniqueOptions} value={entry.techniques} onChange={(techniques) => patch(i, { techniques })} emptyHint={t("tasks.addTechniquesHint")} />
        </section>
      ))}
    </div>
  );
}

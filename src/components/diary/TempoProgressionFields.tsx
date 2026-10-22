import { useEffect, useId, useState } from "react";
import type { NoteVal, TempoStep } from "@/domain/entities/common";
import type { TempoProgressionRule } from "@/domain/entities/tempoProgression";
import { NOTE_VALUES } from "@/domain/constants/noteValues";
import { tempoRuleSchema } from "@/lib/schemas";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { nativeSelect } from "./WhenFields";

type Draft = { successes: string; window: string; confidence: string; increaseKind: "fixed" | "percent"; increaseValue: string; increaseNote: NoteVal; decrease: boolean; failures: string; decreaseKind: "fixed" | "percent"; decreaseValue: string; decreaseNote: NoteVal };
export function TempoProgressionFields({ value, onChange, onValidityChange, disabled }: { value?: TempoProgressionRule; onChange: (value: TempoProgressionRule | undefined) => void; onValidityChange: (valid: boolean) => void; disabled?: boolean }) {
  const { t } = useI18n(), id = useId();
  const [enabled,setEnabled] = useState(value?.enabled ?? false);
  const [draft,setDraft] = useState<Draft>({ successes: String(value?.successes ?? 3), window: value?.window === undefined ? "" : String(value.window), confidence: String(value?.minConfidence ?? 4), increaseKind: value?.increase.kind ?? "fixed", increaseValue: String(value?.increase.value ?? 2), increaseNote: value?.increase.kind === "fixed" ? value.increase.noteVal : "quarter", decrease: !!value?.decrease, failures: String(value?.decrease?.failures ?? 2), decreaseKind: value?.decrease?.step.kind ?? "percent", decreaseValue: String(value?.decrease?.step.value ?? 5), decreaseNote: value?.decrease?.step.kind === "fixed" ? value.decrease.step.noteVal : "quarter" });
  const parse = (d: Draft) => {
    const step = (kind: "fixed" | "percent", amount: string, noteVal: NoteVal): TempoStep => kind === "fixed" ? { kind,value: Number(amount),noteVal } : { kind,value: Number(amount) };
    return tempoRuleSchema.safeParse({ enabled: true, successes: Number(d.successes), window: d.window === "" ? undefined : Number(d.window), minConfidence: Number(d.confidence), increase: step(d.increaseKind,d.increaseValue,d.increaseNote), decrease: d.decrease ? { failures: Number(d.failures), step: step(d.decreaseKind,d.decreaseValue,d.decreaseNote) } : undefined });
  };
  const valid = !enabled || parse(draft).success;
  useEffect(() => { onValidityChange(valid); }, [valid,onValidityChange]);
  const change = (patch: Partial<Draft>) => { const next = { ...draft,...patch }; setDraft(next); const parsed = parse(next); if (parsed.success) onChange({ ...parsed.data,enabled } as TempoProgressionRule); };
  const number = (key: "successes" | "window" | "confidence" | "failures" | "increaseValue" | "decreaseValue", label: string, min: number, max?: number, step = "1") => <label className="grid min-w-0 gap-1.5 text-sm">{t(`tempo.${label}`)}<Input type="number" inputMode={step === "any" ? "decimal" : "numeric"} min={min} max={max} step={step} value={draft[key]} onChange={e => change({ [key]: e.target.value })} /></label>;
  const stepFields = (prefix: "increase" | "decrease") => {
    const kind = prefix === "increase" ? draft.increaseKind : draft.decreaseKind;
    return <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm">{t(`tempo.${prefix}Kind`)}<select className={nativeSelect} value={kind} onChange={e => change({ [`${prefix}Kind`]: e.target.value })}><option value="fixed">{t("tempo.fixed")}</option><option value="percent">{t("tempo.percent")}</option></select></label>
      {number(`${prefix}Value`,`${prefix}Value`,0, prefix === "decrease" && kind === "percent" ? 99.999 : undefined,kind === "percent" ? "any" : "1")}
      {kind === "fixed" && <label className="grid gap-1.5 text-sm">{t(`tempo.${prefix}Note`)}<select className={nativeSelect} value={draft[`${prefix}Note`]} onChange={e => change({ [`${prefix}Note`]: e.target.value })}>{NOTE_VALUES.map(note => <option key={note} value={note}>{t(`note.${note}`)}</option>)}</select></label>}
    </div>;
  };
  return <fieldset disabled={disabled} className="min-w-0 space-y-4 border-t border-border py-5 [overflow-wrap:anywhere]">
    <div className="flex min-h-11 items-center justify-between gap-4"><label htmlFor={`${id}-enabled`} className="min-w-0 flex-1 font-serif text-xl font-semibold">{t("tempo.title")}</label><Switch id={`${id}-enabled`} checked={enabled} onCheckedChange={on => { setEnabled(on); if (!on) onChange(value ? { ...value,enabled: false } : undefined); else { const result=parse(draft); if(result.success) onChange(result.data as TempoProgressionRule); } }} /></div>
    {enabled && <>
      <div className="grid gap-3 sm:grid-cols-2">{number("successes","successes",1)}{number("window","window",1)}{number("confidence","confidence",1,5)}</div>
      {draft.window === "" && <p className="text-sm text-muted-foreground">{t("tempo.consecutive")}</p>}
      <h3 className="font-medium">{t("tempo.increase")}</h3>{stepFields("increase")}
      <div className="flex min-h-11 items-center justify-between gap-4"><label htmlFor={`${id}-decrease`} className="min-w-0 flex-1">{t("tempo.decrease")}</label><Switch id={`${id}-decrease`} checked={draft.decrease} onCheckedChange={decrease => change({ decrease })} /></div>
      {draft.decrease && <>{number("failures","failures",1)}{stepFields("decrease")}</>}
      {!valid && <p role="alert" className="text-sm text-destructive">{t("tempo.invalidRule")}</p>}
    </>}
  </fieldset>;
}

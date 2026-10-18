import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPEAT_PRESETS, type RepeatPreset, type When } from "@/lib/domain/taskPresets";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";

export const nativeSelect =
  "h-[42px] min-w-0 max-w-full rounded-[6px] border border-input bg-card px-3 text-[0.8125rem] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

/** "When" and "Repeat" controls shared by quick add and bulk add. */
export function WhenFields({ when, custom, repeat, onWhen, onCustom, onRepeat }: {
  when: When;
  custom: string;
  repeat: RepeatPreset;
  onWhen: (when: When) => void;
  onCustom: (date: string) => void;
  onRepeat: (preset: RepeatPreset) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">{t("quick.when")}</legend>
        {(["today", "tomorrow", "custom"] as const).map((w) => (
          <label key={w} className="inline-flex min-h-9 items-center gap-2 text-[0.8125rem]">
            <input type="radio" name="when" checked={when === w} onChange={() => onWhen(w)} className="accent-[hsl(var(--primary))]" />
            {t(w === "today" ? "common.today" : w === "tomorrow" ? "quick.tomorrow" : "quick.pickDate")}
          </label>
        ))}
        {when === "custom" && (
          <Input type="date" value={custom} onChange={(e) => onCustom(e.target.value)} aria-label={t("quick.dateLabel")} className="w-auto" />
        )}
      </fieldset>
      <label className="grid gap-1.5 text-xs font-medium">
        {t("quick.repeat")}
        <Select value={repeat} onValueChange={(value) => onRepeat(value as RepeatPreset)} ><SelectTrigger className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>
          {REPEAT_PRESETS.map((p) => <SelectItem key={p} value={String(p)}>{t(`quick.repeat.${p}`)}</SelectItem>)}
        </SelectContent></Select>
      </label>
    </>
  );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type { LibraryItem, SegmentInput } from "@/domain/entities/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelect } from "@/components/diary/WhenFields";
import { tempoLabel } from "@/lib/format";
import { BpmCoupler } from "./BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { cn } from "@/lib/utils";
import { Pager } from "@/components/shared/Pager";
import { usePagination } from "@/hooks/usePagination";
import { useI18n } from "@/lib/i18n";

interface Props {
  segments: SegmentInput[];
  onChange: (next: SegmentInput[]) => void;
  itemTempo?: Pick<LibraryItem, "targetBpm" | "noteVal">;
  /** Subject-defined layers (closed vocabulary). */
  subjectLayers?: string[];
  /** Subject-defined techniques. */
  techniqueOptions?: { value: number; label: string }[];
}

export function SegmentsEditor({ segments, onChange, itemTempo, subjectLayers = [], techniqueOptions = [] }: Props) {
  const { t } = useI18n();
  const pager = usePagination(segments, 5);
  const [draftLabel, setDraftLabel] = useState("");

  const addSegment = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    onChange([...segments, { label: trimmed, position: segments.length, layers: [], techniqueIds: [] }]);
    pager.setPage(Math.floor(segments.length / 5));
    setDraftLabel("");
  };

  const update = (i: number, patch: Partial<SegmentInput>) =>
    onChange(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const remove = (i: number) => onChange(segments.filter((_, idx) => idx !== i).map((s, position) => ({ ...s, position })));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= segments.length) return;
    const next = segments.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((s, position) => ({ ...s, position })));
  };

  const layerOptions = subjectLayers.map((l) => ({ value: l, label: l }));

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-foreground">
        {t("segments.label")}
      </Label>

      <div className="paper-card p-2 flex gap-2 items-center">
        <Input
          aria-label={t("segments.label")}
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSegment())}
          placeholder={t("segments.placeholder")}
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button type="button" size="icon" variant="ghost" onClick={addSegment} aria-label={t("common.add")}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {segments.length > 0 && (
        <>
        <ul className="border-t border-border">
          {pager.pageItems.map((s, offset) => {
            const i = pager.page * 5 + offset;
            const labelInvalid = s.label.trim().length === 0;
            const barInvalid = (s.barStart !== undefined || s.barEnd !== undefined) && (s.barStart === undefined || s.barEnd === undefined || s.barEnd < s.barStart || !Number.isInteger(s.barStart) || !Number.isInteger(s.barEnd) || s.barStart < 0);
            return (
              <li key={s.id ?? `new-${i}`} className="border-b border-border py-3">
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">{s.label || t("segments.labelRequired")}</summary>
                  <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={t("segments.label")}
                    aria-invalid={labelInvalid}
                    value={s.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    className={cn(
                      "border-0 bg-transparent focus-visible:ring-0 font-serif text-lg px-0 h-8",
                      labelInvalid && "text-destructive"
                    )}
                  />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30" aria-label={t("segments.moveUp")}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === segments.length - 1}
                    className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30" aria-label={t("segments.moveDown")}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(i)}
                    aria-label={`${t("common.delete")}: ${s.label}`}
                    className="text-muted-foreground hover:text-destructive p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {labelInvalid && <p className="text-xs text-destructive -mt-1">{t("segments.labelRequired")}</p>}

                <div className="grid grid-cols-2 gap-3">
                  {(["barStart", "barEnd"] as const).map(field => <label key={field} className="space-y-1 text-xs font-medium">
                    {t(`segments.${field}`)}
                    <Input type="number" inputMode="numeric" min={0} step={1} value={s[field] ?? ""} aria-invalid={barInvalid} aria-describedby={barInvalid ? `bars-${i}` : undefined} onChange={e => update(i, { [field]: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  </label>)}
                </div>
                {barInvalid && <p id={`bars-${i}`} role="alert" className="text-xs text-destructive">{t("segments.barRangeError")}</p>}
                <label className="grid gap-1.5 text-xs font-medium">
                  {t("segments.tempoSource")}
                  <Select value={s.targetBpm !== undefined || s.noteVal !== undefined ? "specific" : "inherited"} onValueChange={(value) => update(i, value === "inherited" ? { targetBpm: undefined, noteVal: undefined } : { targetBpm: itemTempo?.targetBpm ?? 60, noteVal: itemTempo?.noteVal ?? "quarter" })} ><SelectTrigger className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="inherited">{t("segments.inherited")}</SelectItem>
                    <SelectItem value="specific">{t("segments.specific")}</SelectItem>
                  </SelectContent></Select>
                </label>
                {s.targetBpm !== undefined || s.noteVal !== undefined ? <BpmCoupler bpm={s.targetBpm} noteVal={s.noteVal} onChange={({ bpm, noteVal }) => update(i, { targetBpm: bpm, noteVal })} label={t("segments.targetLabel")} /> : <p className="text-sm text-muted-foreground">{itemTempo?.targetBpm !== undefined ? tempoLabel(itemTempo.noteVal, itemTempo.targetBpm) : t("segments.noInheritedTempo")}</p>}
                <label className="grid gap-1.5 text-xs font-medium">{t("segments.notes")}<Textarea rows={2} maxLength={2000} value={s.notes ?? ""} onChange={e => update(i, { notes: e.target.value || undefined })} /></label>

                <MultiChipPicker
                  label={t("tasks.layers")}
                  options={layerOptions}
                  value={s.layers}
                  onChange={(layers) => update(i, { layers })}
                  emptyHint={t("tasks.defineLayersHint")}
                />

                <MultiChipPicker
                  selectionSummary
                  label={t("tasks.techniques")}
                  options={techniqueOptions}
                  value={s.techniqueIds ?? []}
                  onChange={(techniqueIds) => update(i, { techniqueIds })}
                  emptyHint={t("library.addTechniquesHint2")}
                />

                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        <Pager page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} />
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type { NoteVal } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BpmCoupler } from "./BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { cn } from "@/lib/utils";

export interface DraftSegment {
  label: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers: string[];
  techniqueIds?: number[];
}

interface Props {
  segments: DraftSegment[];
  onChange: (next: DraftSegment[]) => void;
  /** Subject-defined layers (closed vocabulary). */
  subjectLayers?: string[];
  /** Subject-defined techniques. */
  techniqueOptions?: { value: number; label: string }[];
}

export function SegmentsEditor({ segments, onChange, subjectLayers = [], techniqueOptions = [] }: Props) {
  const [draftLabel, setDraftLabel] = useState("");

  const addSegment = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    onChange([...segments, { label: trimmed, layers: [], techniqueIds: [] }]);
    setDraftLabel("");
  };

  const update = (i: number, patch: Partial<DraftSegment>) =>
    onChange(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const remove = (i: number) => onChange(segments.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= segments.length) return;
    const next = segments.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const layerOptions = subjectLayers.map((l) => ({ value: l, label: l }));

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Segments
      </Label>

      <div className="paper-card p-2 flex gap-2 items-center">
        <Input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSegment())}
          placeholder="e.g. mm. 1–16, exposition…"
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button type="button" size="icon" variant="ghost" onClick={addSegment}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {segments.length > 0 && (
        <ul className="space-y-2">
          {segments.map((s, i) => {
            const labelInvalid = s.label.trim().length === 0;
            return (
              <li key={i} className="paper-card p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={s.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    className={cn(
                      "border-0 bg-transparent focus-visible:ring-0 font-serif text-lg px-0 h-8",
                      labelInvalid && "text-destructive"
                    )}
                  />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === segments.length - 1}
                    className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(i)}
                    className="text-muted-foreground hover:text-destructive p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {labelInvalid && <p className="text-xs text-destructive -mt-1">Label required</p>}

                <BpmCoupler
                  bpm={s.targetBpm}
                  noteVal={s.noteVal}
                  onChange={(next) => update(i, next)}
                  label="Segment target"
                />

                <MultiChipPicker
                  label="Layers"
                  options={layerOptions}
                  value={s.layers}
                  onChange={(layers) => update(i, { layers })}
                  emptyHint="Define this subject's layers in Profile."
                />

                <MultiChipPicker
                  label="Techniques"
                  options={techniqueOptions}
                  value={s.techniqueIds ?? []}
                  onChange={(techniqueIds) => update(i, { techniqueIds })}
                  emptyHint="Add techniques in Profile to associate them here."
                />

              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

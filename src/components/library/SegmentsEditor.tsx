import { useState } from "react";
import { Plus, X, Star } from "lucide-react";
import type { NoteVal } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BpmCoupler } from "./BpmCoupler";
import { cn } from "@/lib/utils";

export interface DraftSegment {
  label: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  confidence: number; // 1-5
}

interface Props {
  segments: DraftSegment[];
  onChange: (next: DraftSegment[]) => void;
}

export function SegmentsEditor({ segments, onChange }: Props) {
  const [draftLabel, setDraftLabel] = useState("");

  const addSegment = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    onChange([...segments, { label: trimmed, confidence: 3 }]);
    setDraftLabel("");
  };

  const update = (i: number, patch: Partial<DraftSegment>) =>
    onChange(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const remove = (i: number) => onChange(segments.filter((_, idx) => idx !== i));

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
          {segments.map((s, i) => (
            <li key={i} className="paper-card p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={s.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className="border-0 bg-transparent focus-visible:ring-0 font-serif text-lg px-0 h-8"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <BpmCoupler
                bpm={s.targetBpm}
                noteVal={s.noteVal}
                onChange={(next) => update(i, next)}
                label="Segment target"
              />

              <div className="flex items-center gap-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">
                  Confidence
                </span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update(i, { confidence: n })}
                    className="p-0.5"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors",
                        n <= s.confidence
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/40"
                      )}
                    />
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PRESETS = ["RH", "LH", "Both", "Slow", "In rhythm", "Memorized"];

interface Props {
  layers: string[];
  onChange: (next: string[]) => void;
  label?: string;
}

export function LayersEditor({ layers, onChange, label = "Layers" }: Props) {
  const [draft, setDraft] = useState("");

  const add = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || layers.includes(trimmed)) return;
    onChange([...layers, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>

      {layers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {layers.map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1 bg-accent px-3 py-1.5 rounded-full text-sm"
            >
              {l}
              <button type="button" onClick={() => onChange(layers.filter((x) => x !== l))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => !layers.includes(p)).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => add(p)}
            className="text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:bg-accent/60"
          >
            + {p}
          </button>
        ))}
      </div>

      <div className="paper-card p-2 flex gap-2 items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add(draft))}
          placeholder="Custom layer…"
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button type="button" size="icon" variant="ghost" onClick={() => add(draft)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

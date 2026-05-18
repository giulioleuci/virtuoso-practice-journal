import type { NoteVal } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

const NOTE_OPTIONS: { val: NoteVal; glyph: string; label: string }[] = [
  { val: "half",      glyph: "𝅗𝅥", label: "½" },
  { val: "quarter",   glyph: "♩",  label: "¼" },
  { val: "eighth",    glyph: "♪",  label: "⅛" },
  { val: "sixteenth", glyph: "𝅘𝅥𝅯", label: "1⁄16" },
];

interface Props {
  bpm: number | undefined;
  noteVal: NoteVal | undefined;
  onChange: (next: { bpm?: number; noteVal?: NoteVal }) => void;
  label?: string;
}

export function BpmCoupler({ bpm, noteVal, onChange, label }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label ?? t("library.targetTempo")}</Label>
      <div className="paper-card flex items-stretch gap-1 p-2">
        <div className="flex items-center gap-2 px-2 flex-1">
          <Input
            type="number"
            inputMode="numeric"
            min={20}
            max={400}
            value={bpm ?? ""}
            onChange={(e) =>
              onChange({ bpm: e.target.value ? Number(e.target.value) : undefined, noteVal })
            }
            placeholder="—"
            className="border-0 bg-transparent focus-visible:ring-0 text-2xl font-serif tabular-nums px-0 h-10 w-20"
          />
          <span className="text-xs text-muted-foreground">BPM</span>
        </div>
        <div className="w-px bg-border my-1" />
        <div className="flex gap-1">
          {NOTE_OPTIONS.map((n) => (
            <button
              key={n.val}
              type="button"
              onClick={() => onChange({ bpm, noteVal: n.val })}
              className={cn(
                "h-10 w-10 rounded-md text-lg leading-none transition-colors",
                noteVal === n.val
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              )}
              title={n.label}
            >
              {n.glyph}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

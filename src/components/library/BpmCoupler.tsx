import { COMPOUND_NOTES, NOTE_GLYPH, SIMPLE_NOTES, type NoteVal } from "@/domain/constants/noteValues";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

interface Props {
  bpm: number | undefined;
  noteVal: NoteVal | undefined;
  onChange: (next: { bpm?: number; noteVal?: NoteVal }) => void;
  label?: string;
}

/** Tempo input: a bpm number plus the note value it is counted in (simple, then dotted for compound meters). */
export function BpmCoupler({ bpm, noteVal, onChange, label }: Props) {
  const { t } = useI18n();
  const note = (n: NoteVal) => (
    <button
      key={n}
      type="button"
      aria-label={t(`note.${n}`)}
      aria-pressed={noteVal === n}
      title={t(`note.${n}`)}
      onClick={() => onChange({ bpm, noteVal: n })}
      className={cn(
        "h-11 min-w-0 flex-1 rounded-md px-1 text-lg leading-none transition-colors",
        noteVal === n ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
      )}
    >
      {NOTE_GLYPH[n]}
    </button>
  );
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-foreground">{label ?? t("library.targetTempo")}</Label>
      <div className="paper-card space-y-1 p-2 focus-within:ring-2 focus-within:ring-ring">
        <div className="flex items-center gap-2 px-2">
          <Input
            type="number"
            inputMode="numeric"
            min={20}
            max={400}
            value={bpm ?? ""}
            onChange={(e) => onChange({ bpm: e.target.value ? Number(e.target.value) : undefined, noteVal })}
            placeholder="—"
            aria-label={label ?? t("library.targetTempo")}
            className="h-10 w-16 border-0 bg-transparent px-0 font-numeric text-2xl tabular-nums focus-visible:ring-0 md:text-2xl"
          />
          <span className="text-xs text-muted-foreground">BPM</span>
        </div>
        <div className="flex gap-0.5 border-t border-border pt-1" role="group" aria-label={t("note.group")}>
          {SIMPLE_NOTES.map(note)}
          <span aria-hidden className="my-1 w-px bg-border" />
          {COMPOUND_NOTES.map(note)}
        </div>
      </div>
    </div>
  );
}

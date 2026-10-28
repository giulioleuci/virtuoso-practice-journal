import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { BPM_MAX, BPM_MIN } from "@/domain/constants/noteValues";
import { useI18n } from "@/lib/i18n";
import { useWakeLock } from "@/hooks/useWakeLock";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PageHeader } from "@/components/shared/PageHeader";
import { BeatDots, Pendulum } from "@/components/diary/Metronome";
import { useMetronome } from "@/hooks/useMetronome";

const STEPS = [-5, -1, 1, 5];

/** Free-practice metronome: no task, no log, just tempo and meter. */
export default function Metronome() {
  const { t } = useI18n();
  const [bpm, setBpm] = useState(() => { try { return Number(localStorage.getItem("metronome.bpm")) || 80; } catch { return 80; } });
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [muted, setMuted] = useState(false);
  const { on, pulse, toggle } = useMetronome({ bpm, beatsPerBar, muted });
  useWakeLock(on);
  const change = (next: number) => {
    const value = Math.min(BPM_MAX, Math.max(BPM_MIN, next));
    setBpm(value);
    try { localStorage.setItem("metronome.bpm", String(value)); } catch { /* private mode: tempo just isn't remembered */ }
  };

  return (
    <div className="pb-24">
      <PageHeader title={t("practice.metronome")} actions={
        <Button type="button" size="icon" variant="outline" className="h-11 w-11" onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? t("practice.unmute") : t("practice.mute")}>
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      } />

      <section aria-label={t("practice.metronome")} className="mx-auto grid max-w-[34rem] gap-5 rounded-lg bg-card p-5 shadow-soft min-[700px]:p-8">
        <div className="flex items-end justify-between gap-3">
          <BeatDots on={on} pulse={pulse} beatsPerBar={beatsPerBar} />
          <Pendulum on={on} pulse={pulse} bpm={bpm} beatsPerBar={beatsPerBar} className="w-24" />
        </div>

        <p className="text-center font-numeric text-[6rem] leading-none tabular-nums min-[700px]:text-[8rem]" aria-live="off">{bpm}</p>

        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((d) => (
            <Button key={d} type="button" variant="outline" className="tabular-nums" onClick={() => change(bpm + d)}
              aria-label={t(d < 0 ? "practice.bpmDecrease" : "practice.bpmIncrease", { step: Math.abs(d) })}>
              {d > 0 ? `+${d}` : d}
            </Button>
          ))}
        </div>
        <Slider value={[bpm]} min={BPM_MIN} max={BPM_MAX} step={1} onValueChange={(v) => change(v[0])} aria-label={t("practice.bpmUnit")} />

        <div role="group" aria-label={t("practice.beatsPerBar")} className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">{t("practice.beatsPerBar")}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 6].map((n) => (
              <button key={n} type="button" aria-pressed={beatsPerBar === n} onClick={() => setBeatsPerBar(n)}
                className={cn("h-11 w-11 rounded-lg text-sm tabular-nums", beatsPerBar === n ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/40")}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <Button type="button" className="h-14 text-base" onClick={toggle} aria-pressed={on}>{on ? t("practice.stop") : t("practice.start")}</Button>
      </section>
    </div>
  );
}

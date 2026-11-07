import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { Mic, MicOff, X, Check, Music2, Square } from "lucide-react";
import { Dialog, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTuner } from "@/hooks/useTuner";
import { useReferenceTone } from "@/hooks/useReferenceTone";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function Tuner({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const { status, reading, start, stop } = useTuner();
  const reference = useReferenceTone();
  useEffect(() => { void start(); }, [start]);
  const active = status === "listening";
  const tuned = !!reading && Math.abs(reading.cents) <= 5;
  const cents = reading ? Math.round(reading.cents) : null;
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const message = status === "denied" || status === "unavailable" || status === "failed" ? t(`tuner.${status}`) : t(active ? "tuner.listening" : status === "starting" ? "tuner.starting" : "tuner.idle");

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogPortal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-background" />
      <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <DialogTitle className="font-serif text-2xl">{t("tuner.title")}</DialogTitle>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onClose} aria-label={t("common.close")}><X /></Button>
        </header>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-6 sm:px-10">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t("tuner.chromatic")}</p>
            <div className={cn("mt-4 flex h-28 items-baseline justify-center font-numeric", tuned ? "text-success" : "text-foreground")} aria-live="off">
              <span className="text-8xl font-medium leading-none">{reading ? names[reading.noteIndex][0] : "—"}</span>
              {reading && names[reading.noteIndex][1] && <span className="self-start pt-2 text-4xl">♯</span>}
              <span className="ml-1 text-2xl text-muted-foreground">{reading?.octave}</span>
            </div>
            <p className="h-6 font-numeric text-sm tabular-nums text-muted-foreground">{reading ? `${number.format(reading.frequency)} Hz` : "— Hz"}</p>
          </div>

          <div className="space-y-4">
            <svg viewBox="0 0 400 150" className="mx-auto w-full overflow-visible" role="img" aria-label={t("tuner.meter")}>
              <path d="M 35 110 Q 200 -40 365 110" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
              {Array.from({ length: 21 }, (_, i) => {
                const angle = (-60 + i * 6) * Math.PI / 180;
                return <line key={i} x1={200 + Math.sin(angle) * 170} y1={190 - Math.cos(angle) * 170} x2={200 + Math.sin(angle) * (i % 5 === 0 ? 146 : 158)} y2={190 - Math.cos(angle) * (i % 5 === 0 ? 146 : 158)} stroke="currentColor" strokeWidth={i === 10 ? 3 : 1.5} className={i === 10 ? "text-success" : "text-muted-foreground"} />;
              })}
              <g transform={`rotate(${reading ? reading.cents * 1.2 : 0} 200 190)`} className={cn("transition-transform duration-150 motion-reduce:transition-none", reading ? tuned ? "text-success" : "text-primary" : "text-border")}>
                <line x1="200" y1="142" x2="200" y2="38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M 195 43 L 200 29 L 205 43 Z" fill="currentColor" />
              </g>
            </svg>
            <div className="flex justify-between font-numeric text-xs text-muted-foreground" aria-hidden="true"><span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span></div>
            <div className="grid grid-cols-3 items-center gap-2 text-center text-sm">
              <span className={cn(reading && reading.cents < -5 ? "font-medium text-primary" : "text-muted-foreground")}>♭ {t("tuner.flat")}</span>
              <span className={cn("flex h-12 items-center justify-center gap-1 font-numeric tabular-nums", tuned ? "text-success" : "text-foreground")}>
                {tuned && <Check className="h-4 w-4" />}{cents === null ? "—" : `${cents > 0 ? "+" : ""}${cents}`} {t("tuner.cents")}
              </span>
              <span className={cn(reading && reading.cents > 5 ? "font-medium text-primary" : "text-muted-foreground")}>{t("tuner.sharp")} ♯</span>
            </div>
            <p className={cn("h-6 text-center text-sm", tuned ? "text-success" : "text-muted-foreground")}>{tuned ? t("tuner.inTune") : "A4 = 440 Hz"}</p>
          </div>

          <div className="space-y-4 border-t border-border pt-6 text-center">
            <p role="status" className="min-h-10 text-sm text-muted-foreground">{message}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button className="min-h-12 gap-2 px-6" disabled={status === "starting"} onClick={() => { reference.stop(); if (active) stop(); else void start(); }}>{active ? <MicOff /> : <Mic />}{t(active ? "tuner.stop" : "tuner.start")}</Button>
              <Button variant={reference.playing ? "secondary" : "outline"} className="min-h-12 gap-2 px-6" disabled={status === "starting"} aria-pressed={reference.playing} onClick={() => { stop(); void reference.toggle().catch(() => toast.error(t("practice.referenceError"))); }}>
                {reference.playing ? <Square /> : <Music2 />}{t(reference.playing ? "practice.stopReference" : "practice.playReference")}
              </Button>
            </div>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  </Dialog>;
}

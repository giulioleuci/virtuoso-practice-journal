import { cn } from "@/lib/utils";

export function BeatDots({ on, pulse, beatsPerBar }: { on: boolean; pulse: number; beatsPerBar: number }) {
  return (
    <div className="flex flex-wrap gap-1.5 self-center" aria-hidden="true">
      {Array.from({ length: beatsPerBar }).map((_, i) => {
        const active = on && pulse > 0 && (pulse - 1) % beatsPerBar === i;
        const accent = i === 0;
        return (
          <span key={active ? `beat-${pulse}` : i} data-beat-mark={active ? pulse : undefined} className={cn("h-3.5 w-3.5 rounded-full border", accent ? "border-primary" : "border-muted-foreground/40", active ? cn("animate-beat-flash", accent ? "bg-primary" : "bg-foreground/70") : "bg-transparent")} />
        );
      })}
    </div>
  );
}

/** Swings to the other side on every scheduled beat, so it cannot drift from the click; reduced motion hides it and the beat dots carry the pulse. */
export function Pendulum({ on, pulse, bpm, beatsPerBar, className }: { on: boolean; pulse: number; bpm: number; beatsPerBar: number; className?: string }) {
  const accent = pulse > 0 && (pulse - 1) % beatsPerBar === 0;
  return (
    <div className={cn("relative h-16 overflow-hidden motion-reduce:invisible", className)} aria-hidden="true">
      <div data-pendulum className="metronome-pendulum absolute bottom-1 left-1/2 h-12 w-1 rounded-full bg-primary"
        style={{ transform: `translateX(-50%) rotate(${on && pulse ? (pulse % 2 ? 28 : -28) : 0}deg)`, transition: `transform ${60000 / bpm}ms ease-in-out` }}>
        <span className={cn("absolute -left-2 -top-1 h-5 w-5 rounded-full border-2 border-primary", accent ? "bg-primary" : "bg-background")} />
      </div>
    </div>
  );
}

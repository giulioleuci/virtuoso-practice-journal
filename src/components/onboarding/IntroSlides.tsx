import { useState } from "react";
import { BookOpen, Music2, CalendarDays, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Slide {
  icon: React.FC<{ className?: string }>;
  titleKey: string;
  bodyKey: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    icon: BookOpen,
    titleKey: "intro.slide1.title",
    bodyKey: "intro.slide1.body",
    accent: "text-primary",
  },
  {
    icon: Music2,
    titleKey: "intro.slide2.title",
    bodyKey: "intro.slide2.body",
    accent: "text-[hsl(var(--key-sage))]",
  },
  {
    icon: CalendarDays,
    titleKey: "intro.slide3.title",
    bodyKey: "intro.slide3.body",
    accent: "text-[hsl(var(--key-gold))]",
  },
  {
    icon: Sparkles,
    titleKey: "intro.slide4.title",
    bodyKey: "intro.slide4.body",
    accent: "text-[hsl(var(--key-plum))]",
  },
];

export default function IntroSlides({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const Icon = slide.icon;
  const isLast = current === SLIDES.length - 1;

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Skip button — top right, discreet */}
      <header className="flex justify-end px-6 pt-8">
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("intro.skip")}
        </button>
      </header>

      {/* Slide content */}
      <main
        key={current}
        className="flex-1 flex flex-col items-center justify-center px-8 pb-8 animate-fade-in"
      >
        {/* Large icon */}
        <div className="paper-card w-28 h-28 flex items-center justify-center mb-10 shadow-raised">
          <Icon className={cn("h-12 w-12", slide.accent)} />
        </div>

        {/* Slide number / progress dots */}
        <div className="flex gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i === current
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-border"
              )}
            />
          ))}
        </div>

        <h2 className="font-serif text-3xl text-center mb-4 leading-tight">
          {t(slide.titleKey)}
        </h2>
        <p className="text-muted-foreground text-center text-base leading-relaxed max-w-xs">
          {t(slide.bodyKey)}
        </p>
      </main>

      {/* Navigation footer */}
      <footer className="px-6 pt-2" style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-3 max-w-sm mx-auto">
          {current > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrent(current - 1)}
              className="shrink-0"
              aria-label={t("common.back")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="w-10 shrink-0" />
          )}

          <Button
            onClick={isLast ? onDone : () => setCurrent(current + 1)}
            className="flex-1"
          >
            {isLast ? (
              t("intro.getStarted")
            ) : (
              <span className="flex items-center gap-1">
                {t("common.next")} <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

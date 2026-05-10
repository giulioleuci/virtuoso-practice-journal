import { useMemo, useState } from "react";
import { Piano, BookOpen, Check, X, Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, type Lang, type SubjectType } from "@/lib/db";
import { SUPPORTED_LANGS, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface DraftSubject { name: string; type: SubjectType }

const INSTRUMENT_KEYS = ["piano", "guitar", "flute", "ensemble", "violin", "singing"] as const;
const THEORY_KEYS = ["harmony", "earTraining", "solfeggio", "history"] as const;

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { t, setLang, lang } = useI18n();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<DraftSubject[]>([]);
  const [customInstrument, setCustomInstrument] = useState("");
  const [customTheory, setCustomTheory] = useState("");
  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderFreq, setReminderFreq] = useState<"daily" | "weekdays" | "custom">("daily");
  const [reminderDays, setReminderDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const DAYS = useMemo(() => [0,1,2,3,4,5,6].map((i) => t(`weekday.${i}`)), [lang]);

  const PRESET_INSTRUMENTS = useMemo(
    () => INSTRUMENT_KEYS.map((k) => ({ name: t(`preset.${k}`), type: "instrument" as SubjectType })),
    [lang]
  );
  const PRESET_THEORY = useMemo(
    () => THEORY_KEYS.map((k) => ({ name: t(`preset.${k}`), type: "theory" as SubjectType })),
    [lang]
  );
  const ALL_PRESETS = [...PRESET_INSTRUMENTS, ...PRESET_THEORY];

  const togglePreset = (p: DraftSubject) => {
    setChosen((prev) =>
      prev.find((s) => s.name === p.name) ? prev.filter((s) => s.name !== p.name) : [...prev, p]
    );
  };

  const addCustom = (rawName: string, type: SubjectType, reset: () => void) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    if (chosen.find((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;
    setChosen([...chosen, { name: trimmed, type }]);
    reset();
  };

  const toggleDay = (d: number) =>
    setReminderDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const finish = async (opts?: { remindersDisabled?: boolean }) => {
    const now = Date.now();
    const remindersDisabled = !!opts?.remindersDisabled;
    await db.transaction("rw", db.subjects, db.profile, async () => {
      await db.subjects.bulkAdd(chosen.map((s) => ({ ...s, createdAt: now })));
      await db.profile.put({
        id: "me",
        name: name.trim() || "Musician",
        lang,
        reminderTime,
        reminderFreq,
        reminderDays: reminderFreq === "custom" ? reminderDays : reminderFreq === "weekdays" ? [1,2,3,4,5] : [0,1,2,3,4,5,6],
        reminderEnabled: !remindersDisabled,
        lateRecoveryDays: 3,
        graceDay: true,
        groupByPhase: false,
        onboarded: true,
        createdAt: now,
      });
    });
    onDone();
  };

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return chosen.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 pt-10 pb-4 max-w-xl w-full mx-auto">
        <div className="flex items-center gap-2 mb-1">
          {[0,1,2,3].map((i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </header>

      <main className="flex-1 px-6 max-w-xl w-full mx-auto pb-32 animate-fade-in">
        {step === 0 && (
          <section>
            <h2 className="font-serif text-4xl mb-1">{t("onb.welcome")}</h2>
            <p className="text-muted-foreground mb-8">{t("onb.welcome.sub")}</p>
            <p className="text-sm font-medium mb-3 uppercase tracking-wider text-muted-foreground">{t("onb.lang")}</p>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code as Lang)}
                  className={cn(
                    "paper-card px-4 py-4 text-left transition-all",
                    lang === l.code ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
                  )}
                >
                  <div className="font-serif text-2xl">{l.label}</div>
                  <div className="text-xs text-muted-foreground tracking-widest">{l.flag}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <h2 className="font-serif text-4xl mb-8">{t("onb.name")}</h2>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("onb.name.ph")}
              className="text-lg h-14 bg-card border-border"
              autoFocus
            />
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 className="font-serif text-4xl mb-1">{t("onb.subjects")}</h2>
            <p className="text-muted-foreground mb-6">{t("onb.subjects.sub")}</p>

            <SubjectGroup
              icon={<Piano className="h-5 w-5 text-primary" />}
              title={t("onb.subjects.instruments")}
              presets={PRESET_INSTRUMENTS}
              chosen={chosen}
              onToggle={togglePreset}
              customValue={customInstrument}
              setCustomValue={setCustomInstrument}
              customPlaceholder={t("onb.subjects.newInstrument")}
              addLabel={t("onb.subjects.addInstrument")}
              onAdd={() => addCustom(customInstrument, "instrument", () => setCustomInstrument(""))}
              extraChips={chosen.filter((s) => s.type === "instrument" && !ALL_PRESETS.find((p) => p.name === s.name))}
              onRemoveChip={(n) => setChosen(chosen.filter((x) => x.name !== n))}
            />

            <div className="h-6" />

            <SubjectGroup
              icon={<BookOpen className="h-5 w-5 text-primary" />}
              title={t("onb.subjects.theory")}
              presets={PRESET_THEORY}
              chosen={chosen}
              onToggle={togglePreset}
              customValue={customTheory}
              setCustomValue={setCustomTheory}
              customPlaceholder={t("onb.subjects.newTheory")}
              addLabel={t("onb.subjects.addTheory")}
              onAdd={() => addCustom(customTheory, "theory", () => setCustomTheory(""))}
              extraChips={chosen.filter((s) => s.type === "theory" && !ALL_PRESETS.find((p) => p.name === s.name))}
              onRemoveChip={(n) => setChosen(chosen.filter((x) => x.name !== n))}
            />
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 className="font-serif text-4xl mb-1 flex items-center gap-2">
              <Bell className="h-7 w-7 text-primary" /> {t("onb.reminder")}
            </h2>
            <p className="text-muted-foreground mb-8">{t("onb.reminder.sub")}</p>

            <div className="paper-card p-6 mb-4">
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="font-serif text-5xl bg-transparent border-0 outline-none w-full text-center tabular-nums"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["daily","weekdays","custom"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setReminderFreq(f)}
                  className={cn(
                    "paper-card py-3 text-sm font-medium transition-all",
                    reminderFreq === f ? "ring-2 ring-primary" : "hover:-translate-y-0.5"
                  )}
                >
                  {t(`onb.freq.${f}`)}
                </button>
              ))}
            </div>

            {reminderFreq === "custom" && (
              <div className="flex gap-2 justify-between">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "h-11 w-11 rounded-full font-medium transition-colors",
                      reminderDays.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-muted-foreground"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => finish({ remindersDisabled: true })}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-4 transition-colors"
              >
                {t("onb.reminder.none")}
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 px-6 py-4 bg-background/80 backdrop-blur border-t border-border">
        <div className="max-w-xl mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex-1">
              {t("onb.back")}
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="flex-1">
              {t("onb.continue")}
            </Button>
          ) : (
            <Button onClick={() => finish()} className="flex-1">
              {t("onb.finish")}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

interface SubjectGroupProps {
  icon: React.ReactNode;
  title: string;
  presets: DraftSubject[];
  chosen: DraftSubject[];
  onToggle: (p: DraftSubject) => void;
  customValue: string;
  setCustomValue: (v: string) => void;
  customPlaceholder: string;
  addLabel: string;
  onAdd: () => void;
  extraChips: DraftSubject[];
  onRemoveChip: (name: string) => void;
}

function SubjectGroup({
  icon, title, presets, chosen, onToggle,
  customValue, setCustomValue, customPlaceholder, addLabel, onAdd,
  extraChips, onRemoveChip,
}: SubjectGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-serif text-xl">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {presets.map((p) => {
          const active = !!chosen.find((s) => s.name === p.name);
          return (
            <button
              key={p.name}
              onClick={() => onToggle(p)}
              className={cn(
                "paper-card px-3 py-2.5 flex items-center gap-2 text-left transition-all min-w-0",
                active ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
              )}
            >
              <span className="font-medium truncate">{p.name}</span>
              {active && <Check className="h-4 w-4 ml-auto shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>

      {extraChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {extraChips.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1 bg-accent px-3 py-1.5 rounded-full text-sm">
              {s.name}
              <button onClick={() => onRemoveChip(s.name)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="paper-card p-2 flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={customPlaceholder}
          className="border-0 bg-transparent focus-visible:ring-0 min-w-0"
        />
        <Button
          variant="secondary"
          onClick={onAdd}
          disabled={!customValue.trim()}
          className="shrink-0 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-1" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { exportAll, importAll, wipeAll } from "@/lib/db";
import { profileService } from "@/lib/services";
import { saveTextFile, pickTextFile, scheduleReminders, ensureNotificationPermission, isNative } from "@/lib/platform";
import { useI18n, SUPPORTED_LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Download, Upload, Trash2, FlaskConical, Pencil, PlayCircle,
  Bell, Languages, Settings2, Database, AlertTriangle, BookMarked, User, Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SubjectsEditor } from "@/components/profile/SubjectsEditor";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const APP_VERSION = "0.3alpha";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const profile = useLiveQuery(() => profileService.get());
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);

  // Reflect reminder preferences in scheduled OS-level notifications when running natively.
  const reminderDaysKey = profile?.reminderDays?.join(",") ?? "";
  useEffect(() => {
    if (!profile) return;
    const enabled = profile.reminderEnabled !== false;
    if (!enabled) {
      scheduleReminders(null).catch(() => undefined);
      return;
    }
    const days = profile.reminderFreq === "weekdays"
      ? [1, 2, 3, 4, 5]
      : profile.reminderFreq === "custom"
        ? (profile.reminderDays ?? [1, 2, 3, 4, 5])
        : [0, 1, 2, 3, 4, 5, 6];
    scheduleReminders({
      time: profile.reminderTime,
      days,
      title: t("app.name"),
      body: t("profile.reminderBody"),
    }).catch(() => undefined);
    // reminderDaysKey is a stable derivation of profile.reminderDays
  }, [profile, reminderDaysKey, t]);

  if (!profile) return null;

  const update = async (patch: Partial<typeof profile>) => {
    await profileService.update(patch);
  };

  const onExport = async () => {
    try {
      const json = await exportAll();
      await saveTextFile(`virtuoso-backup-${new Date().toISOString().slice(0, 10)}.json`, json);
      toast.success(t("toast.exported"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.couldNotSave"));
    }
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      await importAll(text);
      toast.success(t("toast.imported"));
    } catch {
      toast.error(t("errors.invalidFile"));
    }
  };

  const onImportNative = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      await importAll(text);
      toast.success(t("toast.imported"));
    } catch {
      toast.error(t("errors.invalidFile"));
    }
  };

  const remindersOn = profile.reminderEnabled !== false;

  return (
    <div className="space-y-5 pb-8">
      {/* Identity hero */}
      <section className="paper-card p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-accent/70 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("nav.profile")}
            </p>
            <div className="flex items-center gap-1.5">
              <h1 className="font-serif text-2xl truncate">
                {profile.name || <span className="italic text-muted-foreground">{t("profile.unnamed")}</span>}
              </h1>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("profile.editName")}
                onClick={() => { setNameDraft(profile.name ?? ""); setEditingName(true); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={editingName} onOpenChange={setEditingName}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profile.editName")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={nameDraft}
            placeholder={t("onb.name.ph")}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                update({ name: nameDraft.trim() }).then(() => {
                  setEditingName(false);
                  toast.success(t("toast.nameSaved"));
                });
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingName(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={async () => {
                await update({ name: nameDraft.trim() });
                setEditingName(false);
                toast.success(t("toast.nameSaved"));
              }}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick preferences: language + reminders, always visible */}
      <section className="paper-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{t("onb.lang")}</span>
          </div>
          <select
            value={lang}
            onChange={async (e) => {
              const v = e.target.value as typeof lang;
              setLang(v);
              await update({ lang: v });
            }}
            className="bg-background border border-border rounded-md px-2 py-1.5 text-sm shrink-0"
          >
            {SUPPORTED_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="h-px bg-border/60" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{t("profile.reminderEnabled")}</span>
          </div>
          <Switch
            checked={remindersOn}
            onCheckedChange={async (v) => {
              if (v) {
                const ok = await ensureNotificationPermission();
                if (!ok) {
                  toast.error(t("profile.reminderPermissionDenied"));
                  return;
                }
              }
              await update({ reminderEnabled: v });
            }}
          />
        </div>

        {remindersOn && (
          <div className="space-y-3 pl-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t("profile.reminder")}</span>
              <input
                type="time"
                value={profile.reminderTime}
                onChange={(e) => update({ reminderTime: e.target.value })}
                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm tabular-nums"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(["daily", "weekdays", "custom"] as const).map((f) => {
                const active = (profile.reminderFreq ?? "daily") === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      const days = f === "custom"
                        ? (profile.reminderDays?.length ? profile.reminderDays : [1, 2, 3, 4, 5])
                        : f === "weekdays" ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
                      update({ reminderFreq: f, reminderDays: days });
                    }}
                    title={t(`onb.freq.${f}`)}
                    className={
                      "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors overflow-hidden truncate " +
                      (active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-accent")
                    }
                  >
                    {t(`onb.freq.${f}`)}
                  </button>
                );
              })}
            </div>

            {(profile.reminderFreq ?? "daily") === "custom" && (
              <div className="flex justify-between gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const sel = profile.reminderDays?.includes(i) ?? false;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const cur = profile.reminderDays ?? [];
                        const next = sel ? cur.filter((d) => d !== i) : [...cur, i].sort();
                        update({ reminderDays: next });
                      }}
                      className={
                        "h-9 w-9 rounded-full text-xs font-medium transition-colors " +
                        (sel
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border border-border text-muted-foreground")
                      }
                      aria-pressed={sel}
                    >
                      {t(`weekday.${i}`).slice(0, 1)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Subjects, layers & techniques */}
      <SubjectsEditor />

      {/* Grouped collapsibles */}
      <Accordion type="multiple" className="space-y-3">
        <AccordionItem value="practice" className="paper-card border-0 px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="flex items-center gap-2 font-serif text-base">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              {t("profile.settings")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <Row label={t("profile.lateRecovery")}>
              <input
                type="number" min={0} max={14}
                value={profile.lateRecoveryDays}
                onChange={(e) => update({ lateRecoveryDays: Number(e.target.value) })}
                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm w-20 tabular-nums"
              />
            </Row>
            <Row label={t("profile.carryover")}>
              <input
                type="number" min={0} max={14}
                value={profile.carryoverDays ?? 2}
                onChange={(e) => update({ carryoverDays: Number(e.target.value) })}
                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm w-20 tabular-nums"
              />
            </Row>
            <Row label={t("profile.graceDay")}>
              <Switch checked={profile.graceDay} onCheckedChange={(v) => update({ graceDay: v })} />
            </Row>
            <Row label={t("profile.groupByPhase")}>
              <Switch checked={profile.groupByPhase} onCheckedChange={(v) => update({ groupByPhase: v })} />
            </Row>
            <div className="pt-1">
              <Button variant="outline" size="sm" className="w-full" onClick={() => update({ introSeen: false })}>
                <PlayCircle className="h-4 w-4 mr-2" />{t("profile.introTour")}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="data" className="paper-card border-0 px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="flex items-center gap-2 font-serif text-base">
              <Database className="h-4 w-4 text-muted-foreground" />
              {t("profile.data")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onExport} className="w-full">
                <Download className="h-4 w-4 mr-2" />{t("profile.export")}
              </Button>
              <Button variant="outline" onClick={() => (isNative() ? onImportNative() : fileRef.current?.click())} className="w-full">
                <Upload className="h-4 w-4 mr-2" />{t("profile.import")}
              </Button>
            </div>
            <input
              ref={fileRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset so picking the same file twice still fires onChange
                e.target.value = "";
                if (file) onImport(file);
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dev" className="paper-card border-0 px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="flex items-center gap-2 font-serif text-base">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              {t("profile.dev")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <p className="text-xs text-muted-foreground italic">{t("profile.devDesc")}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (!confirm(t("profile.sampleDataWarning"))) return;
                const { seedSampleData } = await import("@/lib/sampleData");
                await seedSampleData();
                toast.success(t("toast.sampleDataCreated"));
                setTimeout(() => location.reload(), 400);
              }}
            >
              <BookMarked className="h-4 w-4 mr-2" /> {t("profile.createSampleData")}
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="danger" className="paper-card border-0 border-destructive/30 px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="flex items-center gap-2 font-serif text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t("profile.wipe")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {!confirming ? (
              <Button variant="destructive" className="w-full" onClick={() => setConfirming(true)}>
                <Trash2 className="h-4 w-4 mr-2" />{t("profile.wipe")}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const [pre, post] = t("profile.typeDelete").split("DELETE");
                    return <>{pre}<code className="px-1 bg-muted rounded">DELETE</code>{post}</>;
                  })()}
                </p>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => { setConfirming(false); setConfirmText(""); }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={confirmText !== "DELETE"}
                    onClick={async () => {
                      await wipeAll();
                      location.reload();
                    }}
                  >
                    {t("common.confirm")}
                  </Button>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          {t("profile.about")}
        </button>
      </div>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("app.name")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground italic">{t("app.tagline")}</p>
            <p className="text-sm">{t("profile.aboutDescription")}</p>
            <p className="text-xs text-muted-foreground">
              {t("profile.version")} {APP_VERSION}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="w-full" onClick={() => setAboutOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm flex-1 min-w-0">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

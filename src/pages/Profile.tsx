import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { profileService } from "@/lib/services";
import type { ImportSummary } from "@/application/useCases/importBackup";
import { applicationCommands } from "@/lib/applicationCommands";
import { ensureNotificationPermission, isNative } from "@/lib/platform";
import { getDefaultWeekStartsOn } from "@/lib/date";
import { useI18n, SUPPORTED_LANGS } from "@/lib/i18n";
import { useProfile } from "@/presentation/hooks/useEntities";
import { useBackupCommands, useSessionSubmission } from "@/presentation/hooks/usePresentationControllers";
import { REMINDER_PRESETS, getReminderBodies, type ReminderPreset } from "@/lib/reminderPresets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Download, Upload, Trash2, FlaskConical, Pencil,
  Bell, Languages, BookMarked, User, Info, FileSpreadsheet,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { nativeSelect } from "@/components/diary/WhenFields";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AudioNotice } from "@/components/diary/Recorder";

const APP_VERSION = "0.3alpha";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const profile = useProfile();
  const [csvFrom, setCsvFrom] = useState("");
  const [csvTo, setCsvTo] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [wiping, setWiping] = useState(false);
  const { submit: saveProfile, submitting: saving, error: saveError } = useSessionSubmission(profileService.update);

  const runSeed = async (set: "full" | "guitar") => {
    if (seeding || !confirm(t("profile.sampleDataWarning"))) return;
    setSeeding(true);
    try {
      if (set === "full") {
        const { seedSampleData } = await import("@/lib/sampleData");
        await seedSampleData();
      } else {
        const { seedGuitarSampleData } = await import("@/lib/sampleDataGuitar");
        await seedGuitarSampleData();
      }
      setSampleOpen(false);
      toast.success(t("toast.sampleDataCreated"));
      setTimeout(() => location.reload(), 400);
    } catch {
      setSeeding(false);
      toast.error(t("profile.sampleFailed"));
    }
  };
  const backup = useBackupCommands({
    exportBackup: () => applicationCommands.backups.export.execute(),
    importBackup: () => applicationCommands.backups.import.execute(),
  });

  if (!profile) return <div className="paper-skeleton h-40" />;

  const update = async (patch: Partial<typeof profile>) => {
    const saved = await saveProfile(patch);
    if (!saved) toast.error(t("errors.couldNotSave"));
    return saved;
  };

  const saveName = async () => {
    if (saving) return;
    if (await update({ name: nameDraft.trim() })) {
      setEditingName(false); toast.success(t("toast.nameSaved"));
    }
  };

  const onExport = async () => {
    const result = await backup.exportBackup();
    if (result.ok) toast.success(t("toast.exported"));
    else toast.error(result.error || t("errors.couldNotSave"));
  };

  const onExportCsv = async () => {
    try {
      await applicationCommands.backups.csv.execute(csvFrom || undefined, csvTo || undefined);
      toast.success(t("toast.csvExported"));
    } catch (error) {
      toast.error((error as Error).message || t("errors.couldNotSave"));
    }
  };

  const onImport = async () => {
    if (backup.progress !== "idle") return;
    const result = await backup.importBackup();
    setImportOpen(false);
    const summary = result.ok ? (result.value as ImportSummary | null) : null;
    if (summary) toast.success(summary.recordings ? t("toast.importedClips", { available: summary.available, missing: summary.recordings - summary.available }) : t("toast.imported"));
    else if (!result.ok) toast.error(t("errors.invalidFile"));
  };

  const remindersOn = profile.reminderEnabled !== false;

  return (
    <div className="pb-8">
      <PageHeader title={t("nav.settings")}  />
      {saveError && !editingName && <p role="alert" className="mb-4 text-sm text-destructive">{t("errors.couldNotSave")}</p>}
      <div className="grid gap-8 min-[901px]:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label={t("settings.navLabel")} className="flex flex-wrap gap-1 min-[901px]:sticky min-[901px]:top-6 min-[901px]:flex-col min-[901px]:self-start">
          {[["preferences", t("settings.preferences")], ["practice", t("profile.settings")], ["data", t("profile.data")], ["advanced", t("profile.dev")]].map(([id, label]) => (
            <a key={id} href={`#settings-${id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 max-[900px]:whitespace-normal text-[0.8125rem] font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">{label}</a>
          ))}
        </nav>
        <div className="min-w-0 max-w-[720px] space-y-10">
      <Dialog open={editingName} onOpenChange={value => { if (!saving) setEditingName(value); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("profile.editName")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            aria-label={t("common.name")}
            maxLength={100}
            disabled={saving}
            value={nameDraft}
            placeholder={t("onb.name.ph")}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveName();
              }
            }}
          />
          {saveError && <p role="alert" className="text-sm text-destructive">{t("errors.couldNotSave")}</p>}
          <DialogFooter>
            <Button disabled={saving} variant="ghost" onClick={() => setEditingName(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={saving}
              onClick={() => void saveName()}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick preferences: language + reminders, always visible */}
      <section id="settings-preferences" className="scroll-mt-6 space-y-3">
        <h2 className="font-serif text-2xl font-semibold">{t("settings.preferences")}</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm [overflow-wrap:anywhere]">{profile.name || <span className="italic text-muted-foreground">{t("common.unnamed")}</span>}</span>
          </div>
          <Button type="button" size="sm" className="min-h-11" variant="outline" aria-label={t("profile.editName")} onClick={() => { setNameDraft(profile.name ?? ""); setEditingName(true); }}>
            <Pencil />{t("common.edit")}
          </Button>
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm break-words">{t("onb.lang")}</span>
          </div>
          <Select value={lang} onValueChange={async (value) => {
              const v = value as typeof lang;
              if (await update({ lang: v })) setLang(v);
            }} ><SelectTrigger aria-label={t("onb.lang")} className={`${nativeSelect} w-36 shrink-0`}><SelectValue /></SelectTrigger><SelectContent>
            {SUPPORTED_LANGS.map((l) => (
              <SelectItem key={l.code} value={String(l.code)}>{l.label}</SelectItem>
            ))}
          </SelectContent></Select>
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm break-words">{t("profile.reminderEnabled")}</span>
          </div>
          <Switch
            aria-label={t("profile.reminderEnabled")}
            checked={remindersOn}
            onCheckedChange={async (v) => {
              if (v && isNative()) {
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
                aria-label={t("profile.reminder")}
                type="time"
                value={profile.reminderTime}
                onChange={(e) => { if (e.target.value) void update({ reminderTime: e.target.value }); }}
                className={nativeSelect}
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5 min-[440px]:grid-cols-3">
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
                    aria-pressed={active}
                    title={t(`onb.freq.${f}`)}
                    className={
                      "min-h-11 rounded-md border px-2 py-2 text-xs font-medium transition-colors break-words " +
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
              <div className="flex flex-wrap gap-1">
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
                        "h-11 w-11 rounded-full text-xs font-medium transition-colors " +
                        (sel
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border border-border text-muted-foreground")
                      }
                      aria-label={t(`weekday.${i}`)}
                      aria-pressed={sel}
                    >
                      {t(`weekday.${i}`).slice(0, 1)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="h-px bg-border" />

            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">{t("profile.reminderMessages")}</span>
              <div className="grid grid-cols-2 gap-1.5 min-[440px]:grid-cols-3">
                {([...REMINDER_PRESETS, "custom"] as ReminderPreset[]).map((p) => {
                  const active = (profile.reminderPreset ?? "gentle") === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update({ reminderPreset: p })}
                      className={
                        "min-h-11 rounded-md border px-2 py-2 text-xs font-medium transition-colors break-words " +
                        (active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-accent")
                      }
                    >
                      {t(`profile.reminderPresets.${p}.label`)}
                    </button>
                  );
                })}
              </div>

              {(profile.reminderPreset ?? "gentle") === "custom" ? (
                <div className="space-y-2 pt-1">
                  <Input
                    aria-label={t("profile.reminderCustomTitle.ph")}
                    value={profile.reminderCustomTitle ?? ""}
                    placeholder={t("profile.reminderCustomTitle.ph")}
                    onChange={(e) => update({ reminderCustomTitle: e.target.value })}
                  />
                  <Input
                    aria-label={t("profile.reminderCustomBody.ph")}
                    value={profile.reminderCustomBody ?? ""}
                    placeholder={t("profile.reminderCustomBody.ph")}
                    onChange={(e) => update({ reminderCustomBody: e.target.value })}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic pt-1">
                  {getReminderBodies(lang, ((profile.reminderPreset ?? "gentle") as Exclude<ReminderPreset, "custom">))[0] ?? ""}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-sm text-muted-foreground">{t("profile.reminderIncludeContext")}</span>
                <Switch
                  aria-label={t("profile.reminderIncludeContext")}
                  checked={profile.reminderIncludeContext ?? false}
                  onCheckedChange={(v) => update({ reminderIncludeContext: v })}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Grouped collapsibles */}
      
        <section id="settings-practice" className="scroll-mt-6 space-y-3 ">
          <h2 className="font-serif text-2xl font-semibold ">{t("profile.settings")}</h2>
            <Row label={t("profile.lateRecovery")}>
              <input
                aria-label={t("profile.lateRecovery")}
                type="number" min={0} max={14}
                value={profile.lateRecoveryDays}
                onChange={(e) => { if (e.target.value && e.target.validity.valid) void update({ lateRecoveryDays: Number(e.target.value) }); }}
                className={`${nativeSelect} w-20 tabular-nums`}
              />
            </Row>
            <Row label={t("profile.carryover")}>
              <input
                aria-label={t("profile.carryover")}
                type="number" min={0} max={14}
                value={profile.carryoverDays ?? 2}
                onChange={(e) => { if (e.target.value && e.target.validity.valid) void update({ carryoverDays: Number(e.target.value) }); }}
                className={`${nativeSelect} w-20 tabular-nums`}
              />
            </Row>
            <Row label={t("profile.weekStartsOn")}>
              <Select value={String(profile.weekStartsOn ?? getDefaultWeekStartsOn(lang) ?? "")} onValueChange={(value) => update({ weekStartsOn: Number(value) })} ><SelectTrigger aria-label={t("profile.weekStartsOn")} className={`${nativeSelect} w-36`}><SelectValue /></SelectTrigger><SelectContent>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <SelectItem key={i} value={String(i)}>{t(`weekday.${i}`)}</SelectItem>
                ))}
              </SelectContent></Select>
            </Row>
            <Row label={t("profile.graceDay")}>
              <Switch aria-label={t("profile.graceDay")} checked={profile.graceDay} onCheckedChange={(v) => update({ graceDay: v })} />
            </Row>
            <Row label={t("profile.groupByPhase")}>
              <Switch aria-label={t("profile.groupByPhase")} checked={profile.groupByPhase} onCheckedChange={(v) => update({ groupByPhase: v })} />
            </Row>
            <Row label={t("profile.hideHeroQuote")}>
              <Switch
                aria-label={t("profile.hideHeroQuote")}
                checked={profile.hideHeroQuote === true}
                onCheckedChange={(v) => update({ hideHeroQuote: v })}
              />
            </Row>
          </section>

        <section id="settings-data" className="scroll-mt-6 space-y-3 ">
          <h2 className="font-serif text-2xl font-semibold ">{t("profile.data")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Button variant="outline" onClick={onExport} disabled={backup.progress !== "idle"} className="w-full">
                  <Download className="h-4 w-4 mr-2" />{t("profile.exportData")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("profile.exportDataHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Button variant="outline" onClick={() => setImportOpen(true)} disabled={backup.progress !== "idle"} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />{t("profile.import")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("profile.importHint")}</p>
              </div>
            </div>
            <div className="border-t border-border pt-4"><AudioNotice /></div>
            <div className="space-y-2 border-t border-border pt-4">
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium">{t("profile.csvFrom")}<Input className="min-w-0" type="date" value={csvFrom} max={csvTo || undefined} onChange={(e) => setCsvFrom(e.target.value)} /></label>
                <label className="grid gap-1 text-xs font-medium">{t("profile.csvTo")}<Input className="min-w-0" type="date" value={csvTo} min={csvFrom || undefined} onChange={(e) => setCsvTo(e.target.value)} /></label>
              </div>
              <p className="text-xs text-muted-foreground">{t("profile.csvHint")}</p>
              <Button variant="outline" onClick={() => void onExportCsv()} className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />{t("profile.exportCsv")}
              </Button>
            </div>
          </section>

        <section id="settings-advanced" className="scroll-mt-6 space-y-3 ">
          <h2 className="font-serif text-2xl font-semibold ">{t("profile.dev")}</h2>
            <p className="text-xs text-muted-foreground italic">{t("profile.devDesc")}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSampleOpen(true)}
            >
              <BookMarked className="h-4 w-4 mr-2" /> {t("profile.createSampleData")}
            </Button>
          </section>

        <section id="settings-danger" className="scroll-mt-6 space-y-3 border-t border-destructive/30 pt-6">
          <h2 className="font-serif text-2xl font-semibold text-destructive">{t("profile.wipe")}</h2>
            {!confirming ? (
              <Button variant="destructive" className="w-full" onClick={() => setConfirming(true)}>
                <Trash2 className="h-4 w-4 mr-2" />{t("profile.wipe")}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{t("profile.wipeAudio")}</p>
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const [pre, post] = t("profile.typeDelete").split("DELETE");
                    return <>{pre}<code className="px-1 bg-muted rounded">DELETE</code>{post}</>;
                  })()}
                </p>
                <Input aria-label={t("profile.typeDelete")} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    disabled={wiping}
                    onClick={() => { setConfirming(false); setConfirmText(""); }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={confirmText !== "DELETE" || wiping}
                    onClick={async () => {
                      if (wiping) return;
                      setWiping(true);
                      try { await applicationCommands.backups.wipe(); location.reload(); }
                      catch { toast.error(t("errors.couldNotSave")); }
                      finally { setWiping(false); }
                    }}
                  >
                    {t("common.confirm")}
                  </Button>
                </div>
              </div>
            )}
          </section>

        <div className="pt-2">
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          {t("profile.about")}
        </button>
        </div>
        </div>
      </div>

      <Dialog open={sampleOpen} onOpenChange={value => { if (!seeding) setSampleOpen(value); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("profile.sampleDataChoose")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {([
              { key: "full" as const, label: t("profile.sampleDataSetFull"), desc: t("profile.sampleDataSetFullDesc") },
              { key: "guitar" as const, label: t("profile.sampleDataSetGuitar"), desc: t("profile.sampleDataSetGuitarDesc") },
            ]).map((o) => (
              <button
                key={o.key}
                type="button"
                disabled={seeding}
                onClick={() => runSeed(o.key)}
                className="w-full text-left rounded-lg border border-border bg-background px-3 py-3 transition-colors hover:bg-accent disabled:opacity-60"
              >
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{o.desc}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="w-full" disabled={seeding} onClick={() => setSampleOpen(false)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={importOpen} onOpenChange={value => { if (backup.progress === "idle") setImportOpen(value); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("profile.import")}</AlertDialogTitle><AlertDialogDescription>{t("profile.importWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={backup.progress !== "idle"}>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={backup.progress !== "idle"} onClick={event => { event.preventDefault(); void onImport(); }}>{t("profile.import")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-sm flex-1 min-w-0">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

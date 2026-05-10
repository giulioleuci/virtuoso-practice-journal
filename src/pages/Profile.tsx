import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, exportAll, importAll, wipeAll } from "@/lib/db";
import { useI18n, SUPPORTED_LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Download, Upload, Trash2, FlaskConical, Pencil, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SubjectsEditor } from "@/components/profile/SubjectsEditor";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { seedSampleData } from "@/lib/sampleData";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const profile = useLiveQuery(() => db.profile.get("me"));
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  if (!profile) return null;

  const update = async (patch: Partial<typeof profile>) => {
    await db.profile.update("me", patch);
  };

  const onExport = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `virtuoso-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("toast.exported"));
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

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("nav.profile")}</p>
        <div className="text-xs text-muted-foreground mb-1">{t("profile.name")}</div>
        <div className="flex items-center justify-between gap-2">
          <div id="profile-name" className="font-serif text-2xl break-words min-w-0">
            {profile.name || <span className="italic text-muted-foreground">{t("profile.unnamed")}</span>}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("profile.editName")}
            onClick={() => { setNameDraft(profile.name ?? ""); setEditingName(true); }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
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
              if (e.key === "Enter") { e.preventDefault(); update({ name: nameDraft.trim() }).then(() => { setEditingName(false); toast.success(t("toast.nameSaved")); }); }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingName(false)}>{t("common.cancel")}</Button>
            <Button onClick={async () => { await update({ name: nameDraft.trim() }); setEditingName(false); toast.success(t("toast.nameSaved")); }}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="paper-card p-5 space-y-4">
        <h3 className="font-serif text-xl">{t("profile.settings")}</h3>

        <Row label={t("onb.lang")}>
          <select
            value={lang}
            onChange={async (e) => { const v = e.target.value as typeof lang; setLang(v); await update({ lang: v }); }}
            className="bg-background border border-border rounded-md px-2 py-1.5 text-sm"
          >
            {SUPPORTED_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </Row>

        <Row label={t("profile.reminderEnabled")}>
          <Switch
            checked={profile.reminderEnabled !== false}
            onCheckedChange={(v) => update({ reminderEnabled: v })}
          />
        </Row>

        {profile.reminderEnabled !== false && (
          <Row label={t("profile.reminder")}>
            <input
              type="time"
              value={profile.reminderTime}
              onChange={(e) => update({ reminderTime: e.target.value })}
              className="bg-background border border-border rounded-md px-2 py-1.5 text-sm tabular-nums"
            />
          </Row>
        )}

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ introSeen: false })}
          >
            <PlayCircle className="h-4 w-4 mr-2" />{t("profile.introTour")}
          </Button>
        </div>
      </section>

      <SubjectsEditor />
      <section className="paper-card p-5 space-y-3">
        <h3 className="font-serif text-xl">{t("profile.data")}</h3>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={onExport}><Download className="h-4 w-4 mr-2" />{t("profile.export")}</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />{t("profile.import")}</Button>
          <input
            ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />
        </div>
      </section>

      <section className="paper-card p-5 space-y-3 border-destructive/30">
        <h3 className="font-serif text-xl text-destructive">{t("profile.wipe")}</h3>
        {!confirming ? (
          <Button variant="destructive" onClick={() => setConfirming(true)}>
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
              <Button variant="ghost" onClick={() => { setConfirming(false); setConfirmText(""); }}>{t("common.cancel")}</Button>
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE"}
                onClick={async () => {
                  await wipeAll();
                  location.reload();
                }}
              >{t("common.confirm")}</Button>
            </div>
          </div>
        )}
      </section>

      <Accordion type="single" collapsible>
        <AccordionItem value="dev" className="paper-card px-5 border-0">
          <AccordionTrigger className="font-serif text-lg hover:no-underline">
            <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> {t("profile.dev")}</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground italic">
              {t("profile.devDesc")}
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm(t("profile.sampleDataWarning"))) return;
                await seedSampleData();
                toast.success(t("toast.sampleDataCreated"));
                setTimeout(() => location.reload(), 400);
              }}
            >
              <FlaskConical className="h-4 w-4 mr-2" /> {t("profile.createSampleData")}
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

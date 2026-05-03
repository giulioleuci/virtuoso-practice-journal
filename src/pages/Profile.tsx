import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, exportAll, importAll, wipeAll } from "@/lib/db";
import { useI18n, SUPPORTED_LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Download, Upload, Trash2 } from "lucide-react";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const profile = useLiveQuery(() => db.profile.get("me"));
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);

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
    toast.success("Exported");
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      await importAll(text);
      toast.success("Imported");
    } catch {
      toast.error("Invalid file");
    }
  };

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("nav.profile")}</p>
        <Input
          value={profile.name}
          onChange={(e) => update({ name: e.target.value })}
          className="font-serif text-2xl bg-transparent border-0 px-0 focus-visible:ring-0 h-auto"
        />
      </section>

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

        <Row label="Reminder">
          <input
            type="time"
            value={profile.reminderTime}
            onChange={(e) => update({ reminderTime: e.target.value })}
            className="bg-background border border-border rounded-md px-2 py-1.5 text-sm tabular-nums"
          />
        </Row>

        <Row label="Late recovery (days)">
          <input
            type="number" min={0} max={14}
            value={profile.lateRecoveryDays}
            onChange={(e) => update({ lateRecoveryDays: Number(e.target.value) })}
            className="bg-background border border-border rounded-md px-2 py-1.5 text-sm w-20 tabular-nums"
          />
        </Row>

        <Row label="Grace day for streak">
          <Switch checked={profile.graceDay} onCheckedChange={(v) => update({ graceDay: v })} />
        </Row>

        <Row label="Group by phase">
          <Switch checked={profile.groupByPhase} onCheckedChange={(v) => update({ groupByPhase: v })} />
        </Row>
      </section>

      <section className="paper-card p-5 space-y-3">
        <h3 className="font-serif text-xl">Data</h3>
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
            <p className="text-sm text-muted-foreground">Type <code className="px-1 bg-muted rounded">DELETE</code> to confirm.</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setConfirming(false); setConfirmText(""); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE"}
                onClick={async () => {
                  await wipeAll();
                  location.reload();
                }}
              >Confirm</Button>
            </div>
          </div>
        )}
      </section>
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

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Recording } from "@/domain/entities/session";
import { AudioError, type AudioDraft } from "@/domain/ports/audio";
import { applicationCommands } from "@/lib/applicationCommands";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { nativeSelect } from "./WhenFields";

type Section = { id: number; label: string };

/** The data-only contract, visible next to every recorder and clip list. */
export function AudioNotice() {
  const { t } = useI18n();
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>{t("audio.notice")}</p>
      <p>{t("audio.loss")}</p>
    </div>
  );
}

/** Explicit record/stop; a finished clip is already stored on the device when `onClip` receives it. */
export function Recorder({ sections, onClip }: { sections: Section[]; onClip: (clip: AudioDraft) => void | Promise<void> }) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [segmentId, setSegmentId] = useState<number | undefined>();
  const fail = (error: unknown) => toast.error(t(`audio.error.${error instanceof AudioError ? error.code : "unsupported"}`));
  const stop = async (interrupted = false) => {
    setRecording(false);
    try {
      const clip = await applicationCommands.audio.stop();
      await onClip({ ...clip, segmentId });
      if (interrupted) toast(t("audio.error.interrupted"));
    } catch (error) { fail(error); }
  };
  const start = async () => {
    try { await applicationCommands.audio.start(() => void stop(true)); setRecording(true); } catch (error) { fail(error); }
  };
  return (
    <div className="space-y-3">
      <AudioNotice />
      <div className="flex flex-wrap items-center gap-2">
        {sections.length > 0 && (
          <select aria-label={t("audio.segment")} value={segmentId ?? ""} disabled={recording} onChange={(e) => setSegmentId(e.target.value ? Number(e.target.value) : undefined)} className={nativeSelect}>
            <option value="">{t("audio.noSegment")}</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        {recording
          ? <Button type="button" variant="destructive" onClick={() => void stop()}><Square />{t("audio.stop")}</Button>
          : <Button type="button" variant="outline" onClick={() => void start()}><Mic />{t("audio.record")}</Button>}
        {recording && <span role="status" className="text-sm font-medium text-destructive">{t("audio.recording")}</span>}
      </div>
    </div>
  );
}

/** Native player for one local clip; starting it pauses every other clip, so two takes can be compared back to back. */
export function ClipPlayer({ uid, label }: { uid: string; label: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null | undefined>();
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void applicationCommands.audio.url(uid).then((u) => { url = u; if (live) setSrc(u); else if (u) applicationCommands.audio.release(u); });
    return () => { live = false; if (url) applicationCommands.audio.release(url); };
  }, [uid]);
  if (src === undefined) return null;
  if (src === null) return <p className="text-xs text-muted-foreground">{t("audio.unavailable")}</p>;
  return <audio ref={ref} controls preload="metadata" src={src} aria-label={label} className="w-full" onPlay={() => document.querySelectorAll("audio").forEach((el) => { if (el !== ref.current) el.pause(); })} />;
}

/** Clips of a session being logged: stored on the device, saved with the session, discarded explicitly. */
export function ClipDrafts({ clips, onChange, sections }: { clips: AudioDraft[]; onChange: (clips: AudioDraft[]) => void; sections: Section[] }) {
  const { t } = useI18n();
  const discard = (uid: string) => { void applicationCommands.audio.discard([uid]); onChange(clips.filter((c) => c.uid !== uid)); };
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t("audio.title")}</h3>
      <Recorder sections={sections} onClip={(clip) => onChange([...clips, clip])} />
      {clips.length > 0 && (
        <ul className="space-y-3">
          {clips.map((clip) => (
            <li key={clip.uid} className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t("audio.draft")}{clip.segmentId !== undefined ? ` · ${sections.find((s) => s.id === clip.segmentId)?.label ?? ""}` : ""}</p>
              <div className="flex items-center gap-2">
                <Input value={clip.title ?? ""} maxLength={160} aria-label={t("audio.rename")} placeholder={t("audio.rename")} onChange={(e) => onChange(clips.map((c) => (c.uid === clip.uid ? { ...c, title: e.target.value || undefined } : c)))} />
                <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label={t("audio.discard")} onClick={() => discard(clip.uid)}><Trash2 /></Button>
              </div>
              <ClipPlayer uid={clip.uid} label={clip.title ?? t("audio.draft")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Saved clips: play, rename, delete (metadata and audio together). */
export function ClipList({ recordings, sections }: { recordings: Recording[]; sections: Section[] }) {
  const { t, lang } = useI18n();
  const [confirm, setConfirm] = useState<Recording | null>(null);
  return (
    <>
      <ul className="space-y-4">
        {recordings.map((r) => {
          const label = r.title ?? [formatDate(r.date, lang, "medium"), sections.find((s) => s.id === r.segmentId)?.label].filter(Boolean).join(" · ");
          return (
            <li key={r.uid} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Input defaultValue={r.title ?? ""} placeholder={label} maxLength={160} aria-label={t("audio.rename")} onBlur={(e) => void applicationCommands.recordings.rename(r.id!, e.target.value.trim() || undefined)} />
                <Button type="button" size="icon" variant="ghost" className="h-11 w-11 hover:text-destructive" aria-label={t("audio.delete")} onClick={() => setConfirm(r)}><Trash2 /></Button>
              </div>
              <ClipPlayer uid={r.uid} label={label} />
            </li>
          );
        })}
      </ul>
      <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("audio.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("audio.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirm) void applicationCommands.recordings.remove(confirm); setConfirm(null); }}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

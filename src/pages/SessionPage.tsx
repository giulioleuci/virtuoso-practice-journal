import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import { RATING_KEYS, type SegmentMark, type Subject } from "@/domain/entities/common";
import type { LibraryItem } from "@/domain/entities/library";
import type { Recording, Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { emptyEntry } from "@/domain/logic/plan";
import { applicationCommands } from "@/lib/applicationCommands";
import { formatDate } from "@/lib/date";
import { tempoLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { flattenErrors, sessionInputSchema } from "@/lib/schemas";
import { sessionsService } from "@/lib/services";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useSessions, useTechniques } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FloatingActions } from "@/components/shared/FloatingActions";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormErrors } from "@/components/shared/StateNotice";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { MarksEditor } from "@/components/diary/MarksEditor";
import { ClipList, Recorder } from "@/components/diary/Recorder";
import { UpdateNextTaskPanel } from "@/components/diary/UpdateNextTaskPanel";

/** One logged session: read-only summary with its historical snapshot, plus edit and delete. */
export default function SessionPage() {
  const { id } = useParams();
  const sessions = useSessions();
  const session = sessions?.find((s) => s.id === Number(id));
  if (sessions === undefined) return <div className="paper-skeleton h-40 w-full" />;
  return session ? <SessionView key={session.id} session={session} /> : <EmptyStateNotFound />;
}

function EmptyStateNotFound() {
  const { t } = useI18n();
  return <EmptyState title={t("sessionPage.notFound")} />;
}

function SessionView({ session }: { session: Session }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const task = usePresentationRead<Task | undefined>("tasks.one", [session.taskId]);
  const item = usePresentationRead<LibraryItem | undefined>("library.item", [session.itemId]);
  const subject = usePresentationRead<Subject | undefined>("subjects.one", [session.subjectId]);
  const techniques = useTechniques();
  const recordings = usePresentationRead<Recording[]>("recordings.session", [session.id]) ?? [];
  const sameContent = usePresentationRead<Recording[]>("recordings.item", [session.itemId]) ?? [];
  const others = sameContent.filter((r) => r.sessionId !== session.id);
  const isTheory = subject?.type === "theory";

  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(session.date);
  const [notes, setNotes] = useState(session.notes ?? "");
  const [marks, setMarks] = useState<SegmentMark[]>(session.marks);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const snap = session.snapshot;
  const sections = (snap?.segments ?? []).map((s) => ({ id: Number(s.id), label: s.barStart === undefined ? s.label : `${s.label} · ${t("segments.bars", { start: s.barStart, end: s.barEnd! })}` }));
  const layerOptions = isTheory
    ? THEORY_LAYERS.map((l) => ({ value: l as string, label: t(`library.mastery.${l}`) }))
    : (subject?.layers ?? []).map((l) => ({ value: l, label: l }));
  const techniqueOptions = (techniques ?? []).filter((x) => x.subjectId === session.subjectId).map((x) => ({ value: x.id, label: x.name }));
  const techName = (tid: number) => techniques?.find((x) => x.id === tid)?.name;
  const layerLabel = (l: string) => (isTheory ? t(`library.mastery.${l}`) : l);

  const errors = useMemo(() => {
    const e = date ? [] : [t("session.dateRequired")];
    if (!marks.length) e.push(t("rating.pickStudied"));
    return [...e, ...flattenErrors(sessionInputSchema.safeParse({ notes, marks }))];
  }, [date, notes, marks, t]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length) return;
    const studied = new Set(marks.map((m) => m.segmentId));
    const notStudied = session.taskId === undefined ? [] : sections.map((s) => s.id).filter((id) => !studied.has(id));
    await sessionsService.update(session.id, { date, notes: notes.trim() || undefined, marks, notStudied: notStudied.length ? notStudied : undefined });
    toast.success(t("toast.sessionUpdated"));
    setEditing(false);
  };

  const remove = async () => {
    await sessionsService.deleteWithTaskReset(session.id, session.taskId);
    toast.success(t("toast.sessionDeleted"));
    if (window.history.length > 1) navigate(-1);
    else navigate("/history");
  };

  const itemTitle = snap?.itemTitle ?? item?.title;
  const itemComposer = snap?.itemComposer ?? item?.composer;
  const segLabels = sections.map((s) => s.label);

  return (
    <div className="pb-24">
      <Link to="/history" className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />{t("sessionPage.back")}
      </Link>
      <PageHeader
        title={snap?.taskTitle ?? task?.title ?? t("session.sessionTitle")}
        subtitle={editing ? t("sessionPage.editSubtitle") : formatDate(session.date, lang, "long")}
        actions={!editing && (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil />{t("common.edit")}</Button>
            <Button size="icon" variant="ghost" className="h-[42px] w-[42px] hover:text-destructive" aria-label={t("session.delete")} onClick={() => setConfirmDelete(true)}><Trash2 /></Button>
          </>
        )}
      />

      {editing ? (
        <form onSubmit={save} className="max-w-[820px] rounded-[14px] bg-card p-6 shadow-soft">
          <div className="mb-6 grid gap-1.5 sm:max-w-xs">
            <Label className="text-xs font-medium text-foreground">{t("common.date")}</Label>
            <Input type="date" required aria-label={t("common.date")} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <MarksEditor marks={marks} onChange={setMarks} sections={sections} seed={(id) => emptyEntry(id)} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} showTempo={item ? item.kind !== "theory" : !isTheory} requireRatings={false} />
          <div className="mt-6 space-y-2 border-t border-border pt-6">
            <Label className="text-xs font-medium text-foreground">{t("session.notes")}</Label>
            <Textarea rows={3} maxLength={2000} aria-label={t("session.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("session.notesPlaceholder")} />
          </div>
          <FormErrors errors={errors} className="mt-6" />
          <FloatingActions>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setMarks(session.marks); setNotes(session.notes ?? ""); setDate(session.date); }}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={errors.length > 0}>{t("common.save")}</Button>
          </FloatingActions>
        </form>
      ) : (
        <div className="grid gap-8 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            <section>
              <SectionHeader title={t("sessionPage.measures")} />
              <ul className="divide-y divide-border border-t border-border">
                {session.marks.map((m) => (
                  <li key={m.segmentId ?? "whole"} className="space-y-1 py-3">
                    {m.segmentId !== undefined && <div className="text-sm font-medium">{sections.find((s) => s.id === m.segmentId)?.label}</div>}
                    <div className="flex flex-wrap gap-x-4 text-sm tabular-nums">
                      {m.bpm ? <span>{tempoLabel(m.noteVal, m.bpm)}</span> : null}
                      {m.targetBpm !== undefined && <span className="text-muted-foreground">{t("library.targetTempo")}: {tempoLabel(m.targetNoteVal, m.targetBpm)}</span>}
                      {RATING_KEYS.map((key) => (
                        <span key={key}>{key === "confidence" ? t("session.confidenceLabel") : t(`rating.${key}`)} {m[key] ?? "—"}</span>
                      ))}
                    </div>
                    {(!!m.layers.length || !!m.techniques.length) && (
                      <div className="text-xs text-muted-foreground">
                        {[...m.layers.map(layerLabel), ...m.techniques.flatMap((tid) => techName(tid) ?? [])].join(" · ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {!!session.notStudied?.length && (
                <p className="mt-3 text-sm text-muted-foreground">{t("rating.notStudied")}: {session.notStudied.map((id) => sections.find((s) => s.id === id)?.label ?? "—").join(", ")}</p>
              )}
            </section>

            {session.notes && (
              <section>
                <SectionHeader title={t("session.notes")} />
                <p className="whitespace-pre-wrap border-t border-border pt-4 text-sm">{session.notes}</p>
              </section>
            )}

            <section>
              <SectionHeader title={t("audio.title")} />
              <Recorder sections={sections} onClip={async (clip) => {
                try { await applicationCommands.recordings.add({ ...clip, sessionId: session.id, date: session.date, createdAt: Date.now() }); }
                catch { await applicationCommands.audio.discard([clip.uid]); toast.error(t("errors.couldNotSave")); }
              }} />
              {recordings.length > 0 && <div className="mt-4"><ClipList recordings={recordings} sections={sections} /></div>}
            </section>
            {others.length > 0 && (
              <section>
                <SectionHeader title={t("audio.other")} />
                <ClipList recordings={others} sections={sections} />
              </section>
            )}
          </div>

          <aside className="min-w-0">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("sessionPage.context")}</h2>
            <p className="break-words font-serif text-xl font-semibold leading-tight">{snap?.taskTitle ?? task?.title ?? "—"}</p>
            {itemTitle && <p className="mt-1 text-sm text-muted-foreground">{session.itemId ? <Link to={`/library/item/${session.itemId}`} className="hover:underline underline-offset-4">{itemTitle}</Link> : itemTitle}{itemComposer ? ` · ${itemComposer}` : ""}</p>}
            {!!segLabels.length && <p className="mt-2 text-sm italic text-muted-foreground">{segLabels.length > 1 ? t("session.segmentTitle_plural") : t("session.segmentTitle")}: {segLabels.join(", ")}</p>}
            {snap?.collectionName && <p className="text-sm italic text-muted-foreground">{t("session.collectionLabel")}: {snap.collectionName}</p>}
            {snap && <p className="mt-3 text-xs text-muted-foreground">{t("session.snapshotLabel")} · {snap.subjectName}</p>}
            <div className="mt-8"><UpdateNextTaskPanel session={session} /></div>
          </aside>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("session.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.deleteSessionDesc")}{recordings.length ? ` ${t("audio.deleteSessionClips", { count: recordings.length })}` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

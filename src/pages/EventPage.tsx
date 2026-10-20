import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, parseDayKey, today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import type { PieceEvidence } from "@/domain/logic/readiness";
import { performancesService } from "@/lib/services/performances";
import { useReadiness } from "@/presentation/hooks/useReadiness";
import { usePerformanceEvents, usePerformanceLinks } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { PerformanceEventSheet } from "@/components/library/PerformanceEventSheet";

/** One concert, exam or audition: programme readiness per piece, with a link to the sources of each score. */
export default function EventPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const eventId = Number(id);
  const events = usePerformanceEvents();
  const links = usePerformanceLinks();
  const { ready, itemsById, evidenceFor } = useReadiness();
  const coverage = (ev: PieceEvidence) => [
    ev.total ? t("evidence.rated", { rated: ev.rated, total: ev.total }) : t("evidence.whole"),
    ev.lastStudied ? t("evidence.lastStudied", { date: formatDate(ev.lastStudied, lang, "dayMonth") }) : t("evidence.never"),
  ].join(" · ");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (events === undefined || links === undefined || !ready) return <div className="paper-skeleton h-40 w-full" />;
  const event = events.find((e) => e.id === eventId);
  if (!event) return <EmptyState title={t("event.notFound")} cta={{ label: t("event.back"), onClick: () => navigate("/library/repertoire?tab=performances") }} />;

  const programme = links.filter((l) => l.eventId === eventId);
  const rows = programme.flatMap((l) => {
    const item = itemsById.get(l.itemId);
    return item ? [{ item, ev: evidenceFor(item) }] : [];
  });
  rows.sort((a, b) => (b.ev.toDo.length + b.ev.lowConfidence.length) - (a.ev.toDo.length + a.ev.lowConfidence.length));
  const daysLeft = Math.round((parseDayKey(event.date).getTime() - parseDayKey(today()).getTime()) / 86_400_000);

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await performancesService.removeEvent(eventId);
      toast.success(t("toast.deleted"));
      navigate("/library/repertoire?tab=performances");
    } catch { toast.error(t("quick.failed")); }
    finally { setDeleting(false); }
  };

  return (
    <div className="pb-24">
      <Link to="/library/repertoire?tab=performances" className="mb-4 inline-flex min-h-11 items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />{t("event.back")}
      </Link>
      <PageHeader
        title={event.name}

        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil />{t("event.editProgramme")}</Button>
            <Button size="icon" variant="ghost" className="h-11 w-11 hover:text-destructive" aria-label={t("common.delete")} onClick={() => setConfirmDelete(true)}><Trash2 /></Button>
          </>
        }
      />

      <section className="mb-10">
        <SectionHeader title={t("event.programme")} />
        <p className="mb-4 max-w-[72ch] text-sm text-muted-foreground">{t("event.programmeHint")}</p>
        {rows.length === 0 ? (
          <EmptyState title={t("event.emptyProgramme")} hint={t("event.emptyProgrammeHint")} cta={{ label: t("event.editProgramme"), onClick: () => setEditOpen(true) }} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {rows.map(({ item, ev }) => (
              <li key={item.id} className="grid gap-x-6 gap-y-2 py-4 [overflow-wrap:anywhere] min-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
                <Link to={`/library/events/${eventId}/item/${item.id}`} className="min-w-0 hover:underline underline-offset-4">
                  <strong className="block break-words font-serif text-xl font-semibold leading-tight">{item.title}</strong>
                  {item.composer && <small className="text-xs italic text-muted-foreground">{item.composer}</small>}
                </Link>
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="tabular-nums">{coverage(ev)}</p>
                  {ev.toDo.length > 0 && <p className="text-muted-foreground">{t("evidence.toDo", { list: ev.toDo.join(", ") })}</p>}
                  {ev.lowConfidence.length > 0 && <p className="font-medium text-destructive">{t("evidence.lowConfidence", { list: ev.lowConfidence.map((l) => l || t("evidence.whole")).join(", ") })}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PerformanceEventSheet open={editOpen} onOpenChange={setEditOpen} event={event} programme={programme.map((l) => l.itemId)} />
      <AlertDialog open={confirmDelete} onOpenChange={open => { if (!deleting) setConfirmDelete(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("event.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("event.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={event => { event.preventDefault(); void remove(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

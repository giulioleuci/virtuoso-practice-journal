import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, MoreVertical, Music4, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { usePerformanceEvents, usePerformanceLinks, useRepertoire } from "@/presentation/hooks/useEntities";
import { useReadiness } from "@/presentation/hooks/useReadiness";
import type { LibraryItem } from "@/domain/entities/library";
import type { PerformanceEvent } from "@/domain/entities/performance";
import type { PieceEvidence } from "@/domain/logic/readiness";
import { useI18n } from "@/lib/i18n";
import { formatDate, parseDayKey, today } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterPanel, FilterSelect } from "@/components/shared/FilterPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { PerformanceEventSheet } from "@/components/library/PerformanceEventSheet";
import { performancesService, repertoireService } from "@/lib/services/performances";
import { toast } from "sonner";

type Tab = "repertoire" | "performances";

export default function Repertoire() {
  const { t, lang } = useI18n();
  const todayKey = today();

  const items = useRepertoire();
  const events = usePerformanceEvents();
  const links = usePerformanceLinks();
  const { ready, itemsById, evidenceFor } = useReadiness();

  const coverage = (ev: PieceEvidence) => [
    ev.total ? t("evidence.rated", { rated: ev.rated, total: ev.total }) : t("evidence.whole"),
    ev.lastStudied ? t("evidence.lastStudied", { date: formatDate(ev.lastStudied, lang, "dayMonth") }) : t("evidence.never"),
  ].join(" · ");

  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "performances" ? "performances" : "repertoire");
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("all");
  const [period, setPeriod] = useState("all");
  const [eventKind, setEventKind] = useState("all");
  const [eventSheet, setEventSheet] = useState<{ open: boolean; event: PerformanceEvent | null }>({ open: false, event: null });
  const [deletingEvent, setDeletingEvent] = useState<PerformanceEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortedItems = useMemo(
    () => (items ?? []).filter(i => (composer === "all" || i.composer === composer) && (!search.trim() || `${i.title} ${i.composer ?? ""} ${i.catalog ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))).sort((a, b) => a.title.localeCompare(b.title)),
    [items, search, composer]
  );
  const sortedEvents = useMemo(
    () => (events ?? []).filter(event => (eventKind === "all" || event.kind === eventKind) &&
      (period === "all" || (period === "upcoming" ? event.date >= todayKey : event.date < todayKey)) &&
      (!search.trim() || `${event.name} ${event.venue ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [events, search, eventKind, period, todayKey]
  );

  const removeFromRepertoire = async (item: LibraryItem) => {
    if (item.id === undefined) return;
    await deleteWithUndo({ remove: () => repertoireService.setInRepertoire(item.id!, false), restore: () => repertoireService.setInRepertoire(item.id!, true), message: t("repertoire.removed"), undoLabel: t("common.undo"), toast: (message, options) => toast.success(message, options), onError: () => toast.error(t("quick.failed")) });
  };

  const deleteEvent = async () => {
    if (deletingEvent?.id === undefined || deleting) return;
    setDeleting(true);
    try {
      await performancesService.removeEvent(deletingEvent.id);
      setDeletingEvent(null);
      toast.success(t("toast.deleted"));
    } catch { toast.error(t("quick.failed")); }
    finally { setDeleting(false); }
  };

  if (items === undefined || events === undefined || links === undefined || !ready) return <div className="paper-skeleton h-40 w-full" />;

  return (
    <div className="pb-24">
      <Link to="/library" className="mb-4 inline-flex min-h-11 items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" /> {t("item.back")}
      </Link>
      <PageHeader
        title={t("repertoire.title")}
        actions={tab === "performances" && <Button onClick={() => setEventSheet({ open: true, event: null })}><Plus /> {t("performances.new")}</Button>}
      />

      <Tabs value={tab} onValueChange={value => { setTab(value as Tab); setSearch(""); }}>
      <TabsList aria-label={t("repertoire.title")} className="mb-5 flex h-auto flex-wrap justify-start gap-x-4 rounded-none border-b border-border bg-transparent p-0">
        {(["repertoire", "performances"] as Tab[]).map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="-mb-px min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            {key === "repertoire" ? t("repertoire.tab") : t("performances.tab")}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={tab}>

      <FilterPanel search={{ value: search, onChange: setSearch, placeholder: tab === "repertoire" ? t("library.searchTitleComposer") : t("filters.searchEvents") }}
        filters={tab === "repertoire" ? (composer === "all" ? [] : [{ key: "composer", label: `${t("collection.author")}: ${composer}`, onRemove: () => setComposer("all") }]) : [
          ...(eventKind !== "all" ? [{ key: "kind", label: t(`performances.kind.${eventKind}`), onRemove: () => setEventKind("all") }] : []),
          ...(period !== "all" ? [{ key: "period", label: t(period === "upcoming" ? "filters.upcoming" : "performances.past"), onRemove: () => setPeriod("all") }] : []),
        ]} onReset={() => { setSearch(""); setComposer("all"); setEventKind("all"); setPeriod("all"); }} resultCount={tab === "repertoire" ? (items === undefined ? undefined : sortedItems.length) : (events === undefined ? undefined : sortedEvents.length)}>
        {tab === "repertoire" ? <FilterSelect label={t("collection.author")} value={composer} onChange={setComposer} options={[{ value: "all", label: t("collection.allAuthors") }, ...Array.from(new Set((items ?? []).map(i => i.composer).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, lang)).map(value => ({ value, label: value }))]} /> : <>
          <FilterSelect label={t("link.filterByKind")} value={eventKind} onChange={setEventKind} options={[{ value: "all", label: t("common.all") }, ...Array.from(new Set((events ?? []).map(event => event.kind))).map(value => ({ value, label: t(`performances.kind.${value}`) }))]} />
          <FilterSelect label={t("analytics.pdfPeriod")} value={period} onChange={setPeriod} options={[{ value: "all", label: t("common.all") }, { value: "upcoming", label: t("filters.upcoming") }, { value: "past", label: t("performances.past") }]} />
        </>}
      </FilterPanel>

      {tab === "repertoire" && (
        sortedItems.length === 0 && !!items?.length ? <EmptyState title={t("common.noResults")} /> : sortedItems.length === 0 ? (
          <EmptyState icon={Music4} title={t("repertoire.emptyTitle")} hint={t("repertoire.emptyBody")} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {sortedItems.map((item) => {
              const ev = evidenceFor(item);
              return (
                <li key={item.id} className="space-y-2.5 py-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 [overflow-wrap:anywhere]">
                      <h3 className="font-serif text-xl leading-tight break-words">{item.title}</h3>
                      {item.composer && <p className="text-sm text-muted-foreground italic">{item.composer}</p>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-11 w-11 shrink-0 -mr-1.5 -mt-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={`${t("common.more")}: ${item.title}`}>
                          <MoreVertical className="h-[18px] w-[18px]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => removeFromRepertoire(item)}>
                          <Trash2 className="h-4 w-4 mr-2" /> {t("repertoire.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Button asChild size="sm" variant="outline" className="min-h-11">
                    <Link to="/tasks/new" state={{ date: todayKey, prefill: { itemId: item.id, itemTitle: item.title, itemSubjectId: item.subjectId } }}><Play />{t("library.practiceThis")}</Link>
                  </Button>

                  <p className="text-xs tabular-nums text-muted-foreground">
                    {coverage(ev)}{ev.toDo.length ? ` · ${t("evidence.programmeToDo", { count: ev.toDo.length })}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === "performances" && (
        sortedEvents.length === 0 && !!events?.length ? <EmptyState title={t("common.noResults")} /> : sortedEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("performances.emptyTitle")} hint={t("performances.emptyBody")} cta={{ label: t("performances.new"), onClick: () => setEventSheet({ open: true, event: null }) }} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {sortedEvents.map((event) => {
              const pieces = (links ?? []).filter((link) => link.eventId === event.id).flatMap((link) => {
                const item = itemsById.get(link.itemId);
                return item ? [evidenceFor(item)] : [];
              });
              const toDo = pieces.reduce((sum, ev) => sum + ev.toDo.length, 0);
              const daysLeft = Math.round((parseDayKey(event.date).getTime() - parseDayKey(todayKey).getTime()) / 86_400_000);
              return (
                <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <div className="min-w-[calc(100%-6rem)] flex-1 min-[700px]:min-w-0 [overflow-wrap:anywhere]">
                    <h3 className="break-words font-serif text-xl font-semibold leading-tight">
                      <Link to={`/library/events/${event.id}`} className="hover:underline underline-offset-4">{event.name}</Link>
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(`performances.kind.${event.kind}`)} · {formatDate(event.date, lang, "medium")}{event.venue ? ` · ${event.venue}` : ""} · {pieces.length} {t("performances.programme").toLowerCase()}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {daysLeft >= 0 ? t("performances.daysLeft").replace("{days}", String(daysLeft)) : t("performances.past")}
                      </span>
                      <span className="tabular-nums">{t("evidence.programmeToDo", { count: toDo })}</span>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="min-h-11"><Link to={`/library/events/${event.id}`}>{t("event.preparation")}</Link></Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40" aria-label={`${t("common.more")}: ${event.name}`}>
                        <MoreVertical className="h-[18px] w-[18px]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEventSheet({ open: true, event })}><Pencil className="mr-2 h-4 w-4" /> {t("common.edit")}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingEvent(event)}><Trash2 className="mr-2 h-4 w-4" /> {t("common.delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )
      )}
      </TabsContent>
      </Tabs>

      <PerformanceEventSheet
        open={eventSheet.open}
        onOpenChange={(open) => setEventSheet((current) => ({ ...current, open }))}
        event={eventSheet.event}
        programme={(links ?? []).filter((link) => link.eventId === eventSheet.event?.id).map((link) => link.itemId)}
      />
      <AlertDialog open={deletingEvent !== null} onOpenChange={open => { if (!open && !deleting) setDeletingEvent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("event.deleteTitle")}</AlertDialogTitle><AlertDialogDescription>{t("event.deleteDesc")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={event => { event.preventDefault(); void deleteEvent(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

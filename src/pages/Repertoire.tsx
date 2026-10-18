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
  const { itemsById, evidenceFor } = useReadiness();

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
    await repertoireService.setInRepertoire(item.id, false);
    toast.success(t("repertoire.removed"));
  };

  const deleteEvent = async (event: PerformanceEvent) => {
    if (event.id === undefined) return;
    await performancesService.removeEvent(event.id);
    toast.success(t("toast.deleted"));
  };

  return (
    <div className="pb-24">
      <Link to="/library" className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" /> {t("item.back")}
      </Link>
      <PageHeader
        title={t("repertoire.title")}
        actions={tab === "performances" && <Button onClick={() => setEventSheet({ open: true, event: null })}><Plus /> {t("performances.new")}</Button>}
      />

      <div role="tablist" className="mb-5 flex gap-6 border-b border-border">
        {(["repertoire", "performances"] as Tab[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => { setTab(key); setSearch(""); }}
            className={`-mb-px border-b-2 pb-2 text-sm font-medium transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {key === "repertoire" ? t("repertoire.tab") : t("performances.tab")}
          </button>
        ))}
      </div>

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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-[1.35rem] leading-tight break-words">{item.title}</h3>
                      {item.composer && <p className="text-sm text-muted-foreground italic">{item.composer}</p>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-10 w-10 -mr-1.5 -mt-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={t("common.more")}>
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

                  <Button asChild size="sm" variant="outline">
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
                  <div className="min-w-[calc(100%-6rem)] flex-1 min-[700px]:min-w-0">
                    <h3 className="break-words font-serif text-[1.375rem] font-semibold leading-tight">
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
                  <Button asChild size="sm" variant="outline"><Link to={`/library/events/${event.id}`}>{t("event.preparation")}</Link></Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40" aria-label={`${t("common.more")}: ${event.name}`}>
                        <MoreVertical className="h-[18px] w-[18px]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEventSheet({ open: true, event })}><Pencil className="mr-2 h-4 w-4" /> {t("common.edit")}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteEvent(event)}><Trash2 className="mr-2 h-4 w-4" /> {t("common.delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )
      )}

      <PerformanceEventSheet
        open={eventSheet.open}
        onOpenChange={(open) => setEventSheet((current) => ({ ...current, open }))}
        event={eventSheet.event}
        programme={(links ?? []).filter((link) => link.eventId === eventSheet.event?.id).map((link) => link.itemId)}
      />
    </div>
  );
}

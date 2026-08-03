import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, MoreVertical, Music4, Pencil, Plus, Trash2 } from "lucide-react";
import { useAllSegments, useAllTasks, usePerformanceEvents, usePerformanceLinks, useRepertoire, useSessions } from "@/presentation/hooks/useEntities";
import type { LibraryItem } from "@/domain/entities/library";
import type { PerformanceEvent } from "@/domain/entities/performance";
import { calculateReadiness } from "@/domain/logic/readiness";
import { daysUntilReview, isReviewDue } from "@/domain/logic/repertoireReview";
import { useI18n } from "@/lib/i18n";
import { formatDate, parseDayKey, today } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { PerformanceEventSheet } from "@/components/library/PerformanceEventSheet";
import { performancesService, repertoireService } from "@/lib/services/performances";
import { toast } from "sonner";

type Tab = "repertoire" | "performances";

export default function Repertoire() {
  const { t, lang } = useI18n();
  const todayKey = today();

  const items = useRepertoire();
  const sessions = useSessions();
  const segments = useAllSegments();
  const tasks = useAllTasks();
  const events = usePerformanceEvents();
  const links = usePerformanceLinks();

  const [tab, setTab] = useState<Tab>("repertoire");
  const [eventSheet, setEventSheet] = useState<{ open: boolean; event: PerformanceEvent | null }>({ open: false, event: null });

  const sessionsByItem = useMemo(() => {
    const taskItem = new Map<number, number>();
    for (const task of tasks ?? []) if (task.id !== undefined && task.itemId !== undefined) taskItem.set(task.id, task.itemId);
    const map = new Map<number, typeof sessions>();
    for (const session of sessions ?? []) {
      const itemId = taskItem.get(session.taskId);
      if (itemId === undefined) continue;
      map.set(itemId, [...(map.get(itemId) ?? []), session]);
    }
    return map;
  }, [sessions, tasks]);

  const readinessFor = (item: LibraryItem) =>
    calculateReadiness(
      item,
      (segments ?? []).filter((segment) => segment.itemId === item.id),
      (item.id !== undefined ? sessionsByItem.get(item.id) : undefined) ?? [],
      todayKey,
    );

  const sortedItems = useMemo(
    () => (items ?? []).slice().sort((a, b) => (a.nextReviewAt ?? "").localeCompare(b.nextReviewAt ?? "")),
    [items]
  );

  const sortedEvents = useMemo(
    () => (events ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  const itemsById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  const markReviewed = async (item: LibraryItem) => {
    if (item.id === undefined) return;
    await repertoireService.markReviewed(item.id);
    toast.success(t("repertoire.reviewed"));
  };

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
    <div className="space-y-5 pb-24">
      <h2 className="font-serif text-3xl">{t("repertoire.title")}</h2>

      <div className="grid grid-cols-2 gap-2">
        {(["repertoire", "performances"] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`paper-card py-3 text-sm font-medium min-h-[44px] ${tab === key ? "ring-2 ring-primary/60" : ""}`}
          >
            {t(key === "repertoire" ? "repertoire.tab" : "performances.tab")}
          </button>
        ))}
      </div>

      {tab === "repertoire" && (
        sortedItems.length === 0 ? (
          <EmptyState icon={Music4} title={t("repertoire.emptyTitle")} hint={t("repertoire.emptyBody")} />
        ) : (
          <ul className="space-y-3">
            {sortedItems.map((item) => {
              const due = isReviewDue(item, todayKey);
              const days = daysUntilReview(item, todayKey);
              const readiness = readinessFor(item);
              return (
                <li key={item.id} className="paper-card p-3.5 space-y-2.5">
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
                        <DropdownMenuItem onClick={() => markReviewed(item)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" /> {t("repertoire.markReviewed")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => removeFromRepertoire(item)}>
                          <Trash2 className="h-4 w-4 mr-2" /> {t("repertoire.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${due ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <CalendarDays className="h-3 w-3" />
                      {due
                        ? t("repertoire.reviewDue")
                        : t("repertoire.reviewIn").replace("{days}", String(days ?? 0))}
                    </span>
                    {item.nextReviewAt && (
                      <span className="text-muted-foreground tabular-nums">{formatDate(item.nextReviewAt, lang, "dayMonth")}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("performances.readiness")}</span>
                      <span className="tabular-nums font-medium text-foreground">{readiness.overall}%</span>
                    </div>
                    <Progress value={readiness.overall} className="h-2" />
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === "performances" && (
        sortedEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("performances.emptyTitle")} hint={t("performances.emptyBody")} />
        ) : (
          <ul className="space-y-3">
            {sortedEvents.map((event) => {
              const programme = (links ?? []).filter((link) => link.eventId === event.id);
              const scores = programme.flatMap((link) => {
                const item = itemsById.get(link.itemId);
                return item ? [{ item, readiness: readinessFor(item) }] : [];
              });
              const overall = scores.length
                ? Math.round(scores.reduce((sum, entry) => sum + entry.readiness.overall, 0) / scores.length)
                : 0;
              const daysLeft = Math.round((parseDayKey(event.date).getTime() - parseDayKey(todayKey).getTime()) / 86_400_000);
              return (
                <li key={event.id} className="paper-card p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-[1.35rem] leading-tight break-words">{event.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t(`performances.kind.${event.kind}`)} · {formatDate(event.date, lang, "medium")}
                        {event.venue ? ` · ${event.venue}` : ""}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-10 w-10 -mr-1.5 -mt-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={t("common.more")}>
                          <MoreVertical className="h-[18px] w-[18px]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEventSheet({ open: true, event })}>
                          <Pencil className="h-4 w-4 mr-2" /> {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteEvent(event)}>
                          <Trash2 className="h-4 w-4 mr-2" /> {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground tabular-nums">
                      {daysLeft >= 0
                        ? t("performances.daysLeft").replace("{days}", String(daysLeft))
                        : t("performances.past")}
                    </span>
                    <span className="tabular-nums font-medium">{overall}%</span>
                  </div>
                  <Progress value={overall} className="h-2" />

                  <ul className="space-y-2 pt-1">
                    {scores.map(({ item, readiness }) => (
                      <li key={item.id} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-serif text-base leading-tight break-words min-w-0">{item.title}</span>
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0">{readiness.overall}%</span>
                        </div>
                        <Progress value={readiness.overall} className="h-1.5" />
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {t("performances.bpm")} {readiness.bpm}% · {t("performances.mastery")} {readiness.mastery}% · {t("performances.frequency")} {readiness.frequency}%
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === "performances" && (
        <button
          onClick={() => setEventSheet({ open: true, event: null })}
          className="fixed bottom-24 right-5 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg inline-flex items-center justify-center"
          aria-label={t("performances.new")}
        >
          <Plus className="h-6 w-6" />
        </button>
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

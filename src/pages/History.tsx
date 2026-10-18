import { useCallback, useEffect, useMemo, useState } from "react";
import { useAllCollections, useAllLibrary, useAllSegments, useAllTasks, useSessionsInRange, useSubjects } from "@/presentation/hooks/useEntities";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { LibraryKind, Subject } from "@/domain/entities/common";
import type { Session } from "@/domain/entities/session";
import { subjectColorCss } from "@/lib/subjectColors";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";


import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SearchX } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";


import { PageHeader } from "@/components/shared/PageHeader";
import { FilterPanel, FilterDateRange, FilterSelect } from "@/components/shared/FilterPanel";
import { ProgressTabs } from "@/components/shared/ProgressTabs";
import { SessionFAB } from "@/components/diary/SessionFAB";
import { ListSkeleton } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";

import { sessionLabel } from "@/lib/format";
import { usePagination } from "@/hooks/usePagination";

type GroupKey = "task" | "day" | "item" | "segment";
type SortDir = "newest" | "oldest";
const PAGE_SIZE = 15;
const KINDS: ("all" | LibraryKind)[] = ["all", "piece", "study", "technique", "exercise", "theory"];

export default function History() {
  const { t, lang } = useI18n();
  const [groupBy, setGroupBy] = useState<GroupKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("newest");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<"all" | LibraryKind>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const navigate = useNavigate();

  // Scope session reads by date range when set — avoids loading the entire table
  const sessions = useSessionsInRange(from || undefined, to || undefined);
  const tasks = useAllTasks();
  const items = useAllLibrary();
  const segments = useAllSegments();
  const subjects = useSubjects();
  const collections = useAllCollections();

  const taskById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks]);
  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const segById = useMemo(() => new Map((segments ?? []).map((s) => [s.id, s])), [segments]);
  const collectionById = useMemo(() => new Map((collections ?? []).map((c) => [c.id, c])), [collections]);
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s])), [subjects]);

  const taskOf = useCallback((s: Session) => (s.taskId === undefined ? undefined : taskById.get(s.taskId)), [taskById]);
  const sessionSortKey = (s: Session) => `${s.date}|${String(s.createdAt).padStart(16, "0")}`;

  const filteredSessions = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      const task = taskOf(s);
      if (subjectFilter !== "all" && s.subjectId !== Number(subjectFilter)) return false;
      if (kindFilter !== "all") {
        const it = s.itemId ? itemById.get(s.itemId) : undefined;
        if (it?.kind !== kindFilter) return false;
      }
      return true;
    });
  }, [sessions, from, to, subjectFilter, kindFilter, taskOf, itemById]);

  const groups = useMemo(() => {
    const map = new Map<string, { sortKey: string; label: string; sub?: string; sessions: Session[]; subjectIds: number[] }>();
    for (const s of filteredSessions) {
      const task = taskOf(s);
      const item = s.itemId ? itemById.get(s.itemId) : undefined;
      const collection = s.collectionId ? collectionById.get(s.collectionId) : undefined;
      const segIds = s.marks.flatMap((m) => (m.segmentId === undefined ? [] : [m.segmentId]));
      const seg = segIds.length ? segById.get(segIds[0]) : undefined;
      const historical = s.snapshot?.segments?.find(segment => segment.id === String(segIds[0]));
      let key: string, label: string, sub: string | undefined;
      switch (groupBy) {
        case "task":
          key = `t:${s.taskId ?? `s${s.id}`}`;
          label = task?.title ?? s.snapshot?.taskTitle ?? t("history.untitled");
          sub = item?.title ?? collection?.name;
          break;
        case "day":
          key = `d:${s.date}`;
          label = formatDate(s.date, lang);
          break;
        case "item":
          if (collection) { key = `c:${collection.id}`; label = collection.name; sub = t("history.collection"); }
          else { key = `i:${item?.id ?? "none"}`; label = item?.title ?? t("history.noItem"); }
          break;
        case "segment":
          key = `s:${segIds[0] ?? "none"}`;
          label = historical?.label ?? seg?.label ?? t("history.noSegment");
          sub = item?.title ?? collection?.name;
          break;
      }
      let g = map.get(key);
      if (!g) {
        g = { sortKey: "", label, sub, sessions: [], subjectIds: [] };
        map.set(key, g);
      }
      g.sessions.push(s);
      if (s.subjectId != null && !g.subjectIds.includes(s.subjectId)) {
        g.subjectIds.push(s.subjectId);
      }
    }
    const cmp = (a: string, b: string) => sortDir === "newest" ? b.localeCompare(a) : a.localeCompare(b);
    for (const g of map.values()) {
      g.sessions.sort((a, b) => cmp(sessionSortKey(a), sessionSortKey(b)));
      g.sortKey = sessionSortKey(g.sessions[sortDir === "newest" ? 0 : g.sessions.length - 1]);
    }
    return Array.from(map.values()).sort((a, b) => cmp(a.sortKey, b.sortKey));
  }, [filteredSessions, taskOf, itemById, segById, collectionById, groupBy, sortDir, lang, t]);

  const { page, setPage, totalPages, pageItems: pageGroups } = usePagination(groups, PAGE_SIZE);

  useEffect(() => {
    const f = searchParams.get("from") ?? "";
    const toVal = searchParams.get("to") ?? "";
    setFrom(f);
    setTo(toVal);
    setPage(0);
  }, [searchParams, setPage]);

  const changeDate = (field: "from" | "to", value: string) => {
    if (field === "from") setFrom(value); else setTo(value);
    setPage(0);
    setSearchParams(params => { const next = new URLSearchParams(params); if (value) next.set(field, value); else next.delete(field); return next; });
  };
  const resetFilters = () => {
    setFrom(""); setTo(""); setSubjectFilter("all"); setKindFilter("all"); setPage(0);
    setSearchParams(params => { const next = new URLSearchParams(params); next.delete("from"); next.delete("to"); return next; });
  };

  return (
    <div className="pb-24">
      <PageHeader title={t("nav.progress")} actions={<SessionFAB />} />
      <ProgressTabs />

      <Tabs className="mb-4" value={groupBy} onValueChange={value => { setGroupBy(value as GroupKey); setPage(0); }}>
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="day" className="min-h-11 flex-1">{t("history.groupDay")}</TabsTrigger>
          <TabsTrigger value="task" className="min-h-11 flex-1">{t("history.groupTask")}</TabsTrigger>
          <TabsTrigger value="item" className="min-h-11 flex-1">{t("history.groupItem")}</TabsTrigger>
          <TabsTrigger value="segment" className="min-h-11 flex-1">{t("history.groupSegment")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterPanel filters={[
        ...(subjectFilter !== "all" ? [{ key: "subject", label: `${t("common.subject")}: ${subjectMap.get(Number(subjectFilter))?.name ?? subjectFilter}`, onRemove: () => { setSubjectFilter("all"); setPage(0); } }] : []),
        ...(kindFilter !== "all" ? [{ key: "kind", label: t(`library.kind.${kindFilter}`), onRemove: () => { setKindFilter("all"); setPage(0); } }] : []),
        ...(from ? [{ key: "from", label: `${t("common.from")}: ${formatDate(from, lang)}`, onRemove: () => changeDate("from", "") }] : []),
        ...(to ? [{ key: "to", label: `${t("common.to")}: ${formatDate(to, lang)}`, onRemove: () => changeDate("to", "") }] : []),
      ]} onReset={resetFilters} resultCount={sessions === undefined ? undefined : filteredSessions.length}
        sorting={<FilterSelect label={t("link.sortBy")} value={sortDir} onChange={value => { setSortDir(value); setPage(0); }} options={[{ value: "newest", label: t("history.newestFirst") }, { value: "oldest", label: t("history.oldestFirst") }]} />}>
        <FilterSelect label={t("common.subject")} value={subjectFilter} onChange={value => { setSubjectFilter(value); setPage(0); }} options={[{ value: "all", label: t("history.allSubjects") }, ...(subjects ?? []).map(s => ({ value: String(s.id), label: s.name }))]} />
        <FilterSelect label={t("link.filterByKind")} value={kindFilter} onChange={value => { setKindFilter(value); setPage(0); }} options={KINDS.map(k => ({ value: k, label: k === "all" ? t("history.allKinds") : t(`library.kind.${k}`) }))} />
        <FilterDateRange from={from} to={to} onFromChange={value => changeDate("from", value)} onToChange={value => changeDate("to", value)} />
      </FilterPanel>
      {sessions === undefined ? (
        <ListSkeleton />
      ) : pageGroups.length === 0 ? (
        <EmptyState icon={SearchX} title={t("history.noSessionsMatch")} />
      ) : (
        <Accordion type="multiple" className="border-t border-border">
          {pageGroups.map((g, i) => (
            <AccordionItem key={i} value={`g-${i}`} className="border-b border-border">
              <AccordionTrigger className="py-4 hover:no-underline gap-2">
                <div className="flex items-start justify-between gap-2 flex-1 min-w-0 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg break-words flex items-center gap-2 flex-wrap">
                      {g.subjectIds.map((sid) => {
                        const subj = subjectMap.get(sid) as Subject | undefined;
                        return (
                          <span
                            key={sid}
                            className="h-2 w-2 rounded-full shrink-0 inline-block"
                            style={{ backgroundColor: subjectColorCss(subj?.color, subj?.type, subj?.customColor) }}
                            title={subj?.name}
                          />
                        );
                      })}
                      {g.label}
                    </div>
                    {g.sub && <div className="text-xs text-muted-foreground break-words">{g.sub}</div>}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 mt-1">
                    {t("history.sessions", { count: g.sessions.length })}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <ul className="pt-2 border-t border-border/60 space-y-1">
                  {g.sessions.slice(0, 6).map((s) => {
                    const task = taskOf(s);
                    const subj = s.subjectId != null ? subjectMap.get(s.subjectId) as Subject | undefined : undefined;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => navigate(`/sessions/${s.id}`)}
                          className="w-full flex items-start gap-2 text-left py-2 px-2 -mx-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 min-h-[44px]"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: subjectColorCss(subj?.color, subj?.type, subj?.customColor) }}
                          />
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-sm break-words text-foreground">{groupBy === "day" ? task?.title ?? s.snapshot?.taskTitle : formatDate(s.date, lang)}</span>
                            {sessionLabel(s.marks) && <span className="text-xs tabular-nums">{sessionLabel(s.marks)}</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {g.sessions.length > 6 && (
                    <li className="text-xs text-muted-foreground italic px-2">
                      {t("history.more", { count: g.sessions.length - 6 })}
                    </li>
                  )}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Pager page={page} totalPages={totalPages} onChange={setPage} />

    </div>
  );
}

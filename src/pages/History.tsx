import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type Session, type Collection, type Subject } from "@/lib/db";
import { getSubjectColor, subjectColorCss } from "@/lib/subjectColors";
import { useI18n } from "@/lib/i18n";
import { NOTE_GLYPH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ArrowDownUp } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { SessionDetailSheet } from "@/components/diary/SessionDetailSheet";
import { StatsDashboard } from "@/components/diary/StatsDashboard";
import { SessionFAB } from "@/components/diary/SessionFAB";
import { ListSkeleton } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";

type GroupKey = "task" | "day" | "item" | "segment";
type SortDir = "newest" | "oldest";
const PAGE_SIZE = 15;
const KINDS: ("all" | LibraryKind)[] = ["all", "repertoire", "manual", "technique", "theory"];

export default function History() {
  const { t } = useI18n();
  const [groupBy, setGroupBy] = useState<GroupKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("newest");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<"all" | LibraryKind>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Session | null>(null);

  // Scope session reads by date range when set — avoids loading the entire table
  const sessions = useLiveQuery(() => {
    if (from && to) return db.sessions.where("date").between(from, to, true, true).toArray();
    if (from) return db.sessions.where("date").aboveOrEqual(from).toArray();
    if (to) return db.sessions.where("date").belowOrEqual(to).toArray();
    return db.sessions.toArray();
  }, [from, to]);
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const items = useLiveQuery(() => db.library.toArray());
  const segments = useLiveQuery(() => db.segments.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());
  const collections = useLiveQuery(() => db.collections.toArray());

  useEffect(() => {
    const f = searchParams.get("from") ?? "";
    const toVal = searchParams.get("to") ?? "";
    setFrom(f);
    setTo(toVal);
    setPage(0);
  }, [searchParams]);

  const taskById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id!, task])), [tasks]);
  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id!, i])), [items]);
  const segById = useMemo(() => new Map((segments ?? []).map((s) => [s.id!, s])), [segments]);
  const collectionById = useMemo(() => new Map((collections ?? []).map((c) => [c.id!, c])), [collections]);
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id!, s])), [subjects]);

  const sessionSortKey = (s: Session) => `${s.date}|${String(s.createdAt).padStart(16, "0")}`;

  const filteredSessions = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      const task = taskById.get(s.taskId);
      if (subjectFilter !== "all" && task?.subjectId !== Number(subjectFilter)) return false;
      if (kindFilter !== "all") {
        const it = task?.itemId ? itemById.get(task.itemId) : undefined;
        if (it?.kind !== kindFilter) return false;
      }
      return true;
    });
  }, [sessions, from, to, subjectFilter, kindFilter, taskById, itemById]);

  const groups = useMemo(() => {
    const map = new Map<string, { sortKey: string; label: string; sub?: string; sessions: Session[]; subjectIds: number[] }>();
    for (const s of filteredSessions) {
      const task = taskById.get(s.taskId);
      const item = task?.itemId ? itemById.get(task.itemId) : undefined;
      const collection = task?.collectionId ? collectionById.get(task.collectionId) : undefined;
      const segIds = task?.segmentIds ?? [];
      const seg = segIds.length ? segById.get(segIds[0]) : undefined;
      let key: string, label: string, sub: string | undefined;
      switch (groupBy) {
        case "task":
          key = `t:${s.taskId}`;
          label = task?.title ?? t("history.untitled");
          sub = item?.title ?? collection?.name;
          break;
        case "day":
          key = `d:${s.date}`;
          label = s.date;
          break;
        case "item":
          if (collection) { key = `c:${collection.id}`; label = collection.name; sub = t("history.collection"); }
          else { key = `i:${item?.id ?? "none"}`; label = item?.title ?? t("history.noItem"); }
          break;
        case "segment":
          key = `s:${seg?.id ?? "none"}`;
          label = seg?.label ?? t("history.noSegment");
          sub = item?.title ?? collection?.name;
          break;
      }
      if (!map.has(key)) map.set(key, { sortKey: "", label, sub, sessions: [], subjectIds: [] });
      const g = map.get(key)!;
      g.sessions.push(s);
      if (task?.subjectId != null && !g.subjectIds.includes(task.subjectId)) {
        g.subjectIds.push(task.subjectId);
      }
    }
    const cmp = (a: string, b: string) => sortDir === "newest" ? b.localeCompare(a) : a.localeCompare(b);
    for (const g of map.values()) {
      g.sessions.sort((a, b) => cmp(sessionSortKey(a), sessionSortKey(b)));
      g.sortKey = sessionSortKey(g.sessions[sortDir === "newest" ? 0 : g.sessions.length - 1]);
    }
    return Array.from(map.values()).sort((a, b) => cmp(a.sortKey, b.sortKey));
  }, [filteredSessions, taskById, itemById, segById, collectionById, groupBy, sortDir, t]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageGroups = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5 pb-24">
      <SessionFAB />
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">{t("history.title")}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("history.sessions", { count: filteredSessions.length })}
        </span>
      </div>

      <Tabs value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupKey); setPage(0); }}>
        <TabsList className="w-full">
          <TabsTrigger value="day" className="flex-1">{t("history.groupDay")}</TabsTrigger>
          <TabsTrigger value="task" className="flex-1">{t("history.groupTask")}</TabsTrigger>
          <TabsTrigger value="item" className="flex-1">{t("history.groupItem")}</TabsTrigger>
          <TabsTrigger value="segment" className="flex-1">{t("history.groupSegment")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-2">
        <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder={t("common.subject")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.allSubjects")}</SelectItem>
            {(subjects ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={(v) => { setKindFilter(v as typeof kindFilter); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k} className="capitalize">
                {k === "all" ? t("history.allKinds") : t(`library.kind.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            const v = e.target.value;
            setFrom(v);
            setPage(0);
            setSearchParams((p) => {
              if (v) p.set("from", v);
              else p.delete("from");
              return p;
            });
          }}
          placeholder={t("common.from")}
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            const v = e.target.value;
            setTo(v);
            setPage(0);
            setSearchParams((p) => {
              if (v) p.set("to", v);
              else p.delete("to");
              return p;
            });
          }}
          placeholder={t("common.to")}
        />
      </div>
      {(from || to) && (
        <button
          onClick={() => { setFrom(""); setTo(""); setSearchParams({}); }}
          className="text-xs text-primary hover:underline"
        >
          {t("history.clearFilter", { from: from || "…", to: to || "…" })}
        </button>
      )}

      <StatsDashboard from={from || undefined} to={to || undefined} sessions={filteredSessions} />

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setSortDir((d) => d === "newest" ? "oldest" : "newest")}>
          <ArrowDownUp className="h-4 w-4 mr-1" /> {sortDir === "newest" ? t("history.newestFirst") : t("history.oldestFirst")}
        </Button>
      </div>

      {sessions === undefined ? (
        <ListSkeleton />
      ) : pageGroups.length === 0 ? (
        <EmptyState title={t("history.noSessionsMatch")} />
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {pageGroups.map((g, i) => (
            <AccordionItem key={i} value={`g-${i}`} className="paper-card border-none px-4">
              <AccordionTrigger className="py-4 hover:no-underline gap-2">
                <div className="flex items-start justify-between gap-2 flex-1 min-w-0 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg break-words flex items-center gap-2 flex-wrap">
                      {g.subjectIds.map((sid) => {
                        const subj = subjectMap.get(sid) as Subject | undefined;
                        const color = getSubjectColor(subj?.color, subj?.type);
                        return (
                          <span
                            key={sid}
                            className="h-2 w-2 rounded-full shrink-0 inline-block"
                            style={{ backgroundColor: `hsl(var(--key-${color}))` }}
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
                    const task = taskById.get(s.taskId);
                    const subj = task?.subjectId != null ? subjectMap.get(task.subjectId) as Subject | undefined : undefined;
                    const color = getSubjectColor(subj?.color, subj?.type);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => setDetail(s)}
                          className="w-full flex items-start gap-2 text-left py-2 px-2 -mx-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 min-h-[44px]"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: `hsl(var(--key-${color}))` }}
                          />
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-sm break-words text-foreground">{groupBy === "day" ? task?.title : s.date}</span>
                            {(s.bpmReached || s.quality) && (
                              <span className="text-xs tabular-nums">
                                {s.bpmReached ? `${s.noteVal ? NOTE_GLYPH[s.noteVal] : "♩"}=${s.bpmReached}` : ""}
                                {s.bpmReached && s.quality ? " · " : ""}
                                {s.quality ? t(`session.quality${s.quality.charAt(0).toUpperCase() + s.quality.slice(1)}`) : ""}
                              </span>
                            )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <SessionDetailSheet open={detail !== null} onOpenChange={(o) => !o && setDetail(null)} session={detail} />
    </div>
  );
}

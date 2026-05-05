import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type Session } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ArrowDownUp } from "lucide-react";
import { SessionDetailSheet } from "@/components/diary/SessionDetailSheet";

const NOTE_GLYPH: Record<string, string> = {
  half: "𝅗𝅥", quarter: "♩", eighth: "♪", sixteenth: "𝅘𝅥𝅯",
};

type GroupKey = "task" | "day" | "item" | "segment";
type SortDir = "newest" | "oldest";
const PAGE_SIZE = 15;
const KINDS: ("all" | LibraryKind)[] = ["all", "repertoire", "manual", "technique", "theory"];

export default function History() {
  const sessions = useLiveQuery(() => db.sessions.toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const items = useLiveQuery(() => db.library.toArray());
  const segments = useLiveQuery(() => db.segments.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());

  const [groupBy, setGroupBy] = useState<GroupKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("newest");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<"all" | LibraryKind>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Session | null>(null);

  // Sync URL → state when navigated with date params (e.g. from heatmap)
  useEffect(() => {
    const f = searchParams.get("from") ?? "";
    const t = searchParams.get("to") ?? "";
    setFrom(f);
    setTo(t);
    setPage(0);
  }, [searchParams]);

  const taskById = useMemo(() => new Map((tasks ?? []).map((t) => [t.id!, t])), [tasks]);
  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id!, i])), [items]);
  const segById = useMemo(() => new Map((segments ?? []).map((s) => [s.id!, s])), [segments]);

  const filteredSessions = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      const t = taskById.get(s.taskId);
      if (subjectFilter !== "all" && t?.subjectId !== Number(subjectFilter)) return false;
      if (kindFilter !== "all") {
        const it = t?.itemId ? itemById.get(t.itemId) : undefined;
        if (it?.kind !== kindFilter) return false;
      }
      return true;
    });
  }, [sessions, from, to, subjectFilter, kindFilter, taskById, itemById]);

  const groups = useMemo(() => {
    const map = new Map<string, { sortKey: number; label: string; sub?: string; sessions: Session[] }>();
    for (const s of filteredSessions) {
      const task = taskById.get(s.taskId);
      const item = task?.itemId ? itemById.get(task.itemId) : undefined;
      const seg = task?.segmentId ? segById.get(task.segmentId) : undefined;
      let key: string, label: string, sub: string | undefined;
      switch (groupBy) {
        case "task": key = `t:${s.taskId}`; label = task?.title ?? "Untitled"; sub = item?.title; break;
        case "day": key = `d:${s.date}`; label = s.date; break;
        case "item": key = `i:${item?.id ?? "none"}`; label = item?.title ?? "No item"; break;
        case "segment": key = `s:${seg?.id ?? "none"}`; label = seg?.label ?? "No segment"; sub = item?.title; break;
      }
      if (!map.has(key)) map.set(key, { sortKey: 0, label, sub, sessions: [] });
      map.get(key)!.sessions.push(s);
    }
    // Stable sort: sort sessions in each group, then groups
    for (const g of map.values()) {
      g.sessions.sort((a, b) => sortDir === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
      g.sortKey = sortDir === "newest" ? Math.max(...g.sessions.map((s) => s.createdAt)) : Math.min(...g.sessions.map((s) => s.createdAt));
    }
    return Array.from(map.values()).sort((a, b) => sortDir === "newest" ? b.sortKey - a.sortKey : a.sortKey - b.sortKey);
  }, [filteredSessions, taskById, itemById, segById, groupBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageGroups = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">History</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{filteredSessions.length} sessions</span>
      </div>

      <Tabs value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupKey); setPage(0); }}>
        <TabsList className="w-full">
          <TabsTrigger value="day" className="flex-1">Day</TabsTrigger>
          <TabsTrigger value="task" className="flex-1">Task</TabsTrigger>
          <TabsTrigger value="item" className="flex-1">Item</TabsTrigger>
          <TabsTrigger value="segment" className="flex-1">Segment</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-2">
        <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {(subjects ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={(v) => { setKindFilter(v as typeof kindFilter); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k === "all" ? "All kinds" : k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); setSearchParams((p) => { e.target.value ? p.set("from", e.target.value) : p.delete("from"); return p; }); }} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); setSearchParams((p) => { e.target.value ? p.set("to", e.target.value) : p.delete("to"); return p; }); }} placeholder="To" />
      </div>
      {(from || to) && (
        <button
          onClick={() => { setFrom(""); setTo(""); setSearchParams({}); }}
          className="text-xs text-primary hover:underline"
        >
          Clear date filter ({from || "…"} → {to || "…"})
        </button>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setSortDir((d) => d === "newest" ? "oldest" : "newest")}>
          <ArrowDownUp className="h-4 w-4 mr-1" /> {sortDir === "newest" ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {pageGroups.length === 0 ? (
        <p className="paper-card p-6 text-center text-muted-foreground italic">No sessions match.</p>
      ) : (
        <ul className="space-y-3">
          {pageGroups.map((g, i) => (
            <li key={i} className="paper-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-serif text-lg truncate">{g.label}</div>
                  {g.sub && <div className="text-xs text-muted-foreground truncate">{g.sub}</div>}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {g.sessions.length} session{g.sessions.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="mt-2 pt-2 border-t border-border/60 space-y-1 text-sm">
                {g.sessions.slice(0, 6).map((s) => {
                  const task = taskById.get(s.taskId);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setDetail(s)}
                        className="w-full flex items-center justify-between gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <span className="truncate text-left">{groupBy === "day" ? task?.title : s.date}</span>
                        <span className="tabular-nums shrink-0">
                          {s.bpmReached ? `${s.noteVal ? NOTE_GLYPH[s.noteVal] : "♩"}=${s.bpmReached}` : ""}
                          {s.quality ? ` · ${s.quality}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {g.sessions.length > 6 && (
                  <li className="text-xs text-muted-foreground italic">+{g.sessions.length - 6} more…</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
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

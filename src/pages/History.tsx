import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Session } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";

const NOTE_GLYPH: Record<string, string> = {
  half: "𝅗𝅥", quarter: "♩", eighth: "♪", sixteenth: "𝅘𝅥𝅯",
};

type GroupKey = "task" | "day" | "item" | "segment";
const PAGE_SIZE = 15;

export default function History() {
  const sessions = useLiveQuery(() => db.sessions.orderBy("date").reverse().toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const items = useLiveQuery(() => db.library.toArray());
  const segments = useLiveQuery(() => db.segments.toArray());

  const [groupBy, setGroupBy] = useState<GroupKey>("day");
  const [page, setPage] = useState(0);

  const taskById = useMemo(() => new Map((tasks ?? []).map((t) => [t.id!, t])), [tasks]);
  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id!, i])), [items]);
  const segById = useMemo(() => new Map((segments ?? []).map((s) => [s.id!, s])), [segments]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; sub?: string; sessions: Session[] }>();
    for (const s of sessions ?? []) {
      const task = taskById.get(s.taskId);
      const item = task?.itemId ? itemById.get(task.itemId) : undefined;
      const seg = task?.segmentId ? segById.get(task.segmentId) : undefined;
      let key: string, label: string, sub: string | undefined;
      switch (groupBy) {
        case "task":
          key = `t:${s.taskId}`;
          label = task?.title ?? "Untitled task";
          sub = item?.title;
          break;
        case "day":
          key = `d:${s.date}`;
          label = s.date;
          break;
        case "item":
          key = `i:${item?.id ?? "none"}`;
          label = item?.title ?? "No item";
          break;
        case "segment":
          key = `s:${seg?.id ?? "none"}`;
          label = seg?.label ?? "No segment";
          sub = item?.title;
          break;
      }
      if (!map.has(key)) map.set(key, { label, sub, sessions: [] });
      map.get(key)!.sessions.push(s);
    }
    return Array.from(map.values()).sort((a, b) => {
      const la = Math.max(...a.sessions.map((s) => s.createdAt));
      const lb = Math.max(...b.sessions.map((s) => s.createdAt));
      return lb - la;
    });
  }, [sessions, taskById, itemById, segById, groupBy]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageGroups = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">History</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sessions?.length ?? 0} sessions
        </span>
      </div>

      <Tabs value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupKey); setPage(0); }}>
        <TabsList className="w-full">
          <TabsTrigger value="day" className="flex-1">Day</TabsTrigger>
          <TabsTrigger value="task" className="flex-1">Task</TabsTrigger>
          <TabsTrigger value="item" className="flex-1">Item</TabsTrigger>
          <TabsTrigger value="segment" className="flex-1">Segment</TabsTrigger>
        </TabsList>
      </Tabs>

      {pageGroups.length === 0 ? (
        <p className="paper-card p-6 text-center text-muted-foreground italic">No sessions logged yet.</p>
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
                    <li key={s.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span className="truncate">{groupBy === "day" ? task?.title : s.date}</span>
                      <span className="tabular-nums shrink-0">
                        {s.bpmReached ? `${s.noteVal ? NOTE_GLYPH[s.noteVal] : "♩"}=${s.bpmReached}` : ""}
                        {s.quality ? ` · ${s.quality}` : ""}
                      </span>
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
          <span className="text-sm text-muted-foreground tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type StudyPoolEntry, type StudyGroup, type StudyRoutine } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { studyRoutinesService } from "@/lib/services";
import type { StudyRoutineConfig } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, X, ChevronDown, ChevronRight, Search, Check, Minus, ChevronLeft } from "lucide-react";

interface PagerProps {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}
function Pager({ page, pageCount, onChange }: PagerProps) {
  const { t } = useI18n();
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-border">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="p-1 text-muted-foreground disabled:opacity-30"
        aria-label={t("pagination.prevPage")}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        className="p-1 text-muted-foreground disabled:opacity-30"
        aria-label={t("pagination.nextPage")}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function genId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function poolKey(e: StudyPoolEntry): string {
  return `${e.type}:${e.id}`;
}

const DAYS: { index: number; tKey: string }[] = [
  { index: 1, tKey: "weekday.1" },
  { index: 2, tKey: "weekday.2" },
  { index: 3, tKey: "weekday.3" },
  { index: 4, tKey: "weekday.4" },
  { index: 5, tKey: "weekday.5" },
  { index: 6, tKey: "weekday.6" },
  { index: 0, tKey: "weekday.0" },
];

interface Props {
  subjectId: number | undefined;
  date: string;
  onCreated: () => void;
  onCancel: () => void;
  /** When provided, the wizard prefills from an existing routine and runs in edit mode. */
  initial?: StudyRoutine;
}

export function StudyRoutineWizard({ subjectId, date, onCreated, onCancel, initial }: Props) {
  const { t } = useI18n();
  const isEdit = !!initial;
  const [step, setStep] = useState(1);

  // Build initial master pool from existing groups (union of all entries, deduped).
  const initialMasterPool = useMemo<StudyPoolEntry[]>(() => {
    if (!initial) return [];
    const seen = new Set<string>();
    const out: StudyPoolEntry[] = [];
    for (const g of initial.groups) {
      for (const e of g.pool) {
        const k = poolKey(e);
        if (!seen.has(k)) { seen.add(k); out.push(e); }
      }
    }
    return out;
  }, [initial]);

  // Routine name
  const [name, setName] = useState(initial?.name ?? "");

  // Step 1: master pool
  const [masterPool, setMasterPool] = useState<StudyPoolEntry[]>(initialMasterPool);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [poolTab, setPoolTab] = useState<"items" | "collections">("items");
  const [search, setSearch] = useState("");

  // Step 2: groups
  const [groups, setGroups] = useState<StudyGroup[]>(initial?.groups ?? []);
  const [newGroupName, setNewGroupName] = useState("");

  // Step 3: matrix + settings
  const [enabledDays, setEnabledDays] = useState<number[]>(
    initial ? Object.keys(initial.matrix).map(Number) : []
  );
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>(initial?.matrix ?? {});
  const [weeksAhead, setWeeksAhead] = useState(initial?.weeksAhead ?? 4);
  const [repetitionCap, setRepetitionCap] = useState(initial?.repetitionCap ?? 3);
  const [useSpacedRepetition, setUseSpacedRepetition] = useState(initial?.useSpacedRepetition ?? false);
  const [startDate, setStartDate] = useState(initial?.startDate ?? date);

  const [saving, setSaving] = useState(false);

  // DB queries
  const library = useLiveQuery(
    () =>
      subjectId
        ? db.library.where("subjectId").equals(subjectId).filter((i) => !i.deletedAt).toArray()
        : Promise.resolve([]),
    [subjectId]
  );
  const allSegments = useLiveQuery(
    () => db.segments.filter((s) => !s.deletedAt).toArray(),
    []
  );
  const allCollections = useLiveQuery(
    () => db.collections.filter((c) => !c.deletedAt).toArray(),
    []
  );

  const segmentsByItem = useMemo(() => {
    const map = new Map<number, NonNullable<typeof allSegments>>();
    for (const seg of allSegments ?? []) {
      const list = map.get(seg.itemId) ?? [];
      list.push(seg);
      map.set(seg.itemId, list);
    }
    return map;
  }, [allSegments]);

  const poolKeySet = useMemo(() => new Set(masterPool.map(poolKey)), [masterPool]);

  const addToPool = (entry: StudyPoolEntry) => {
    const k = poolKey(entry);
    if (!poolKeySet.has(k)) setMasterPool((prev) => [...prev, entry]);
  };

  const removeFromPool = (entry: StudyPoolEntry) => {
    const k = poolKey(entry);
    setMasterPool((prev) => prev.filter((e) => poolKey(e) !== k));
    setGroups((prev) =>
      prev.map((g) => ({ ...g, pool: g.pool.filter((e) => poolKey(e) !== k) }))
    );
  };

  const toggleExpandItem = (itemId: number) =>
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  // --- Step 2 helpers ---

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    setGroups((prev) => [...prev, { id: genId(), name, pool: [] }]);
    setNewGroupName("");
  };

  const removeGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setMatrix((prev) => {
      const next = { ...prev };
      for (const day of Object.keys(next)) {
        const { [groupId]: _, ...rest } = next[day];
        next[day] = rest;
      }
      return next;
    });
  };

  const toggleGroupEntry = (groupId: string, entry: StudyPoolEntry) => {
    const k = poolKey(entry);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const has = g.pool.some((e) => poolKey(e) === k);
        return { ...g, pool: has ? g.pool.filter((e) => poolKey(e) !== k) : [...g.pool, entry] };
      })
    );
  };

  const groupHasEntry = (groupId: string, entry: StudyPoolEntry) =>
    groups.find((g) => g.id === groupId)?.pool.some((e) => poolKey(e) === poolKey(entry)) ?? false;

  // --- Step 3 helpers ---

  const toggleDay = (day: number) => {
    const enabled = enabledDays.includes(day);
    if (enabled) {
      setEnabledDays((prev) => prev.filter((d) => d !== day));
      setMatrix((prev) => {
        const next = { ...prev };
        delete next[String(day)];
        return next;
      });
    } else {
      setEnabledDays((prev) => [...prev, day]);
      setMatrix((prev) => ({ ...prev, [String(day)]: {} }));
    }
  };

  const setCount = (day: number, groupId: string, count: number) => {
    setMatrix((prev) => ({
      ...prev,
      [String(day)]: { ...(prev[String(day)] ?? {}), [groupId]: Math.max(0, count) },
    }));
  };

  const getCount = (day: number, groupId: string): number =>
    matrix[String(day)]?.[groupId] ?? 0;

  const dayTotal = (day: number): number =>
    groups.reduce((sum, g) => sum + getCount(day, g.id), 0);

  // --- Validation ---

  const step1Errors = useMemo(() => {
    if (!subjectId) return [t("errors.pickSubject")];
    if (!name.trim()) return [t("studyRoutine.errorNoName")];
    if (masterPool.length === 0) return [t("studyRoutine.errorNoPool")];
    return [];
  }, [subjectId, name, masterPool, t]);

  const step2Errors = useMemo(() => {
    if (groups.length === 0) return [t("studyRoutine.errorNoGroups")];
    if (groups.some((g) => g.pool.length === 0)) return [t("studyRoutine.errorNoGroupItems")];
    return [];
  }, [groups, t]);

  const step3Errors = useMemo(() => {
    if (enabledDays.length === 0) return [t("studyRoutine.errorNoDays")];
    return [];
  }, [enabledDays, t]);

  // --- Pool entry label ---

  const poolEntryLabel = (entry: StudyPoolEntry): string => {
    if (entry.type === "item") {
      const item = (library ?? []).find((i) => i.id === entry.id);
      return item?.title ?? String(entry.id);
    }
    if (entry.type === "segment") {
      const seg = (allSegments ?? []).find((s) => s.id === entry.id);
      if (!seg) return String(entry.id);
      const item = (library ?? []).find((i) => i.id === seg.itemId);
      return `${item?.title ?? "—"} — ${seg.label}`;
    }
    const col = (allCollections ?? []).find((c) => c.id === entry.id);
    return col?.name ?? String(entry.id);
  };

  // --- Submit ---

  const submit = async () => {
    if (step3Errors.length || !subjectId) return;
    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        await studyRoutinesService.update(initial.id, {
          name: name.trim(),
          groups,
          matrix,
          weeksAhead,
          repetitionCap,
          useSpacedRepetition,
          startDate,
        });
        toast.success(t("toast.routineUpdated"));
      } else {
        const config: StudyRoutineConfig = {
          name: name.trim(),
          subjectId,
          groups,
          matrix,
          weeksAhead,
          repetitionCap,
          useSpacedRepetition,
          startDate,
        };
        await studyRoutinesService.create(config);
        toast.success(t("toast.routineCreated"));
      }
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // --- Filtered lists ---

  const q = search.trim().toLowerCase();
  const filteredLibrary = useMemo(() => {
    const list = library ?? [];
    if (!q) return list;
    return list.filter((i) => {
      if (i.title.toLowerCase().includes(q)) return true;
      if (i.composer?.toLowerCase().includes(q)) return true;
      const segs = segmentsByItem.get(i.id!) ?? [];
      return segs.some((s) => s.label.toLowerCase().includes(q));
    });
  }, [library, q, segmentsByItem]);

  const filteredCollections = useMemo(() => {
    const list = allCollections ?? [];
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.composer?.toLowerCase().includes(q),
    );
  }, [allCollections, q]);

  // --- Pagination ---
  const PAGE_SIZE = 5;
  const [libraryPage, setLibraryPage] = useState(1);
  const [collectionsPage, setCollectionsPage] = useState(1);
  const [segmentPages, setSegmentPages] = useState<Record<number, number>>({});

  useEffect(() => {
    setLibraryPage(1);
    setCollectionsPage(1);
  }, [q]);

  const libraryPageCount = Math.max(1, Math.ceil(filteredLibrary.length / PAGE_SIZE));
  const collectionsPageCount = Math.max(1, Math.ceil(filteredCollections.length / PAGE_SIZE));
  const pagedLibrary = filteredLibrary.slice(
    (libraryPage - 1) * PAGE_SIZE,
    libraryPage * PAGE_SIZE,
  );
  const pagedCollections = filteredCollections.slice(
    (collectionsPage - 1) * PAGE_SIZE,
    collectionsPage * PAGE_SIZE,
  );

  const getSegPage = (itemId: number) => segmentPages[itemId] ?? 1;
  const setSegPage = (itemId: number, page: number) =>
    setSegmentPages((prev) => ({ ...prev, [itemId]: page }));

  // --- Render ---

  return (
    <div className="space-y-5">
      {/* Compact step indicator (dots + active label) */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {t(`studyRoutine.step${step}`)}{" "}
          <span className="text-muted-foreground/60">· {step}/3</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                step === s ? "w-6 bg-primary" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Step 1: Pool Selection ────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("studyRoutine.name")}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("studyRoutine.namePlaceholder")}
              maxLength={100}
              className="h-9"
            />
          </div>
          {!subjectId ? (
            <p className="text-sm text-muted-foreground">{t("errors.pickSubject")}</p>
          ) : (
            <>
              <Tabs value={poolTab} onValueChange={(v) => setPoolTab(v as "items" | "collections")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="items">
                    {t("studyRoutine.items")}
                    {masterPool.filter((e) => e.type !== "collection").length > 0 && (
                      <span className="ml-1.5 text-[10px] px-1.5 rounded-full bg-primary/15 text-primary">
                        {masterPool.filter((e) => e.type !== "collection").length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="collections">
                    {t("studyRoutine.collections")}
                    {masterPool.filter((e) => e.type === "collection").length > 0 && (
                      <span className="ml-1.5 text-[10px] px-1.5 rounded-full bg-primary/15 text-primary">
                        {masterPool.filter((e) => e.type === "collection").length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Search */}
                <div className="relative mt-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("studyRoutine.searchPlaceholder")}
                    className="pl-8 h-9"
                  />
                </div>

                <TabsContent value="items" className="mt-3">
                  {filteredLibrary.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {t("studyRoutine.noResults")}
                    </p>
                  ) : (
                    <div className="paper-card">
                      <div className="divide-y divide-border">
                        {pagedLibrary.map((item) => {
                          const segs = segmentsByItem.get(item.id!) ?? [];
                          const inPool = poolKeySet.has(`item:${item.id}`);
                          const expanded = expandedItems.has(item.id!);
                          const segsInPool = segs.filter((s) => poolKeySet.has(`segment:${s.id}`)).length;
                          const segPage = getSegPage(item.id!);
                          const segPageCount = Math.max(1, Math.ceil(segs.length / PAGE_SIZE));
                          const pagedSegs = segs.slice((segPage - 1) * PAGE_SIZE, segPage * PAGE_SIZE);
                          return (
                            <div key={item.id}>
                              <div className="flex items-center gap-2 p-2">
                                {segs.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandItem(item.id!)}
                                    className="p-1 -m-1 text-muted-foreground"
                                    aria-label={t("studyRoutine.toggleSegments")}
                                  >
                                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </button>
                                ) : (
                                  <span className="w-3.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">{item.title}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {item.composer && <span>{item.composer}</span>}
                                    {item.composer && segs.length > 0 && <span> · </span>}
                                    {segs.length > 0 && (
                                      <span>
                                        {segsInPool > 0
                                          ? `${segsInPool}/${segs.length} ${t("studyRoutine.segments").toLowerCase()}`
                                          : `${segs.length} ${t("studyRoutine.segments").toLowerCase()}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    inPool
                                      ? removeFromPool({ type: "item", id: item.id! })
                                      : addToPool({ type: "item", id: item.id! })
                                  }
                                  className={cn(
                                    "shrink-0 h-7 w-7 rounded-full border flex items-center justify-center transition-colors",
                                    inPool
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-border text-muted-foreground hover:text-foreground"
                                  )}
                                  aria-label={inPool ? t("common.remove") : t("common.add")}
                                >
                                  {inPool ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                              {expanded && segs.length > 0 && (
                                <div className="pl-7 pb-1 divide-y divide-border/50 bg-muted/20">
                                  {pagedSegs.map((seg) => {
                                    const segInPool = poolKeySet.has(`segment:${seg.id}`);
                                    return (
                                      <div key={seg.id} className="flex items-center gap-2 py-1.5 pr-2">
                                        <span className="flex-1 text-xs text-muted-foreground truncate">{seg.label}</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            segInPool
                                              ? removeFromPool({ type: "segment", id: seg.id! })
                                              : addToPool({ type: "segment", id: seg.id! })
                                          }
                                          className={cn(
                                            "shrink-0 h-6 w-6 rounded-full border flex items-center justify-center transition-colors",
                                            segInPool
                                              ? "bg-primary text-primary-foreground border-primary"
                                              : "border-border text-muted-foreground hover:text-foreground"
                                          )}
                                          aria-label={segInPool ? t("common.remove") : t("common.add")}
                                        >
                                          {segInPool ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                        </button>
                                      </div>
                                    );
                                  })}
                                  <Pager
                                    page={segPage}
                                    pageCount={segPageCount}
                                    onChange={(p) => setSegPage(item.id!, p)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Pager page={libraryPage} pageCount={libraryPageCount} onChange={setLibraryPage} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="collections" className="mt-3">
                  {filteredCollections.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {t("studyRoutine.noResults")}
                    </p>
                  ) : (
                    <div className="paper-card">
                      <div className="divide-y divide-border">
                        {pagedCollections.map((col) => {
                          const inPool = poolKeySet.has(`collection:${col.id}`);
                          return (
                            <div key={col.id} className="flex items-center gap-2 p-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{col.name}</div>
                                {col.composer && (
                                  <div className="text-[10px] text-muted-foreground truncate">{col.composer}</div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  inPool
                                    ? removeFromPool({ type: "collection", id: col.id! })
                                    : addToPool({ type: "collection", id: col.id! })
                                }
                                className={cn(
                                  "shrink-0 h-7 w-7 rounded-full border flex items-center justify-center transition-colors",
                                  inPool
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:text-foreground"
                                )}
                                aria-label={inPool ? t("common.remove") : t("common.add")}
                              >
                                {inPool ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <Pager page={collectionsPage} pageCount={collectionsPageCount} onChange={setCollectionsPage} />
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Selected summary (collapsible) */}
              {masterPool.length > 0 && (
                <Accordion type="single" collapsible className="paper-card px-3">
                  <AccordionItem value="selected" className="border-0">
                    <AccordionTrigger className="py-2.5 hover:no-underline">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {t("studyRoutine.masterPool")}{" "}
                        <span className="text-primary">({masterPool.length})</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {masterPool.map((entry) => (
                          <span
                            key={poolKey(entry)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent/60 max-w-full"
                          >
                            <span className="truncate max-w-[180px]">{poolEntryLabel(entry)}</span>
                            <button
                              type="button"
                              onClick={() => removeFromPool(entry)}
                              className="ml-0.5 opacity-60 hover:opacity-100 shrink-0"
                              aria-label={t("common.remove")}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </>
          )}

          {step1Errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {step1Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Step 2: Groups ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t("studyRoutine.groupNamePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGroup())}
              className="h-9"
            />
            <Button type="button" variant="outline" onClick={addGroup} disabled={!newGroupName.trim()} className="h-9 shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("studyRoutine.noGroups")}
            </p>
          ) : (
            <Accordion type="multiple" defaultValue={groups.map((g) => g.id)} className="space-y-2">
              {groups.map((group) => (
                <AccordionItem
                  key={group.id}
                  value={group.id}
                  className="paper-card border-0 px-3"
                >
                  <div className="flex items-center gap-2">
                    <AccordionTrigger className="flex-1 py-2.5 hover:no-underline">
                      <div className="flex items-center gap-2 text-left">
                        <span className="font-medium text-sm">{group.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {group.pool.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <button
                      type="button"
                      onClick={() => removeGroup(group.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                      aria-label={t("studyRoutine.removeGroup")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <AccordionContent className="pb-3 space-y-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-8"
                          disabled={masterPool.length === 0}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          {t("studyRoutine.addItems")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0 max-h-[280px] overflow-y-auto" align="start">
                        {masterPool.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3">
                            {t("studyRoutine.poolEmpty")}
                          </p>
                        ) : (
                          <div className="p-1">
                            {masterPool.map((entry) => {
                              const checked = groupHasEntry(group.id, entry);
                              return (
                                <label
                                  key={poolKey(entry)}
                                  className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-accent"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleGroupEntry(group.id, entry)}
                                  />
                                  <span className="truncate">{poolEntryLabel(entry)}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>

                    {group.pool.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        {t("studyRoutine.noItemsAssigned")}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {group.pool.map((entry) => (
                          <span
                            key={poolKey(entry)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent/60 max-w-full"
                          >
                            <span className="truncate max-w-[160px]">{poolEntryLabel(entry)}</span>
                            <button
                              type="button"
                              onClick={() => toggleGroupEntry(group.id, entry)}
                              className="ml-0.5 opacity-60 hover:opacity-100 shrink-0"
                              aria-label={t("common.remove")}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {step2Errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {step2Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Step 3: Matrix + Settings ─────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("studyRoutine.weeklyMatrix")}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(({ index, tKey }) => {
                const on = enabledDays.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors min-w-[44px]",
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(tKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {enabledDays.length > 0 && (
            <Accordion type="multiple" defaultValue={enabledDays.map(String)} className="space-y-2">
              {DAYS.filter(({ index }) => enabledDays.includes(index)).map(({ index, tKey }) => {
                const total = dayTotal(index);
                return (
                  <AccordionItem
                    key={index}
                    value={String(index)}
                    className="paper-card border-0 px-3"
                  >
                    <AccordionTrigger className="py-2.5 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-2">
                        <span className="font-medium text-sm">{t(tKey)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {total} {t("studyRoutine.itemsShort")}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 space-y-2">
                      {groups.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          {t("studyRoutine.noGroups")}
                        </p>
                      ) : (
                        groups.map((group) => {
                          const c = getCount(index, group.id);
                          return (
                            <div key={group.id} className="flex items-center gap-2">
                              <span className="flex-1 text-xs text-muted-foreground truncate">{group.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setCount(index, group.id, c - 1)}
                                  className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted disabled:opacity-40"
                                  disabled={c === 0}
                                  aria-label={t("common.decrease")}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="tabular-nums text-sm w-6 text-center">{c}</span>
                                <button
                                  type="button"
                                  onClick={() => setCount(index, group.id, c + 1)}
                                  className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted"
                                  aria-label={t("common.increase")}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {/* Week preview */}
          {enabledDays.length > 0 && (
            <Accordion type="single" collapsible className="paper-card px-3">
              <AccordionItem value="preview" className="border-0">
                <AccordionTrigger className="py-2.5 hover:no-underline">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("routine.weekPreview")}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  {groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">{t("routine.previewEmpty")}</p>
                  ) : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${enabledDays.length}, 1fr)` }}>
                      {DAYS.filter(({ index }) => enabledDays.includes(index)).map(({ index, tKey }) => {
                        const dayGroups = groups
                          .map((g) => ({ name: g.name, count: getCount(index, g.id) }))
                          .filter((x) => x.count > 0);
                        const total = dayGroups.reduce((s, x) => s + x.count, 0);
                        return (
                          <div key={index} className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                              {t(tKey)}
                            </div>
                            <div className="rounded-lg bg-muted/50 p-1.5 min-h-[2rem] space-y-0.5">
                              {total === 0 ? (
                                <p className="text-[9px] text-muted-foreground/50 text-center">—</p>
                              ) : (
                                dayGroups.map((g) => (
                                  <div key={g.name} className="text-[9px] bg-primary/15 text-primary rounded px-1 py-0.5 text-center truncate">
                                    {g.count}× {g.name}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Advanced settings (collapsed by default) */}
          <Accordion type="single" collapsible className="paper-card px-3">
            <AccordionItem value="advanced" className="border-0">
              <AccordionTrigger className="py-2.5 hover:no-underline">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("studyRoutine.advanced")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("studyRoutine.startDate")}</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t("studyRoutine.weeksAhead")}: <span className="text-foreground font-medium">{weeksAhead}</span>
                  </Label>
                  <Slider
                    value={[weeksAhead]}
                    min={1}
                    max={48}
                    step={1}
                    onValueChange={([v]) => setWeeksAhead(v)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("studyRoutine.repetitionCap")}</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    value={repetitionCap}
                    onChange={(e) => setRepetitionCap(Math.max(1, Number(e.target.value) || 1))}
                    className="h-9"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{t("studyRoutine.spacedRepetition")}</div>
                    <div className="text-xs text-muted-foreground">{t("studyRoutine.spacedRepetitionDesc")}</div>
                  </div>
                  <Switch checked={useSpacedRepetition} onCheckedChange={setUseSpacedRepetition} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {step3Errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {step3Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 pt-2 pb-[env(safe-area-inset-bottom)]">
        <Button
          variant="outline"
          className="flex-1"
          onClick={step === 1 ? onCancel : () => setStep((s) => s - 1)}
        >
          {step === 1 ? t("common.cancel") : t("common.prev")}
        </Button>

        {step < 3 ? (
          <Button
            className="flex-1"
            disabled={step === 1 ? step1Errors.length > 0 : step2Errors.length > 0}
            onClick={() => setStep((s) => s + 1)}
          >
            {t("common.next")}
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={step3Errors.length > 0 || saving}
            onClick={submit}
          >
            {isEdit ? t("studyRoutine.save") : t("studyRoutine.create")}
          </Button>
        )}
      </div>
    </div>
  );
}

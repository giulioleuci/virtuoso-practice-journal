import { useState, useMemo } from "react";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react";

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

  // Step 1: master pool
  const [masterPool, setMasterPool] = useState<StudyPoolEntry[]>(initialMasterPool);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

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
    const map = new Map<number, typeof allSegments>();
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
    // Remove from all groups
    setGroups((prev) =>
      prev.map((g) => ({ ...g, pool: g.pool.filter((e) => poolKey(e) !== k) }))
    );
  };

  const toggleExpandItem = (itemId: number) =>
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
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

  // --- Validation ---

  const step1Errors = useMemo(() => {
    if (!subjectId) return [t("errors.pickSubject")];
    if (masterPool.length === 0) return [t("studyRoutine.errorNoPool")];
    return [];
  }, [subjectId, masterPool, t]);

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
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                  ? "bg-primary/30 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {s}
            </span>
            <span className={step === s ? "text-foreground font-medium" : ""}>
              {t(`studyRoutine.step${s}`)}
            </span>
            {s < 3 && <span className="text-muted-foreground/40">›</span>}
          </div>
        ))}
      </div>

      {/* ── Step 1: Pool Selection ────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {!subjectId ? (
            <p className="text-sm text-muted-foreground">{t("errors.pickSubject")}</p>
          ) : (
            <>
              {/* Library items */}
              {(library ?? []).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("studyRoutine.items")}
                  </Label>
                  <div className="paper-card divide-y divide-border">
                    {(library ?? []).map((item) => {
                      const segs = segmentsByItem.get(item.id!) ?? [];
                      const inPool = poolKeySet.has(`item:${item.id}`);
                      const expanded = expandedItems.has(item.id!);
                      return (
                        <div key={item.id}>
                          <div className="flex items-center gap-2 p-2">
                            {segs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleExpandItem(item.id!)}
                                className="p-0.5 text-muted-foreground"
                              >
                                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </button>
                            )}
                            <span className="flex-1 text-sm">{item.title}</span>
                            <button
                              type="button"
                              onClick={() =>
                                inPool
                                  ? removeFromPool({ type: "item", id: item.id! })
                                  : addToPool({ type: "item", id: item.id! })
                              }
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full border transition-colors",
                                inPool
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {inPool ? "✓" : <Plus className="h-3 w-3" />}
                            </button>
                          </div>
                          {expanded && segs.length > 0 && (
                            <div className="pl-6 pb-1 divide-y divide-border/50">
                              {segs.map((seg) => {
                                const segInPool = poolKeySet.has(`segment:${seg.id}`);
                                return (
                                  <div key={seg.id} className="flex items-center gap-2 py-1.5 pr-2">
                                    <span className="flex-1 text-xs text-muted-foreground">{seg.label}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        segInPool
                                          ? removeFromPool({ type: "segment", id: seg.id! })
                                          : addToPool({ type: "segment", id: seg.id! })
                                      }
                                      className={cn(
                                        "text-xs px-2 py-0.5 rounded-full border transition-colors",
                                        segInPool
                                          ? "bg-primary/10 border-primary text-primary"
                                          : "border-border text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      {segInPool ? "✓" : <Plus className="h-3 w-3" />}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Collections */}
              {(allCollections ?? []).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("studyRoutine.collections")}
                  </Label>
                  <div className="paper-card divide-y divide-border">
                    {(allCollections ?? []).map((col) => {
                      const inPool = poolKeySet.has(`collection:${col.id}`);
                      return (
                        <div key={col.id} className="flex items-center gap-2 p-2">
                          <span className="flex-1 text-sm">{col.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              inPool
                                ? removeFromPool({ type: "collection", id: col.id! })
                                : addToPool({ type: "collection", id: col.id! })
                            }
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full border transition-colors",
                              inPool
                                ? "bg-primary/10 border-primary text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {inPool ? "✓" : <Plus className="h-3 w-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current pool */}
              {masterPool.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("studyRoutine.masterPool")} ({masterPool.length})
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {masterPool.map((entry) => (
                      <span
                        key={poolKey(entry)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent/60"
                      >
                        {poolEntryLabel(entry)}
                        <button type="button" onClick={() => removeFromPool(entry)} className="ml-0.5 opacity-60 hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
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
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t("studyRoutine.groupNamePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
            />
            <Button type="button" variant="outline" onClick={addGroup} disabled={!newGroupName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("studyRoutine.noGroups")}</p>
          )}

          {groups.map((group) => (
            <div key={group.id} className="paper-card p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm flex-1">{group.name}</span>
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("studyRoutine.assignItems")}
                </Label>
                {masterPool.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("studyRoutine.poolEmpty")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {masterPool.map((entry) => {
                      const checked = groupHasEntry(group.id, entry);
                      return (
                        <label
                          key={poolKey(entry)}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleGroupEntry(group.id, entry)}
                          />
                          <span>{poolEntryLabel(entry)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {step2Errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {step2Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Step 3: Matrix + Settings ─────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-3">
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
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
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

            {enabledDays.length > 0 && (
              <div className="space-y-3">
                {DAYS.filter(({ index }) => enabledDays.includes(index)).map(({ index, tKey }) => (
                  <div key={index} className="paper-card p-3 space-y-2">
                    <div className="font-medium text-sm">{t(tKey)}</div>
                    {groups.map((group) => (
                      <div key={group.id} className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-muted-foreground">{group.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCount(index, group.id, getCount(index, group.id) - 1)}
                            className="w-6 h-6 rounded border text-sm font-bold flex items-center justify-center hover:bg-muted"
                          >
                            −
                          </button>
                          <span className="tabular-nums text-sm w-6 text-center">
                            {getCount(index, group.id)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCount(index, group.id, getCount(index, group.id) + 1)}
                            className="w-6 h-6 rounded border text-sm font-bold flex items-center justify-center hover:bg-muted"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("studyRoutine.startDate")}
            </Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("studyRoutine.weeksAhead")}: {weeksAhead}
              </Label>
            </div>
            <Slider
              value={[weeksAhead]}
              min={1}
              max={48}
              step={1}
              onValueChange={([v]) => setWeeksAhead(v)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("studyRoutine.repetitionCap")}
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={repetitionCap}
              onChange={(e) => setRepetitionCap(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div className="paper-card p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{t("studyRoutine.spacedRepetition")}</div>
              <div className="text-xs text-muted-foreground">{t("studyRoutine.spacedRepetitionDesc")}</div>
            </div>
            <Switch checked={useSpacedRepetition} onCheckedChange={setUseSpacedRepetition} />
          </div>

          {step3Errors.length > 0 && (
            <ul className="text-xs text-destructive">
              {step3Errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 pt-2">
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
            {t("studyRoutine.create")}
          </Button>
        )}
      </div>
    </div>
  );
}

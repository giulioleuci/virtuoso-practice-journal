import { TempoProgressionFields } from "./TempoProgressionFields";
import { tempoRuleSchema } from "@/lib/schemas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, ListChecks, Minus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { LibraryItem } from "@/domain/entities/library";
import type { StudyGroup, StudyPoolEntry, StudyRoutine } from "@/domain/ports/studyRoutine";
import type { StudyRoutineConfig } from "@/lib/schemas";
import { LIBRARY_KINDS } from "@/lib/constants";
import { applicationCommands } from "@/lib/applicationCommands";
import { collectRoutineWarnings, poolEntryKey, routineAdaptivity, type Adaptivity } from "@/lib/domain/studyRoutineGenerator";
import { formatDate, today } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useSessionSubmission } from "@/presentation/hooks/usePresentationControllers";
import { useCollectionLinks, useCollections, useSegments, useSubjects } from "@/presentation/hooks/useEntities";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pager } from "@/components/shared/Pager";
import { usePagination } from "@/hooks/usePagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { StateNotice } from "@/components/shared/StateNotice";
import { FilterPanel, FilterSelect } from "@/components/shared/FilterPanel";
import { FloatingActions } from "@/components/shared/FloatingActions";

import { ImportanceSelect } from "./ImportanceSelect";
import { nativeSelect } from "./WhenFields";

const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const WEEKDAYS = [1, 2, 3, 4, 5];
const MAX_PER_CELL = 10;
const genId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
type Matrix = Record<string, Record<string, number>>;

const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs min-[700px]:min-h-9 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
    on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40",
  );

/** One-page routine editor: groups, materials per group, weekly matrix and generation options. */
export function RoutineBuilder({ initial, onDone, onCancel }: {
  initial?: StudyRoutine;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t, lang } = useI18n();
  const subjects = useSubjects();
  const allSegments = useSegments();
  const collections = useCollections();
  const collectionLinks = useCollectionLinks();
  const [collectionId, setCollectionId] = useState<number>();
  const isEdit = !!initial;

  const [tempoRule,setTempoRule] = useState(initial?.tempoRule);
  const [tempoValid,setTempoValid] = useState(true);
  const [name, setName] = useState(initial?.name ?? "");
  const [subjectId, setSubjectId] = useState<number | undefined>(initial?.subjectId);
  const [groups, setGroups] = useState<StudyGroup[]>(initial?.groups ?? [{ id: genId(), name: t("routine.groupDaily"), pool: [] }]);
  const [matrix, setMatrix] = useState<Matrix>(initial?.matrix ?? {});
  const [weeks, setWeeks] = useState(initial?.weeksAhead ?? 4);
  const [capInput, setCap] = useState<number | undefined>(initial?.repetitionCap);
  const [adaptivity, setAdaptivity] = useState<Adaptivity>(initial ? routineAdaptivity(initial) : "uniform");
  const [uniformOpen, setUniformOpen] = useState(false);
  const [avoidBackToBack, setAvoidBackToBack] = useState(initial?.avoidBackToBack ?? true);
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [search, setSearch] = useState("");
  const [activeDay, setActiveDay] = useState(1);
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>();
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [openSections, setOpenSections] = useState<number | null>(null);
  const [segmentPage, setSegmentPage] = useState(0);
  const [onlySelected, setOnlySelected] = useState(false);
  // "Selected only" shows the rows picked when it was switched on, so unticking one does not make it vanish under the finger.
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [onlySelectedSegs, setOnlySelectedSegs] = useState(false);

  const subject = subjectId ?? subjects?.[0]?.id;
  const library = usePresentationRead<LibraryItem[]>("library.subject", [subject]);
  const suggestedName = t("routine.suggestedName", { subject: subjects?.find((s) => s.id === subject)?.name ?? "" });

  const command = useMemo(
    () => async (config: StudyRoutineConfig) => {
      if (initial) await applicationCommands.routines.update(initial.id, config);
      else await applicationCommands.routines.generate.execute(config);
    },
    [initial],
  );
  const { submitting, submit } = useSessionSubmission(command);

  const segmentsByItem = useMemo(() => {
    const map = new Map<number, NonNullable<typeof allSegments>>();
    for (const s of allSegments ?? []) map.set(s.itemId, [...(map.get(s.itemId) ?? []), s]);
    return map;
  }, [allSegments]);

  const q = search.trim().toLowerCase();
  const selectedCollection = collections?.find(c => c.id === collectionId);
  const collectionItems = useMemo(() => {
    const byId = new Map((library ?? []).map(item => [item.id, item]));
    return (collectionLinks ?? []).filter(link => link.collectionId === collectionId)
      .sort((a, b) => a.position - b.position).flatMap(link => byId.get(link.itemId) ?? []);
  }, [library, collectionLinks, collectionId]);
  const sourceItems = collectionId === undefined ? library ?? [] : collectionItems;
  const matchesItem = (i: LibraryItem) => !q || `${i.title} ${i.composer ?? ""} ${i.catalog ?? ""} ${(segmentsByItem.get(i.id!) ?? []).map(s => s.label).join(" ")}`.toLowerCase().includes(q);
  const items = sourceItems.filter(matchesItem);
  const kinds = LIBRARY_KINDS.filter(k => sourceItems.some(i => i.kind === k.key));
  const visibleCollections = (collections ?? []).filter(c =>
    !q || `${c.name} ${c.composer ?? ""}`.toLowerCase().includes(q) ||
    (collectionLinks ?? []).some(link => link.collectionId === c.id && (library ?? []).some(i => i.id === link.itemId && matchesItem(i))),
  );
  type Row = { key: string; title: string; composer?: string; entry: StudyPoolEntry; itemId?: number; kindLabel: string };
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0];
  const isPicked = (e: StudyPoolEntry, itemId?: number) => !!activeGroup && (
    activeGroup.pool.some((x) => poolEntryKey(x) === poolEntryKey(e)) ||
    (segmentsByItem.get(itemId ?? -1) ?? []).some((sg) => activeGroup.pool.some((x) => x.type === "segment" && x.id === sg.id)));
  const allRows: Row[] = [
    ...items.filter(i => kindFilter === "repertoire" ? i.inRepertoire : kindFilter === "all" || i.kind === kindFilter).map(i => ({
      key: `i${i.id}`, title: i.title, composer: i.composer, entry: { type: "item" as const, id: i.id! }, itemId: i.id,
      kindLabel: t(LIBRARY_KINDS.find(k => k.key === i.kind)?.tKey ?? ""),
    })),
    ...(collectionId === undefined && (kindFilter === "all" || kindFilter === "collection") ? visibleCollections : []).map(c => ({
      key: `c${c.id}`, title: c.name, composer: c.composer, entry: { type: "collection" as const, id: c.id! }, kindLabel: t("studyRoutine.collections"),
    })),
  ];
  const pin = () => setPinned(new Set(allRows.filter((r) => isPicked(r.entry, r.itemId)).map((r) => r.key)));
  const rows = onlySelected ? allRows.filter((r) => pinned.has(r.key)) : allRows;
  const pager = usePagination(rows, 8);

  // ── groups & pools ──────────────────────────────────────────────
  const has = (g: StudyGroup, e: StudyPoolEntry) => g.pool.some((x) => poolEntryKey(x) === poolEntryKey(e));
  const setEntries = (groupId: string, entries: StudyPoolEntry[], on: boolean) =>
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const keys = new Set(entries.map(poolEntryKey));
        const rest = g.pool.filter((x) => !keys.has(poolEntryKey(x)));
        return { ...g, pool: on ? [...rest, ...entries] : rest };
      }),
    );
  const moveGroup = (id: string, by: -1 | 1) => {
    // Pin the group being filled by identity: reordering must not switch the assignment target.
    setActiveGroupId(activeGroup?.id);
    setGroups((prev) => {
      const i = prev.findIndex((g) => g.id === id), j = i + by;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const addGroup = (n = "") => setGroups((prev) => [...prev, { id: genId(), name: n, pool: [] }]);
  const removeGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setMatrix((prev) => Object.fromEntries(Object.entries(prev).map(([d, row]) => [d, Object.fromEntries(Object.entries(row).filter(([gid]) => gid !== id))])));
  };
  const changeSubject = (id: number) => {
    if (groups.some((g) => g.pool.length) && !window.confirm(t("routine.subjectChangeWarning"))) return;
    setSubjectId(id);
    setCollectionId(undefined);
    setOpenSections(null);
    setGroups((prev) => prev.map((g) => ({ ...g, pool: [] })));
  };

  // ── matrix ──────────────────────────────────────────────────────
  const count = (day: number, gid: string) => matrix[String(day)]?.[gid] ?? 0;
  const dayTotal = (day: number) => groups.reduce((s, g) => s + count(day, g.id), 0);
  const setCount = (day: number, gid: string, n: number) =>
    setMatrix((prev) => ({ ...prev, [String(day)]: { ...prev[String(day)], [gid]: Math.min(MAX_PER_CELL, Math.max(0, n)) } }));
  const rowOf = (day: number) => Object.fromEntries(groups.map((g) => [g.id, count(day, g.id)]));
  const copyDay = (from: number, to: number[]) =>
    setMatrix((prev) => ({ ...prev, ...Object.fromEntries(to.map((d) => [String(d), rowOf(from)])) }));
  const setDayOn = (day: number, on: boolean) =>
    setMatrix((prev) => ({ ...prev, [String(day)]: Object.fromEntries(groups.map((g) => [g.id, on ? (perDay ?? 1) : 0])) }));
  const setColumn = (gid: string, n: number) =>
    setMatrix((prev) => {
      const next = { ...prev };
      for (const d of DAYS) if (dayTotal(d) > 0) next[String(d)] = { ...(next[String(d)] ?? {}), [gid]: n };
      return next;
    });
  const activeDays = DAYS.filter((d) => dayTotal(d) > 0);
  const firstDay = activeDays[0];
  const cap = capInput ?? Math.min(20, Math.max(1, activeDays.length)); // default: one repetition per selected day
  const dayName = (d: number) => t(`weekday.${d}`);
  const sameRow = (day: number) => groups.every((g) => count(day, g.id) === count(firstDay, g.id));
  const regular = activeDays.length > 0 && activeDays.every(sameRow);
  const single = groups.length === 1 ? groups[0] : undefined;
  const perDay = single && regular ? count(firstDay, single.id) : undefined;
  const setPerDay = (n: number) => single && setMatrix((prev) => ({ ...prev, ...Object.fromEntries(activeDays.map((d) => [String(d), { [single.id]: Math.min(MAX_PER_CELL, Math.max(1, n)) }])) }));
  const uniformChanges = activeDays.filter((d) => !sameRow(d)).map((d) => `${dayName(d)}: ${dayTotal(d)} → ${dayTotal(firstDay)}`);
  const warnings = collectRoutineWarnings({ groups, matrix, repetitionCap: cap });

  // ── validation & submit ─────────────────────────────────────────
  const errors = [
    subject === undefined && t("routine.errorNoSubject"),
    groups.length === 0 && t("studyRoutine.errorNoGroups"),
    ...groups.filter((g) => g.pool.length === 0).map((g) => t("routine.errorGroupEmpty", { group: g.name || t("routine.groupName", { n: groups.indexOf(g) + 1 }) })),
    groups.some((g) => !g.name.trim()) && t("routine.errorGroupName"),
    activeDays.length === 0 && t("studyRoutine.errorNoDays"),
  ].filter((e): e is string => !!e);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length || !tempoValid || subject === undefined || submitting) return;
    if (tempoRule) tempoRuleSchema.parse(tempoRule);
    const clean: Matrix = {};
    for (const d of activeDays) clean[String(d)] = rowOf(d);
    const ok = await submit({ name: name.trim() || suggestedName, subjectId: subject, groups, matrix: clean, weeksAhead: weeks, repetitionCap: cap, adaptivity, avoidBackToBack, startDate, tempoRule });
    if (ok) {
      toast.success(t(isEdit ? "toast.routineUpdated" : "toast.routineCreated"));
      onDone();
    } else toast.error(t("quick.failed"));
  };

  const active = activeGroup;
  // The language's own short weekday (cutting "Dienstag" to "Die" is wrong); 2024-01-07 is a Sunday.
  const short = (d: number) => new Date(Date.UTC(2024, 0, 7 + d)).toLocaleDateString(lang, { weekday: "short", timeZone: "UTC" });
  const poolSize = new Set(groups.flatMap((g) => g.pool.map(poolEntryKey))).size;
  const perWeek = activeDays.reduce((s, d) => s + dayTotal(d), 0);

  const stepper = (day: number, g: StudyGroup) => {
    const n = count(day, g.id);
    return (
      <span className="inline-flex items-center gap-1">
        <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={n <= 0} aria-label={t("routine.lessOne", { group: g.name })} onClick={() => setCount(day, g.id, n - 1)}><Minus /></Button>
        <output className="w-7 text-center font-numeric text-sm tabular-nums" aria-label={`${g.name} ${dayName(day)}`}>{n}</output>
        <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={n >= MAX_PER_CELL} aria-label={t("routine.moreOne", { group: g.name })} onClick={() => setCount(day, g.id, n + 1)}><Plus /></Button>
      </span>
    );
  };

  return (
    <div className="grid gap-6 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px] min-[1151px]:gap-8">
      <form onSubmit={save} className="min-w-0 rounded-lg bg-card p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium">
            {t("studyRoutine.name")}
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={suggestedName} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            {t("common.subject")}
            <Select value={String(subject ?? "")} onValueChange={(value) => changeSubject(Number(value))} ><SelectTrigger className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>
              {subjects?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent></Select>
          </label>
        </div>

        <section className="mt-7 border-t border-border pt-6">
          <h2 className="mb-3 font-serif text-2xl font-semibold">{t("routine.groups")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t("routine.orderHint")}</p>
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("routine.groupsHint")}</p>
          ) : (
            <ul className="grid gap-2">
              {groups.map((g, i) => (
                <li key={g.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Input aria-label={t("routine.groupName", { n: i + 1 })} placeholder={t("routine.groupName", { n: i + 1 })} value={g.name} required maxLength={80} onChange={(e) => setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))} />
                    {g.combine && <span className="mt-1 inline-block text-xs text-muted-foreground">{t("routine.mergedTag")}</span>}
                    <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{t("routine.groupCount", { count: g.pool.length })}</span>
                    <div className="mt-1.5"><ImportanceSelect ariaLabel={`${t("importance.label")}: ${g.name}`} value={g.importance} onChange={(importance) => setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, importance } : x)))} /></div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {/* aria-disabled, not disabled: the arrow that reaches the end keeps focus instead of dropping it to the page. */}
                    <Button type="button" size="icon" variant="ghost" className="h-11 w-11 aria-disabled:opacity-50" aria-disabled={i === 0} aria-label={`${t("segments.moveUp")}: ${g.name}`} onClick={() => i > 0 && moveGroup(g.id, -1)}><ArrowUp /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-11 w-11 aria-disabled:opacity-50" aria-disabled={i === groups.length - 1} aria-label={`${t("segments.moveDown")}: ${g.name}`} onClick={() => i < groups.length - 1 && moveGroup(g.id, 1)}><ArrowDown /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0" aria-label={t("routine.moreActions")}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuCheckboxItem checked={!!g.combine} onCheckedChange={(on) => setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, combine: on } : x)))}>{t("routine.combineGroup")}</DropdownMenuCheckboxItem>
                        <DropdownMenuItem disabled={!g.pool.length} onSelect={() => setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, pool: [] } : x)))}>{t("routine.clearGroup")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => removeGroup(g.id)}><Trash2 />{t("studyRoutine.removeGroup")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" size="sm" variant="ghost" className="mt-2 max-sm:min-h-11" onClick={() => addGroup()}><Plus />{t("routine.addGroup")}</Button>
        </section>

        {groups.length > 0 && (
          <>
            <section className="mt-7 border-t border-border pt-6">
              <h2 className="mb-3 font-serif text-2xl font-semibold">{t("routine.materials")}</h2>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("routine.assignTo")}</p>
              <div role="tablist" aria-label={t("routine.assignTo")} className="mb-4 flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <button key={g.id} type="button" role="tab" aria-selected={g.id === active?.id} onClick={() => { setActiveGroupId(g.id); setOnlySelected(false); }} className={chip(g.id === active?.id)}>
                    {g.name || t("routine.groupFallback")}<span className="font-numeric tabular-nums opacity-70">{g.pool.length}</span>
                  </button>
                ))}
              </div>
              {selectedCollection && <div className="mb-3 space-y-2 border-b border-border pb-3">
                <Button type="button" variant="ghost" className="h-11" onClick={() => { setCollectionId(undefined); setKindFilter("collection"); setOpenSections(null); pager.reset(); }}>{t("filters.backToCollections")}</Button>
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                  <Checkbox checked={has(active, { type: "collection", id: selectedCollection.id! })} onCheckedChange={on => setEntries(active.id, [{ type: "collection", id: selectedCollection.id! }], on === true)} />
                  {selectedCollection.name}
                </label>
                <p className="text-xs text-muted-foreground">{t("filters.collectionSelectionHint")}</p>
              </div>}
              <FilterPanel
                search={{ value: search, onChange: value => { setSearch(value); pager.reset(); }, placeholder: t("bulk.searchPlaceholder") }}
                filters={kindFilter === "all" ? [] : [{ key: "kind", label: kindFilter === "collection" ? t("studyRoutine.collections") : kindFilter === "repertoire" ? t("repertoire.title") : t(`library.kind.${kindFilter}`), onRemove: () => { setKindFilter("all"); pager.reset(); } }]}
                onReset={() => { setSearch(""); setKindFilter("all"); pager.reset(); }} resultCount={rows.length}
              >
                <FilterSelect label={t("routine.kindFilter")} value={kindFilter} onChange={value => { setKindFilter(value); pager.reset(); }} options={[
                  { value: "all", label: t("routine.kindAll") }, { value: "repertoire", label: t("repertoire.title") },
                  ...kinds.map(k => ({ value: k.key, label: t(k.tKey) })),
                  ...(collectionId === undefined && collections?.length ? [{ value: "collection", label: t("studyRoutine.collections") }] : []),
                ]} />
              </FilterPanel>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={onlySelected ? "secondary" : "outline"} aria-pressed={onlySelected} onClick={() => { if (!onlySelected) pin(); setOnlySelected(v => !v); pager.reset(); }}><Check />{t("routine.onlySelected")}</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button type="button" variant="outline" disabled={!active || !rows.length}><ListChecks />{t("common.select")}<ChevronDown /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => active && setEntries(active.id, rows.map((r) => r.entry), true)}>{t("routine.selectVisible", { n: rows.length })}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => active && setEntries(active.id, rows.map((r) => r.entry), false)}>{t("routine.clearVisible")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {!active ? null : rows.length === 0 ? (
                kinds.length === 0 && !collections?.length ? <EmptyState title={t("routine.noMaterials")} hint={t("routine.noMaterialsHint")} /> : <p className="py-6 text-center text-sm text-muted-foreground">{onlySelected && active ? t("routine.noneSelected", { group: active.name }) : t("common.noResults")}</p>
              ) : (
                <>
                  <ul className="divide-y divide-border border-y border-border">
                    {pager.pageItems.map((r) => {
                      const segs = r.itemId === undefined ? [] : segmentsByItem.get(r.itemId) ?? [];
                      const segOn = segs.filter((sg) => has(active, { type: "segment", id: sg.id! })).length;
                      const shownSegs = onlySelectedSegs ? segs.filter((sg) => has(active, { type: "segment", id: sg.id! })) : segs;
                      const others = groups.filter((g) => g.id !== active.id && has(g, r.entry)).map((g) => g.name || t("routine.groupFallback"));
                      const expanded = openSections === r.itemId && r.itemId !== undefined;
                      return (
                        <li key={r.key} className="py-2.5">
                          <div className="flex items-center gap-3">
                            <Checkbox id={`pool-${r.key}`} className="h-5 w-5" checked={has(active, r.entry)} onCheckedChange={(on) => setEntries(active.id, [r.entry], on === true)} />
                            <label htmlFor={`pool-${r.key}`} className="min-w-0 flex-1 cursor-pointer">
                              <span className="block truncate text-sm font-medium">{r.title}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[r.composer, kindFilter === "all" ? r.kindLabel : undefined, others.length ? t("routine.alsoIn", { groups: others.join(", ") }) : undefined].filter(Boolean).join(" · ")}
                              </span>
                            </label>
                            {r.entry.type === "collection" && <Button type="button" size="sm" variant="outline" className="min-h-11 shrink-0" aria-label={t("filters.collectionContents", { name: r.title })} onClick={() => { setCollectionId(r.entry.id); setKindFilter("all"); setSearch(""); setOpenSections(null); pager.reset(); }}><ChevronDown aria-hidden="true" />{t("collection.items")}</Button>}
                            {segs.length > 0 && (
                              <Popover open={expanded} onOpenChange={open => { setOpenSections(open ? r.itemId! : null); setSegmentPage(0); }}>
                                <PopoverTrigger asChild>
                                  <Button type="button" size="sm" variant="ghost" className="min-h-11 shrink-0 tabular-nums" aria-label={`${r.title}: ${t("routine.sectionsCount", { on: segOn, n: segs.length })}`}>
                                    {t("routine.sectionsCount", { on: segOn, n: segs.length })}<ChevronDown />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" collisionPadding={16} aria-label={r.title} className="max-h-[var(--radix-popover-content-available-height)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto">
                                  <div className="mb-3 grid grid-cols-2 gap-2">
                                    <Button type="button" size="sm" variant="ghost" className="h-auto min-h-11 whitespace-normal" onClick={() => setEntries(active.id, segs.map(sg => ({ type: "segment", id: sg.id! })), true)}>{t("common.selectAll")}</Button>
                                    <Button type="button" size="sm" variant="ghost" className="h-auto min-h-11 whitespace-normal" onClick={() => setEntries(active.id, segs.map(sg => ({ type: "segment", id: sg.id! })), false)}>{t("common.removeAll")}</Button>
                                    <Button type="button" size="sm" variant={onlySelectedSegs ? "secondary" : "ghost"} aria-pressed={onlySelectedSegs} className="col-span-2 h-auto min-h-11 whitespace-normal" onClick={() => { setOnlySelectedSegs(v => !v); setSegmentPage(0); }}><Check />{t("routine.onlySelected")}</Button>
                                  </div>
                                  <ul className="divide-y divide-border border-y border-border">
                                    {shownSegs.slice(segmentPage * 5, segmentPage * 5 + 5).map(sg => {
                                      const entry: StudyPoolEntry = { type: "segment", id: sg.id! };
                                      return <li key={sg.id}><label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm">
                                        <Checkbox checked={has(active, entry)} onCheckedChange={on => setEntries(active.id, [entry], on === true)} />{sg.label}
                                      </label></li>;
                                    })}
                                  </ul>
                                  <Pager page={segmentPage} totalPages={Math.ceil(shownSegs.length / 5)} onChange={setSegmentPage} />
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <Pager page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} />
                </>
              )}
            </section>

            <section className="mt-7 border-t border-border pt-6">
              <h2 className="mb-3 font-serif text-2xl font-semibold">{t("routine.when")}</h2>
              <div role="group" aria-label={t("routine.studyDays")} className="flex flex-wrap items-center gap-1.5">
                {DAYS.map((d) => {
                  const on = dayTotal(d) > 0;
                  return (
                    <label key={d} className={chip(on)}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => setDayOn(d, e.target.checked)} />
                      {short(d)}
                    </label>
                  );
                })}
                <Button type="button" size="sm" variant="ghost" className="max-sm:min-h-11" onClick={() => DAYS.forEach((d) => setDayOn(d, WEEKDAYS.includes(d)))}>{t("quick.repeat.weekdays")}</Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("routine.dayHint")}</p>

              {perDay !== undefined ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">{t("routine.perDay")}</span>
                  <span className="inline-flex items-center gap-1">
                    <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={perDay <= 1} aria-label={t("routine.lessOne", { group: single!.name })} onClick={() => setPerDay(perDay - 1)}><Minus /></Button>
                    <output className="w-7 text-center font-numeric text-sm tabular-nums" aria-label={t("routine.perDay")}>{perDay}</output>
                    <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={perDay >= MAX_PER_CELL} aria-label={t("routine.moreOne", { group: single!.name })} onClick={() => setPerDay(perDay + 1)}><Plus /></Button>
                  </span>
                </div>
              ) : regular ? (
                <p className="mt-4 text-sm tabular-nums">{t("routine.perDayFixed", { n: dayTotal(firstDay) })}</p>
              ) : activeDays.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">{t("routine.irregularWeek")}</p>
                  <ul className="text-sm tabular-nums">{activeDays.map((d) => <li key={d}>{dayName(d)}: {dayTotal(d)}</li>)}</ul>
                  <Button type="button" size="sm" variant="outline" className="max-sm:min-h-11" onClick={() => setUniformOpen(true)}>{t("routine.uniformize")}</Button>
                </div>
              )}

              <details open={activeDays.length > 0 && !regular} className="mt-6">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-primary">{t("routine.customizeWeek")}</summary>

              {/* Phone: one day at a time */}
              <div className="mt-4 min-[700px]:hidden">
                <div role="tablist" aria-label={t("routine.dayTabs")} className="grid grid-cols-7 gap-0.5 border-b border-border">
                  {DAYS.map((d) => (
                    <button key={d} type="button" role="tab" id={`day-tab-${d}`} aria-selected={activeDay === d} aria-controls={`day-panel-${d}`} onClick={() => setActiveDay(d)}
                      className={cn("-mb-px grid min-h-11 content-center justify-items-center border-b-2 py-1.5 text-xs", activeDay === d ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
                      <span>{short(d)}</span>
                      <span className="h-4 font-numeric text-xs">{dayTotal(d) || ""}</span>
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={`day-panel-${activeDay}`} aria-labelledby={`day-tab-${activeDay}`} className="pt-3">
                  {groups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5">
                      <span className="min-w-0 truncate text-sm">{g.name}</span>
                      {stepper(activeDay, g)}
                    </div>
                  ))}
                  {dayTotal(activeDay) === 0 && <p className="mt-2 text-xs text-muted-foreground">{t("routine.dayRest", { day: dayName(activeDay) })}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="max-sm:min-h-11" onClick={() => copyDay(activeDay, WEEKDAYS)}><Copy />{t("routine.copyWeekdays")}</Button>
                    <Button type="button" size="sm" variant="ghost" className="max-sm:min-h-11" onClick={() => copyDay(activeDay, DAYS)}>{t("routine.copyAll")}</Button>
                    <Button type="button" size="sm" variant="ghost" className="max-sm:min-h-11" onClick={() => setDayOn(activeDay, false)}>{t("routine.rest")}</Button>
                  </div>
                </div>
              </div>

              {/* Desktop: whole week as a matrix */}
              <div className="mt-4 hidden overflow-x-auto min-[700px]:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      <th className="py-2 pr-3">{t("routine.dayCol")}</th>
                      {groups.map((g) => (
                        <th key={g.id} className="px-2 py-2 text-center">
                          <div>{g.name}</div>
                          <div className="flex justify-center gap-0.5">
                            <Button type="button" size="sm" variant="ghost" className="h-9 min-w-9 px-2" aria-label={t("routine.colZero", { group: g.name })} onClick={() => setColumn(g.id, 0)}>0</Button>
                            <Button type="button" size="sm" variant="ghost" className="h-9 min-w-9 px-2" aria-label={t("routine.colOne", { group: g.name })} onClick={() => setColumn(g.id, 1)}>1</Button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((d) => (
                      <tr key={d} className={cn("border-b border-border", dayTotal(d) === 0 && "opacity-50")}>
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">{dayName(d)}</th>
                        {groups.map((g) => <td key={g.id} className="px-2 py-1.5 text-center">{stepper(d, g)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {firstDay !== undefined && (
                  <Button type="button" size="sm" variant="outline" className="mt-3 max-sm:min-h-11" onClick={() => copyDay(firstDay, DAYS)}><Copy />{t("routine.copyFirst", { day: dayName(firstDay) })}</Button>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{t("routine.zeroHint")}</p>
              </div>
              </details>
            </section>
          </>
        )}

        <details className="mt-7 border-t border-border pt-5">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
            {t("routine.options")}
            <span className="ml-3 text-xs font-normal text-muted-foreground">{t("routine.optionsSummary", { weeks, cap })} · {t(`studyRoutine.adaptivity${adaptivity[0].toUpperCase()}${adaptivity.slice(1)}`)}</span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium">{t("studyRoutine.startDate")}<Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label className="grid gap-1.5 text-xs font-medium">{t("routine.weeks")}<Input type="number" inputMode="numeric" min={1} max={48} required value={weeks} onChange={(e) => setWeeks(Math.min(48, Math.max(1, Number(e.target.value) || 1)))} /></label>
            <label className="grid gap-1.5 text-xs font-medium">{t("studyRoutine.repetitionCap")}<Input type="number" inputMode="numeric" min={1} max={20} required value={cap} onChange={(e) => setCap(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} /></label>
            <label className="grid gap-1.5 text-xs font-medium">
              {t("studyRoutine.adaptivity")}
              <Select value={adaptivity} onValueChange={(value) => setAdaptivity(value as Adaptivity)} ><SelectTrigger className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>
                {(["uniform", "balanced", "aggressive"] as const).map((l) => <SelectItem key={l} value={String(l)}>{t(`studyRoutine.adaptivity${l[0].toUpperCase()}${l.slice(1)}`)}</SelectItem>)}
              </SelectContent></Select>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{t("studyRoutine.avoidBackToBack")}</div>
              <div className="text-xs text-muted-foreground">{t("studyRoutine.avoidBackToBackDesc")}</div>
            </div>
            <Switch checked={avoidBackToBack} onCheckedChange={setAvoidBackToBack} aria-label={t("studyRoutine.avoidBackToBack")} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("routine.adaptivityHelp")}</p>
        </details>

        <TempoProgressionFields value={tempoRule} onChange={setTempoRule} onValidityChange={setTempoValid} disabled={submitting} />
        {errors.length > 0 && (
          <StateNotice className="mt-6">
            <p className="font-medium">{t("routine.errorsTitle")}</p>
            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </StateNotice>
        )}
        {isEdit && <p className="mt-6 text-xs text-muted-foreground">{t("routine.appliesFrom", { date: formatDate(today(), lang, "medium") })}</p>}
        <FloatingActions className="flex-wrap [&>button]:h-auto [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:whitespace-normal">
          <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={errors.length > 0 || !tempoValid || submitting}><Check />{t(isEdit ? "routine.save" : "routine.create")}</Button>
        </FloatingActions>
      </form>

      <aside className="min-w-0 space-y-4 text-sm">
        <h3 className="font-serif text-xl font-semibold">{t("routine.preview")}</h3>
        <p className="text-xs text-muted-foreground">{subjects?.find((s) => s.id === subject)?.name}</p>
        <p className="tabular-nums">{t("routine.previewPool", { count: poolSize })}</p>
        <div className="border-t border-border pt-3">
          {activeDays.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("routine.previewDays")}</p>
          ) : (
            activeDays.map((d) => (
              <div key={d} className="flex gap-3 py-0.5 text-[0.8125rem]">
                <strong className="w-8 shrink-0">{short(d)}</strong>
                <span>{groups.filter((g) => count(d, g.id) > 0).map((g) => `${g.name} ×${count(d, g.id)}`).join(", ")}</span>
              </div>
            ))
          )}
        </div>
        {warnings.length > 0 && (
          <ul aria-label={t("routine.warningsTitle")} className="space-y-1 border-t border-border pt-3 text-xs text-warning">
            {warnings.filter((w, i) => warnings.findIndex((x) => x.groupName === w.groupName) === i).map((w, i) => (
              <li key={i}>{w.kind === "dayExceedsPool" ? t("routine.warnDayExceedsPool", { day: dayName(w.day ?? 0), group: w.groupName }) : t("routine.warnCapTooLow", { group: w.groupName })}</li>
            ))}
          </ul>
        )}
        <p className="border-t border-border pt-3 tabular-nums">{t("routine.previewMax", { n: perWeek * weeks, weeks })}</p>
        <p className="text-xs text-muted-foreground">{t("routine.previewNote")}</p>
      </aside>

      <AlertDialog open={uniformOpen} onOpenChange={setUniformOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("routine.uniformize")}</AlertDialogTitle>
            <AlertDialogDescription>{t("routine.uniformizeDesc", { day: firstDay === undefined ? "" : dayName(firstDay) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-sm tabular-nums">{uniformChanges.map((c) => <li key={c}>{c}</li>)}</ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => copyDay(firstDay, activeDays)}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

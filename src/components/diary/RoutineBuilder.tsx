import { useMemo, useState } from "react";
import { Check, Copy, ListMusic, Minus, Plus, Trash2, Wand2 } from "lucide-react";
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
import { useCollections, useSegments, useSubjects } from "@/presentation/hooks/useEntities";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/shared/EmptyState";
import { StateNotice } from "@/components/shared/StateNotice";
import { nativeSelect } from "./WhenFields";

const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const WEEKDAYS = [1, 2, 3, 4, 5];
const MAX_PER_CELL = 10;
const genId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
type Matrix = Record<string, Record<string, number>>;

const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
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
  const isEdit = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [subjectId, setSubjectId] = useState<number | undefined>(initial?.subjectId);
  const [groups, setGroups] = useState<StudyGroup[]>(initial?.groups ?? [{ id: genId(), name: t("routine.groupDaily"), pool: [] }]);
  const [matrix, setMatrix] = useState<Matrix>(initial?.matrix ?? {});
  const [weeks, setWeeks] = useState(initial?.weeksAhead ?? 4);
  const [cap, setCap] = useState(initial?.repetitionCap ?? 3);
  const [adaptivity, setAdaptivity] = useState<Adaptivity>(initial ? routineAdaptivity(initial) : "uniform");
  const [uniformOpen, setUniformOpen] = useState(false);
  const [avoidBackToBack, setAvoidBackToBack] = useState(initial?.avoidBackToBack ?? true);
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [search, setSearch] = useState("");
  const [activeDay, setActiveDay] = useState(1);

  const subject = subjectId ?? subjects?.[0]?.id;
  const library = usePresentationRead<LibraryItem[]>("library.subject", [subject]);
  const suggestedName = t("routine.suggestedName", { subject: subjects?.find((s) => s.id === subject)?.name ?? "" });

  const command = useMemo(
    () => async (config: StudyRoutineConfig) => {
      if (initial) await applicationCommands.routines.update.execute(initial.id, config);
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
  const items = useMemo(
    () => (library ?? []).filter((i) => !q || `${i.title} ${i.composer ?? ""}`.toLowerCase().includes(q)),
    [library, q],
  );
  const kinds = LIBRARY_KINDS.filter((k) => items.some((i) => i.kind === k.key));

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
  const itemEntry = (i: LibraryItem): StudyPoolEntry => ({ type: "item", id: i.id! });
  const addGroup = (n = "") => setGroups((prev) => [...prev, { id: genId(), name: n, pool: [] }]);
  const removeGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setMatrix((prev) => Object.fromEntries(Object.entries(prev).map(([d, row]) => [d, Object.fromEntries(Object.entries(row).filter(([gid]) => gid !== id))])));
  };
  const changeSubject = (id: number) => {
    setSubjectId(id);
    setGroups((prev) => prev.map((g) => ({ ...g, pool: [] })));
  };

  const applyTemplate = (kind: "mixed" | "daily" | "reset") => {
    if (kind === "reset") {
      setGroups([]);
      setMatrix({});
      return;
    }
    const all = library ?? [];
    const of = (...ks: string[]) => all.filter((i) => ks.includes(i.kind)).map(itemEntry);
    const next: StudyGroup[] =
      kind === "mixed"
        ? [
            { id: genId(), name: t("routine.groupTechnique"), pool: of("technique", "manual") },
            { id: genId(), name: t("routine.groupRepertoire"), pool: of("repertoire") },
          ]
        : [{ id: genId(), name: t("routine.groupDaily"), pool: of("repertoire").length ? of("repertoire") : all.map(itemEntry) }];
    setGroups(next);
    setMatrix(Object.fromEntries(WEEKDAYS.map((d) => [String(d), Object.fromEntries(next.map((g) => [g.id, 1]))])));
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
    groups.length > 0 && groups.some((g) => g.pool.length === 0) && t("studyRoutine.errorNoGroupItems"),
    groups.some((g) => !g.name.trim()) && t("routine.errorGroupName"),
    activeDays.length === 0 && t("studyRoutine.errorNoDays"),
  ].filter((e): e is string => !!e);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length || subject === undefined || submitting) return;
    const clean: Matrix = {};
    for (const d of activeDays) clean[String(d)] = rowOf(d);
    const ok = await submit({ name: name.trim() || suggestedName, subjectId: subject, groups, matrix: clean, weeksAhead: weeks, repetitionCap: cap, adaptivity, avoidBackToBack, startDate });
    if (ok) {
      toast.success(t(isEdit ? "toast.routineUpdated" : "toast.routineCreated"));
      onDone();
    } else toast.error(t("quick.failed"));
  };

  const short = (d: number) => dayName(d).slice(0, 3);
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

  const groupChips = (entries: StudyPoolEntry[], label: string) => (
    <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {groups.map((g) => {
        const on = entries.every((e) => has(g, e));
        return (
          <label key={g.id} className={chip(on)}>
            <input type="checkbox" className="sr-only" checked={on} onChange={(e) => setEntries(g.id, entries, e.target.checked)} />
            {on && <Check className="h-3 w-3" />}
            {g.name || t("routine.groupFallback")}
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-6 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px] min-[1151px]:gap-8">
      <form onSubmit={save} className="min-w-0 rounded-[14px] bg-card p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium">
            {t("studyRoutine.name")}
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={suggestedName} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            {t("common.subject")}
            <select value={subject} onChange={(e) => changeSubject(Number(e.target.value))} className={nativeSelect}>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>

        <section className="mt-7 border-t border-border pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-2xl font-semibold">{t("routine.groups")}</h2>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("mixed")}><Wand2 />{t("routine.templateMixed")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("daily")}><Wand2 />{t("routine.templateDaily")}</Button>
              {groups.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => applyTemplate("reset")}>{t("routine.templateReset")}</Button>}
            </div>
          </div>
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("routine.groupsHint")}</p>
          ) : (
            <ul className="grid gap-3">
              {groups.map((g, i) => (
                <li key={g.id} className="grid items-end gap-3 min-[700px]:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="grid gap-1.5 text-xs font-medium">
                    {t("routine.groupName", { n: i + 1 })}
                    <Input value={g.name} required maxLength={80} onChange={(e) => setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))} />
                  </label>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" title={t("routine.assignAllTitle")} onClick={() => setEntries(g.id, items.map(itemEntry), true)}>{t("common.all")}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEntries(g.id, items.map(itemEntry), false)}>{t("common.none")}</Button>
                    <Button type="button" size="icon" variant="ghost" className="h-10 w-10 hover:text-destructive" aria-label={t("studyRoutine.removeGroup")} onClick={() => removeGroup(g.id)}><Trash2 /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => addGroup()}><Plus />{t("routine.addGroup")}</Button>
        </section>

        {groups.length > 0 && (
          <>
            <section className="mt-7 border-t border-border pt-6">
              <h2 className="mb-3 font-serif text-2xl font-semibold">{t("routine.materials")}</h2>
              <label className="mb-4 grid gap-1.5 text-xs font-medium">
                {t("bulk.search")}
                <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("bulk.searchPlaceholder")} />
              </label>
              {kinds.length === 0 ? (
                <EmptyState title={t("routine.noMaterials")} hint={t("routine.noMaterialsHint")} />
              ) : (
                kinds.map(({ key, tKey }) => {
                  const ofKind = items.filter((i) => i.kind === key);
                  return (
                    <div key={key} className="mt-5 first:mt-0">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[0.8125rem] font-semibold">{t(tKey)}</h3>
                        <div className="flex flex-wrap gap-1">
                          {groups.map((g) => (
                            <Button key={g.id} type="button" size="sm" variant="ghost" onClick={() => setEntries(g.id, ofKind.map(itemEntry), true)}>
                              {t("routine.allIn", { group: g.name || t("routine.groupFallback") })}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <ul className="divide-y divide-border">
                        {ofKind.map((item) => {
                          const segs = segmentsByItem.get(item.id!) ?? [];
                          return (
                            <li key={item.id} className="py-3">
                              <div><strong className="font-medium">{item.title}</strong> <span className="text-xs text-muted-foreground">{item.composer}</span></div>
                              {groupChips([itemEntry(item)], item.title)}
                              {segs.length > 0 && (
                                <details className="mt-2">
                                  <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"><ListMusic className="h-3.5 w-3.5" />{t("routine.pickSections", { count: segs.length })}</summary>
                                  <ul className="mt-2 grid gap-2 border-l border-border pl-3">
                                    {segs.map((s) => (
                                      <li key={s.id}>
                                        <span className="text-[0.8125rem]">{s.label}</span>
                                        {groupChips([{ type: "segment", id: s.id }], s.label)}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
              {(collections?.length ?? 0) > 0 && (
                <div className="mt-6">
                  <h3 className="mb-1 text-[0.8125rem] font-semibold">{t("studyRoutine.collections")}</h3>
                  <ul className="divide-y divide-border">
                    {collections!.filter((c) => !q || c.name.toLowerCase().includes(q)).map((c) => (
                      <li key={c.id} className="py-3">
                        <strong className="font-medium">{c.name}</strong> <span className="text-xs text-muted-foreground">{c.composer}</span>
                        {groupChips([{ type: "collection", id: c.id! }], c.name)}
                      </li>
                    ))}
                  </ul>
                </div>
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
                <Button type="button" size="sm" variant="ghost" onClick={() => DAYS.forEach((d) => setDayOn(d, WEEKDAYS.includes(d)))}>{t("quick.repeat.weekdays")}</Button>
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
                  <Button type="button" size="sm" variant="outline" onClick={() => setUniformOpen(true)}>{t("routine.uniformize")}</Button>
                </div>
              )}

              <details open={!regular} className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-primary">{t("routine.customizeWeek")}</summary>

              {/* Phone: one day at a time */}
              <div className="mt-4 min-[700px]:hidden">
                <div role="tablist" aria-label={t("routine.dayTabs")} className="grid grid-cols-7 gap-0.5 border-b border-border">
                  {DAYS.map((d) => (
                    <button key={d} type="button" role="tab" id={`day-tab-${d}`} aria-selected={activeDay === d} aria-controls={`day-panel-${d}`} onClick={() => setActiveDay(d)}
                      className={cn("-mb-px grid justify-items-center border-b-2 py-1.5 text-xs", activeDay === d ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
                      <span>{short(d)}</span>
                      <span className="h-4 font-numeric text-[0.6875rem]">{dayTotal(d) || ""}</span>
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
                    <Button type="button" size="sm" variant="outline" onClick={() => copyDay(activeDay, WEEKDAYS)}><Copy />{t("routine.copyWeekdays")}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => copyDay(activeDay, DAYS)}>{t("routine.copyAll")}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDayOn(activeDay, false)}>{t("routine.rest")}</Button>
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
                            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" aria-label={t("routine.colZero", { group: g.name })} onClick={() => setColumn(g.id, 0)}>0</Button>
                            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" aria-label={t("routine.colOne", { group: g.name })} onClick={() => setColumn(g.id, 1)}>1</Button>
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
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => copyDay(firstDay, DAYS)}><Copy />{t("routine.copyFirst", { day: dayName(firstDay) })}</Button>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{t("routine.zeroHint")}</p>
              </div>
              </details>
            </section>
          </>
        )}

        <details className="mt-7 border-t border-border pt-5">
          <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 text-sm font-medium">
            {t("routine.options")}
            <span className="text-xs font-normal text-muted-foreground">{t("routine.optionsSummary", { weeks, cap })} · {t(`studyRoutine.adaptivity${adaptivity[0].toUpperCase()}${adaptivity.slice(1)}`)}</span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium">{t("studyRoutine.startDate")}<Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label className="grid gap-1.5 text-xs font-medium">{t("routine.weeks")}<Input type="number" inputMode="numeric" min={1} max={48} required value={weeks} onChange={(e) => setWeeks(Math.min(48, Math.max(1, Number(e.target.value) || 1)))} /></label>
            <label className="grid gap-1.5 text-xs font-medium">{t("studyRoutine.repetitionCap")}<Input type="number" inputMode="numeric" min={1} max={20} required value={cap} onChange={(e) => setCap(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} /></label>
            <label className="grid gap-1.5 text-xs font-medium">
              {t("studyRoutine.adaptivity")}
              <select value={adaptivity} onChange={(e) => setAdaptivity(e.target.value as Adaptivity)} className={nativeSelect}>
                {(["uniform", "balanced", "aggressive"] as const).map((l) => <option key={l} value={l}>{t(`studyRoutine.adaptivity${l[0].toUpperCase()}${l.slice(1)}`)}</option>)}
              </select>
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

        {errors.length > 0 && (
          <StateNotice className="mt-6">
            <p className="font-medium">{t("routine.errorsTitle")}</p>
            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </StateNotice>
        )}
        {isEdit && <p className="mt-6 text-xs text-muted-foreground">{t("routine.appliesFrom", { date: formatDate(today(), lang, "medium") })}</p>}
        <div className="mt-7 flex justify-end gap-2 border-t border-border pt-5 max-[699px]:sticky max-[699px]:bottom-[calc(76px+env(safe-area-inset-bottom))] max-[699px]:bg-card max-[699px]:pb-3">
          <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={errors.length > 0 || submitting}><Check />{t(isEdit ? "routine.save" : "routine.create")}</Button>
        </div>
      </form>

      <aside className="min-w-0 space-y-4 text-sm">
        <h3 className="font-serif text-xl font-semibold">{t("routine.preview")}</h3>
        <p className="text-xs text-muted-foreground">{subjects?.find((s) => s.id === subject)?.name}</p>
        <p className="tabular-nums">{t("routine.previewPool", { pool: poolSize, groups: groups.length })}</p>
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
          <ul className="space-y-1 border-t border-border pt-3 text-xs text-destructive">
            {warnings.map((w, i) => (
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

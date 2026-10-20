import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { ChevronLeft, Check, FolderOpen, ListMusic } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { LIBRARY_KINDS } from "@/lib/constants";
import { expandTaskRecurrence } from "@/lib/recurrence";
import { presetDates, presetRecurrence, resolveWhen, type RepeatPreset, type When } from "@/lib/domain/taskPresets";
import { useI18n } from "@/lib/i18n";
import { tasksService } from "@/lib/services";
import { today } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { FilterPanel } from "@/components/shared/FilterPanel";
import { WhenFields, nativeSelect } from "@/components/diary/WhenFields";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { syncPlan } from "@/domain/logic/plan";
import { useAllSegments, useCollectionLinks, useCollections, useLibrary, useSubjects } from "@/presentation/hooks/useEntities";

const MAX_TASKS = 400;

/** Add many library items to the plan at once: whole kinds, whole collections or single sections. */
export default function BulkAddTasksPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const subjects = useSubjects();
  const library = useLibrary();
  const allSegments = useAllSegments();
  const collections = useCollections();
  const links = useCollectionLinks();

  const [subjectId, setSubjectId] = useState<number | undefined>(Number(params.get("subject")) || undefined);
  const [repertoireOnly, setRepertoireOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [itemIds, setItemIds] = useState<Set<number>>(new Set());
  const [segKeys, setSegKeys] = useState<Set<string>>(new Set());
  const [when, setWhen] = useState<When>("today");
  const [custom, setCustom] = useState(today());
  const [repeat, setRepeat] = useState<RepeatPreset>("none");
  const [busy, setBusy] = useState(false);

  const subject = subjectId ?? subjects?.[0]?.id;
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library ?? []).filter((i) => i.subjectId === subject && (!repertoireOnly || i.inRepertoire) && (!q || `${i.title} ${i.composer ?? ""}`.toLowerCase().includes(q)));
  }, [library, subject, query, repertoireOnly]);
  const kinds = LIBRARY_KINDS.filter((k) => items.some((i) => i.kind === k.key));
  const collectionIdsByItem = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const l of links ?? []) map.set(l.itemId, [...(map.get(l.itemId) ?? []), l.collectionId]);
    return map;
  }, [links]);
  const shownCollections = (collections ?? []).filter((c) => items.some((i) => collectionIdsByItem.get(i.id!)?.includes(c.id!)));
  const selected = items.filter((i) => itemIds.has(i.id!));

  const setMany = (ids: number[], on: boolean) =>
    setItemIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const toggleSeg = (key: string, on: boolean) =>
    setSegKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!selected.length) return void toast.error(t("bulk.none"));
    const date = resolveWhen(when, custom);
    const recurrence = presetRecurrence(repeat, date);
    const dates = recurrence ? expandTaskRecurrence(recurrence) : [date];
    if (!dates.length) return void toast.error(t("bulk.noDates"));
    if (dates.length * selected.length > MAX_TASKS) return void toast.error(t("bulk.tooMany"));
    setBusy(true);
    try {
      for (const item of selected) {
        const segs = (allSegments ?? []).filter((s) => s.itemId === item.id && segKeys.has(`${item.id}:${s.id}`));
        const first = segs[0];
        await tasksService.create({
          date,
          subjectId: item.subjectId,
          linkType: "item",
          itemId: item.id,
          title: segs.length === 1 ? `${item.title} — ${first.label}` : item.title,
          plan: syncPlan([], segs, item),
          recurrence,
        });
      }
      toast.success(t("bulk.done", { count: dates.length * selected.length }));
      navigate(`/?date=${dates[0]}`);
    } catch {
      toast.error(t("quick.failed"));
      setBusy(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader
        title={t("bulk.title")}

        actions={<Button asChild variant="outline"><Link to="/tasks/new"><ChevronLeft />{t("bulk.back")}</Link></Button>}
      />

      <form onSubmit={submit} className="rounded-lg bg-card p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium">
            {t("common.subject")}
            <Select value={String(subject ?? "")} onValueChange={(value) => { setSubjectId(Number(value)); setItemIds(new Set()); setSegKeys(new Set()); }} ><SelectTrigger className={nativeSelect}><SelectValue /></SelectTrigger><SelectContent>
              {subjects?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent></Select>
          </label>
          <FilterPanel search={{ value: query, onChange: setQuery, placeholder: t("bulk.searchPlaceholder") }}
            filters={repertoireOnly ? [{ key: "repertoire", label: t("repertoire.title"), onRemove: () => setRepertoireOnly(false) }] : []}
            onReset={() => { setQuery(""); setRepertoireOnly(false); }} resultCount={library === undefined ? undefined : items.length}>
            <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={repertoireOnly} onCheckedChange={on => setRepertoireOnly(on === true)} />{t("repertoire.title")}</label>
          </FilterPanel>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setMany(items.map((i) => i.id!), true)}><Check />{t("bulk.selectAll")}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMany(items.map((i) => i.id!), false)}>{t("common.none")}</Button>
          {shownCollections.map((c) => (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant="outline"
              title={t("bulk.collectionHint")}
              onClick={() => setMany(items.filter((i) => collectionIdsByItem.get(i.id!)?.includes(c.id!)).map((i) => i.id!), true)}
            >
              <FolderOpen />+ {c.name}
            </Button>
          ))}
        </div>

        {kinds.length === 0 ? (
          <div className="mt-6">
            <EmptyState title={t("bulk.emptyTitle")} hint={t("bulk.emptyHint")} />
          </div>
        ) : (
          kinds.map(({ key, tKey }) => {
            const ofKind = items.filter((i) => i.kind === key);
            return (
              <section key={key} className="mt-7 border-t border-border pt-6">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="font-serif text-2xl font-semibold">{t(tKey)}</h2>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setMany(ofKind.map((i) => i.id!), true)}>{t("common.all")}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setMany(ofKind.map((i) => i.id!), false)}>{t("common.none")}</Button>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {ofKind.map((item) => {
                    const segs = (allSegments ?? []).filter((s) => s.itemId === item.id);
                    return (
                      <li key={item.id} className="py-3">
                        <label className="flex min-h-11 items-center gap-3">
                          <Checkbox checked={itemIds.has(item.id!)} onCheckedChange={(on) => setMany([item.id!], on === true)} />
                          <span className="min-w-0">
                            <strong className="font-medium">{item.title}</strong>{" "}
                            <span className="text-xs text-muted-foreground">{item.composer}</span>
                          </span>
                        </label>
                        {segs.length > 0 && (
                          <details className="ml-8 mt-1">
                            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                              <ListMusic className="h-3.5 w-3.5" />{t("bulk.sections", { count: segs.length })}
                            </summary>
                            <div role="group" aria-label={t("bulk.sectionsOf", { title: item.title })} className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                              {segs.map((s) => {
                                const k = `${item.id}:${s.id}`;
                                return (
                                  <label key={s.id} className="inline-flex min-h-11 items-center gap-2 text-[0.8125rem]">
                                    <Checkbox
                                      checked={segKeys.has(k)}
                                      onCheckedChange={(on) => { toggleSeg(k, on === true); if (on === true) setMany([item.id!], true); }}
                                    />
                                    {s.label}
                                  </label>
                                );
                              })}
                            </div>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        <section className="mt-7 flex flex-wrap items-end gap-x-7 gap-y-4 border-t border-border pt-6">
          <WhenFields when={when} custom={custom} repeat={repeat} onWhen={setWhen} onCustom={setCustom} onRepeat={setRepeat} />
          {repeat !== "none" && <p className="basis-full text-xs text-muted-foreground">{t("quick.repeatHelp")}</p>}
        </section>

        <div className="mt-8 flex justify-end gap-2 border-t border-border pt-5">
          <Button asChild variant="ghost"><Link to="/">{t("common.cancel")}</Link></Button>
          <Button type="submit" disabled={busy || !selected.length}>
            {/* The count is tasks, not materials: every material lands on every chosen day. */}
            <Check />{t("bulk.addN", { count: selected.length * presetDates(when, custom, repeat).length })}
          </Button>
        </div>
      </form>
    </div>
  );
}

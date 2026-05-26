import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LIBRARY_QUOTES, pickQuote } from "@/lib/quotes";
import { useLiveQuery } from "dexie-react-hooks";
import { db, THEORY_LAYERS, type LibraryKind, type LibraryItem, type Segment, type TheoryLayer } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NOTE_GLYPH, LIBRARY_KINDS } from "@/lib/constants";
import { today } from "@/lib/date";
import { Plus, Pencil, Trash2, MessageCircleQuestion, MoreVertical, ArrowDownUp, FolderOpen, Layers, LineChart, Play } from "lucide-react";

import { MasterySparkline } from "@/components/library/MasterySparkline";
import { type MasteryState } from "@/components/library/MasterySliders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";
import { ItemHelpSheet } from "@/components/library/ItemHelpSheet";
import { BpmSparkline } from "@/components/library/BpmSparkline";
import { ListSkeleton } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { useCollectionLinks, useCollections, useHelpRequests, useSegments, useSubjects, useTechniques } from "@/hooks/useEntities";
import { subjectBorderStyle } from "@/lib/subjectColors";
import { libraryService, deleteWithUndo } from "@/lib/services";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function Library() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [active, setActive] = useState<LibraryKind>("repertoire");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [helpItem, setHelpItem] = useState<LibraryItem | null>(null);
  
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "composer">("recent");
  const [groupByCollection, setGroupByCollection] = useState(false);
  const allHelp = useHelpRequests();
  const allTechniques = useTechniques();
  const subjects = useSubjects();
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id!, s])), [subjects]);
  const allCollections = useCollections();
  const allCollectionLinks = useCollectionLinks();

  const items = useLiveQuery(
    () => db.library.where("kind").equals(active).filter((i) => !i.deletedAt).toArray(),
    [active]
  );
  const allSegments = useSegments();
  const segmentsByItem = (allSegments ?? []).reduce<Record<number, Segment[]>>((acc, s) => {
    (acc[s.itemId] ||= []).push(s);
    return acc;
  }, {});

  const filteredItems = useMemo(() => {
    let arr = items ?? [];
    if (subjectFilter !== "all") arr = arr.filter((i) => i.subjectId === Number(subjectFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (i) => i.title.toLowerCase().includes(q) || (i.composer ?? "").toLowerCase().includes(q)
      );
    }
    return [...arr].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "composer") return (a.composer ?? "").localeCompare(b.composer ?? "");
      return b.createdAt - a.createdAt;
    });
  }, [items, subjectFilter, search, sortBy]);

  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const [pageByGroup, setPageByGroup] = useState<Record<string, number>>({});
  useEffect(() => { setPage(1); setPageByGroup({}); }, [active, subjectFilter, search, sortBy, groupByCollection]);
  const setGroupPage = (key: string, p: number) =>
    setPageByGroup((prev) => ({ ...prev, [key]: p }));

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (it: LibraryItem) => {
    setEditing(it);
    setSheetOpen(true);
  };

  const askDeleteItem = async (it: LibraryItem) => {
    if (!it.id) return;
    if (await libraryService.hasSessions(it.id)) {
      // Has sessions — will be soft-deleted/archived; keep dialog so user knows history is preserved
      setDeletingId(it.id);
      return;
    }
    // No sessions → low-risk hard delete: skip dialog, offer undo
    const savedItem = { ...it };
    const savedSegments = (allSegments ?? []).filter((s) => s.itemId === it.id).map((s) => ({ ...s }));
    await deleteWithUndo({
      remove: () => libraryService.hardDelete(it.id!),
      restore: () => libraryService.restore(savedItem, savedSegments),
      message: t("toast.deleted"),
      undoLabel: t("common.undo"),
      toast: (msg, opts) => toast.success(msg, opts),
      duration: 5000,
    });
  };

  const confirmDelete = async () => {
    if (deletingId == null) return;
    const mode = await libraryService.remove(deletingId);
    toast.success(mode === "soft" ? t("toast.archivedKeptInHistory") : t("toast.deleted"));
    setDeletingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-3xl">{t("nav.library")}</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> {t("library.add")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {LIBRARY_KINDS.map(({ key, icon: Icon, tKey, tint }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={cn(
              "paper-card flex flex-col items-center gap-1 py-3 transition-all relative overflow-hidden",
              active === key ? "-translate-y-0.5" : "hover:-translate-y-0.5"
            )}
            style={
              active === key
                ? { boxShadow: `inset 0 0 0 2px ${tint}, var(--shadow-card)`, background: `color-mix(in oklab, ${tint} 12%, hsl(var(--card)))` }
                : undefined
            }
          >
            <Icon className="h-5 w-5" style={{ color: active === key ? tint : "hsl(var(--muted-foreground))" }} />
            <span className="text-[11px] font-medium leading-tight text-center">{t(tKey)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("library.allSubjects")}</SelectItem>
            {(subjects ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent"><span className="inline-flex items-center gap-2"><ArrowDownUp className="h-3 w-3" /> {t("library.sortRecent")}</span></SelectItem>
            <SelectItem value="title">{t("library.sortTitle")}</SelectItem>
            <SelectItem value="composer">{t("library.sortComposer")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder={t("library.searchTitleComposer")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to={`/library/collections?kind=${active}`}><FolderOpen className="h-4 w-4 mr-1" /> {t("library.collections")}</Link>
        </Button>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant={groupByCollection ? "secondary" : "ghost"}
          onClick={() => setGroupByCollection((v) => !v)}
        >
          <Layers className="h-4 w-4 mr-1" />
          {groupByCollection ? t("library.groupedByCollection") : t("library.groupByCollection")}
        </Button>
      </div>

      {(() => {
        const renderCard = (it: LibraryItem) => {
          const segs = it.id ? (segmentsByItem[it.id] ?? []) : [];
          const subject = subjectMap.get(it.subjectId);
          return (
            <li key={it.id} className="paper-card p-4 border-l-4" style={subjectBorderStyle(subject?.color, subject?.type, subject?.customColor)}>
              {/* Row 1: title + actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="font-serif text-xl flex-1 min-w-0 break-words">{it.title}</div>
                <div className="flex items-center gap-1 shrink-0">
                  {(() => {
                    const itemHelp = (allHelp ?? []).filter((h) => h.itemId === it.id);
                    const open = itemHelp.filter((h) => !h.resolved).length;
                    return (
                      <button
                        onClick={() => setHelpItem(it)}
                        className="relative p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
                        aria-label={t("library.askTeacher")}
                      >
                        <MessageCircleQuestion className="h-4 w-4" />
                        {itemHelp.length > 0 && (
                          <span className={`absolute -top-0.5 -right-0.5 text-[9px] tabular-nums rounded-full px-1 ${open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {itemHelp.length}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                        aria-label={t("common.more")}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(it)}>
                        <Pencil className="h-4 w-4 mr-2" /> {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.id && navigate(`/library/item/${it.id}/analysis`)}>
                        <LineChart className="h-4 w-4 mr-2" /> {t("library.analysis.menu")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => askDeleteItem(it)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {it.composer && (
                <div className="text-sm text-muted-foreground italic truncate mt-0.5">{it.composer}</div>
              )}

              <div className="flex items-center justify-between gap-3 mt-2 min-h-[1.5rem]">
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  {it.kind === "repertoire" && it.status && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-foreground/80">
                      {t(`library.status.${it.status}`)}
                    </span>
                  )}
                  {it.kind === "technique" && (it.startBpm || it.targetBpm) && (
                    <span className="tabular-nums">{it.startBpm ?? "—"} → {it.targetBpm ?? "—"} BPM</span>
                  )}
                  {it.kind === "manual" && (it.totalExercises || it.currentExercise) && (
                    <span>
                      {it.totalExercises
                        ? t("library.exerciseOf", { current: it.currentExercise ?? 1, total: it.totalExercises })
                        : t("library.exercise", { current: it.currentExercise ?? 1 })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {it.id && (it.kind === "repertoire" || it.kind === "technique" || it.kind === "manual") && (
                    <BpmSparkline itemId={it.id} />
                  )}
                  {it.targetBpm && (
                    <div className="text-sm font-serif tabular-nums text-primary whitespace-nowrap">
                      {it.noteVal ? NOTE_GLYPH[it.noteVal] : "♩"} = {it.targetBpm}
                    </div>
                  )}
                </div>
              </div>

              {(!!it.tags?.length || !!it.techniqueIds?.length) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {it.tags?.map((tag) => (
                    <span key={`tag-${tag}`} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      #{tag}
                    </span>
                  ))}
                  {(it.techniqueIds ?? []).map((id) => {
                    const name = (allTechniques ?? []).find((tech) => tech.id === id)?.name;
                    if (!name) return null;
                    return (
                      <span key={`tech-${id}`} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/60 text-foreground/70">
                        {name}
                      </span>
                    );
                  })}
                </div>
              )}

              {(it.kind === "repertoire" || it.kind === "manual") && segs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>{t("library.segments", { count: segs.length })}</span>
                  </div>
                </div>
              )}

              {it.kind === "theory" && it.id && (
                <TheoryMasterySection itemId={it.id} />
              )}

              <div className="mt-3 pt-2 border-t border-border/40 flex justify-end">
                <button
                  onClick={() => navigate("/tasks/new", {
                    state: {
                      date: today(),
                      prefill: {
                        itemId: it.id,
                        itemTitle: it.title,
                        itemSubjectId: it.subjectId,
                        itemBpm: it.targetBpm,
                        itemNoteVal: it.noteVal,
                      },
                    },
                  })}
                  className="inline-flex items-center gap-1 text-xs uppercase tracking-wider px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Play className="h-3 w-3" /> {t("library.practiceThis")}
                </button>
              </div>
            </li>
          );
        };

        if (items === undefined) return <ListSkeleton />;
        if (!filteredItems.length) {
          return items.length === 0
            ? <EmptyLibrary onAdd={openCreate} hint={t("library.empty")} />
            : <EmptyState title={t("library.noItemsMatch")} />;
        }

        const paginate = <T,>(arr: T[], p: number) => arr.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);

        if (groupByCollection) {
          const cols = (allCollections ?? []).filter((c) => c.kind === active).slice().sort((a, b) => a.name.localeCompare(b.name));
          const links = allCollectionLinks ?? [];
          const filteredIds = new Set(filteredItems.map((i) => i.id!));
          const itemsById = new Map(filteredItems.map((i) => [i.id!, i]));
          const inAnyCollection = new Set<number>();
          const groups = cols.map((c) => {
            const ids = links.filter((l) => l.collectionId === c.id).map((l) => l.itemId).filter((id) => filteredIds.has(id));
            ids.forEach((id) => inAnyCollection.add(id));
            return { collection: c, items: ids.map((id) => itemsById.get(id)!).sort((a, b) => a.title.localeCompare(b.title)) };
          });
          const uncollected = filteredItems.filter((i) => !inAnyCollection.has(i.id!));
          const uncollectedPage = pageByGroup["__uncollected"] ?? 1;
          const uncollectedTotalPages = Math.max(1, Math.ceil(uncollected.length / PAGE_SIZE));

          return (
            <div className="space-y-2">
              <Accordion type="multiple" className="space-y-2">
                {groups.map((g, gi) => {
                  const key = `c-${g.collection.id}`;
                  const p = pageByGroup[key] ?? 1;
                  const totalPages = Math.max(1, Math.ceil(g.items.length / PAGE_SIZE));
                  return (
                    <AccordionItem key={gi} value={key} className="paper-card border-0 px-3">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {g.collection?.color ? (
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(var(--key-${g.collection.color}))` }} />
                          ) : (
                            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-serif text-lg truncate">{g.collection.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums ml-auto mr-2">{g.items.length}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {g.items.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic px-1 pb-3">{t("library.emptyCollection")}</p>
                        ) : (
                          <>
                            <ul className="space-y-2 pb-2">{paginate(g.items, p).map(renderCard)}</ul>
                            <Pager page={p - 1} totalPages={totalPages} onChange={(np) => setGroupPage(key, np + 1)} />
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              {uncollected.length > 0 && (
                <Accordion type="multiple" className="space-y-2 pt-2">
                  <AccordionItem value="__uncollected" className="paper-card border-0 px-3">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-serif text-lg truncate">{t("library.uncollected")}</span>
                        <span className="text-xs text-muted-foreground tabular-nums ml-auto mr-2">{uncollected.length}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 pb-2">{paginate(uncollected, uncollectedPage).map(renderCard)}</ul>
                      <Pager page={uncollectedPage - 1} totalPages={uncollectedTotalPages} onChange={(np) => setGroupPage("__uncollected", np + 1)} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          );
        }

        const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
        const currentPage = Math.min(page, totalPages);
        return (
          <>
            <ul className="space-y-2">{paginate(filteredItems, currentPage).map(renderCard)}</ul>
            <Pager page={currentPage - 1} totalPages={totalPages} onChange={(np) => setPage(np + 1)} />
          </>
        );
      })()}

      <NewLibraryItemSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditing(null);
        }}
        kind={editing?.kind ?? active}
        item={editing}
      />

      {helpItem && (
        <ItemHelpSheet
          open={helpItem !== null}
          onOpenChange={(o) => !o && setHelpItem(null)}
          itemId={helpItem.id!}
          itemTitle={helpItem.title}
        />
      )}

      <AlertDialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteItem")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.deleteItemDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

/** Computes the latest score per theory dimension from sessions and renders radar + sparklines. */
function TheoryMasterySection({ itemId }: { itemId: number }) {
  const { t } = useI18n();

  const sessions = useLiveQuery(async () => {
    const tasks = await db.tasks.where("itemId").equals(itemId).toArray();
    const ids = tasks.map((t) => t.id!).filter(Boolean);
    if (!ids.length) return [];
    return db.sessions.where("taskId").anyOf(ids).toArray();
  }, [itemId]);

  const latestScores = useMemo((): MasteryState => {
    const result: MasteryState = { conceptual: 0, analytical: 0, aural: 0, compositional: 0, reading: 0 };
    if (!sessions?.length) return result;
    // For each layer, find the session with the latest date that has a score for it
    for (const layer of THEORY_LAYERS) {
      const scored = sessions
        .filter((s) => s.layerScores?.[layer] != null)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (scored.length) result[layer] = scored[0].layerScores![layer];
    }
    return result;
  }, [sessions]);

  const hasAnyScore = THEORY_LAYERS.some((l) => latestScores[l] > 0);

  if (!hasAnyScore) {
    return (
      <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground italic">
        {t("library.masteryFromSessions")}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {THEORY_LAYERS.map((layer) => (
          <div key={layer} className="flex items-center gap-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground w-10 shrink-0 truncate">
              {t(`library.mastery.${layer}`).slice(0, 4)}
            </div>
            <MasterySparkline itemId={itemId} layer={layer as TheoryLayer} weeks={8} />
            <div className="text-[10px] font-serif tabular-nums text-primary ml-auto">
              {latestScores[layer]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyLibrary({ onAdd, hint }: { onAdd: () => void; hint: string }) {
  const { t, lang } = useI18n();
  const quote = useMemo(() => pickQuote(LIBRARY_QUOTES, lang), [lang]);
  return (
    <EmptyState
      hint={hint}
      quote={quote}
      cta={{ label: t("library.addToLibrary"), onClick: onAdd }}
    />
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LIBRARY_QUOTES, pickQuote } from "@/lib/quotes";
import type { LibraryKind } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NOTE_GLYPH, LIBRARY_KINDS } from "@/lib/constants";
import { today } from "@/lib/date";
import { SearchX, Plus, Pencil, Trash2, MessageCircleQuestion, MoreVertical, FolderOpen, Flag, Layers, LineChart, Play, Star, BookmarkCheck } from "lucide-react";
import { isPerformable } from "@/domain/logic/repertoireReview";
import { repertoireService } from "@/lib/services/performances";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";
import { ItemHelpSheet } from "@/components/library/ItemHelpSheet";
import { BpmSparkline } from "@/components/library/BpmSparkline";
import { ListSkeleton } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterPanel, FilterSelect } from "@/components/shared/FilterPanel";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { useCollectionLinks, useCollections, useHelpRequests, useLibraryByKind, useSegments, useSubjects, useTechniques } from "@/presentation/hooks/useEntities";
import { subjectColorCss } from "@/lib/subjectColors";
import { libraryService } from "@/lib/services";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
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
  const { t, lang } = useI18n();
  const libraryQuote = useMemo(() => pickQuote(LIBRARY_QUOTES, lang), [lang]);
  const navigate = useNavigate();
  const [active, setActive] = useState<LibraryKind>("piece");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [helpItem, setHelpItem] = useState<LibraryItem | null>(null);

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "titleDesc" | "composer">("recent");
  const [favoritesFirst, setFavoritesFirst] = useState(true);
  const [repertoireFirst, setRepertoireFirst] = useState(true);
  const [repertoireOnly, setRepertoireOnly] = useState(false);
  const [groupByCollection, setGroupByCollection] = useState(false);
  const [composerFilter, setComposerFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [techniqueFilter, setTechniqueFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const allHelp = useHelpRequests();
  const allTechniques = useTechniques();
  const subjects = useSubjects();
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s])), [subjects]);
  const allCollections = useCollections();
  const allCollectionLinks = useCollectionLinks();

  const items = useLibraryByKind(active);
  const allSegments = useSegments();
  const segmentsByItem = (allSegments ?? []).reduce<Record<number, Segment[]>>((acc, s) => {
    (acc[s.itemId] ||= []).push(s);
    return acc;
  }, {});

  const filteredItems = useMemo(() => {
    let arr = items ?? [];
    if (subjectFilter !== "all") arr = arr.filter((i) => i.subjectId === Number(subjectFilter));
    if (composerFilter !== "all") arr = arr.filter(i => i.composer === composerFilter);
    if (collectionFilter !== "all") {
      const ids = new Set((allCollectionLinks ?? []).filter(link => link.collectionId === Number(collectionFilter)).map(link => link.itemId));
      arr = arr.filter(i => ids.has(i.id!));
    }
    if (techniqueFilter !== "all") arr = arr.filter(i => i.techniqueIds?.includes(Number(techniqueFilter)));
    if (favoritesOnly) arr = arr.filter(i => i.isFavorite);
    if (repertoireOnly) arr = arr.filter(i => i.inRepertoire);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (i) => [i.title, i.composer, i.catalog, i.notes, ...(i.tags ?? [])].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    return [...arr].sort((a, b) => {
      if (repertoireFirst && !!a.inRepertoire !== !!b.inRepertoire) return a.inRepertoire ? -1 : 1;
      if (favoritesFirst && !!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
      if (sortBy === "titleDesc") return b.title.localeCompare(a.title, lang);
      if (sortBy === "title") return a.title.localeCompare(b.title, lang);
      if (sortBy === "composer") return (a.composer ?? "").localeCompare(b.composer ?? "");
      return b.createdAt - a.createdAt;
    });
  }, [items, subjectFilter, search, sortBy, favoritesFirst, repertoireFirst, repertoireOnly, composerFilter, collectionFilter, techniqueFilter, favoritesOnly, allCollectionLinks, lang]);

  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const [pageByGroup, setPageByGroup] = useState<Record<string, number>>({});
  useEffect(() => { setPage(1); setPageByGroup({}); }, [active, subjectFilter, search, sortBy, groupByCollection, favoritesFirst, repertoireFirst, repertoireOnly, composerFilter, collectionFilter, techniqueFilter, favoritesOnly]);
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
      remove: () => libraryService.hardDelete(it.id),
      restore: () => libraryService.restore(savedItem, savedSegments),
      message: t("toast.deleted"),
      undoLabel: t("common.undo"),
      onError: () => toast.error(t("quick.failed")),
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

  const toggleRepertoire = async (item: LibraryItem) => {
    if (item.id === undefined) return;
    const next = !item.inRepertoire;
    await repertoireService.setInRepertoire(item.id, next);
    toast.success(next ? t("repertoire.added") : t("repertoire.removed"));
  };


  const renderRow = (it: LibraryItem) => {
    const segs = it.id ? (segmentsByItem[it.id] ?? []) : [];
    const subject = subjectMap.get(it.subjectId);
    const itemHelp = (allHelp ?? []).filter((h) => h.itemId === it.id);
    const openHelp = itemHelp.filter((h) => !h.resolved).length;
    const techNames = (it.techniqueIds ?? [])
      .map((id) => (allTechniques ?? []).find((tech) => tech.id === id)?.name)
      .filter(Boolean) as string[];
    const hasSparkline = !!it.id && it.kind !== "theory";
    return (
      <li key={it.id} className="grid grid-cols-1 gap-3 py-5 min-[700px]:grid-cols-[minmax(0,1fr)_auto_auto] min-[700px]:items-center min-[700px]:gap-x-4">
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-semibold leading-tight break-words">
            <Link to={`/library/item/${it.id}`} className="hover:underline underline-offset-4">{it.title}</Link>
          <Button size="icon" variant="ghost" className="ml-1.5 inline-flex h-11 w-11 align-middle" aria-pressed={!!it.isFavorite} aria-label={`${t(it.isFavorite ? "library.removeFavorite" : "library.addFavorite")}: ${it.title}`} onClick={async () => {
            try { await libraryService.upsert({ ...it, isFavorite: !it.isFavorite }); }
            catch { toast.error(t("quick.failed")); }
          }}>
            <Star className={cn(it.isFavorite && "fill-current text-primary")} />
          </Button>
            {it.inRepertoire && <BookmarkCheck className="ml-1.5 inline-block h-4 w-4 fill-current align-middle text-primary" aria-label={t("repertoire.title")} />}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums [overflow-wrap:anywhere]">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(subject?.color, subject?.type, subject?.customColor) }} title={subject?.name} role="img" aria-label={subject?.name} />
            {it.composer && <span className="italic">{it.composer}</span>}
            {it.kind === "technique" && (it.startBpm || it.targetBpm) && <span>{it.startBpm ?? "—"} → {it.targetBpm ?? "—"} BPM</span>}
            {it.kind !== "technique" && it.targetBpm && <span>{it.noteVal ? NOTE_GLYPH[it.noteVal] : "♩"} = {it.targetBpm}</span>}
            {segs.length > 0 && <span>{t("library.segments", { count: segs.length })}</span>}
            {it.catalog && <span>{it.catalog}</span>}
            {it.tags?.map((tag) => <span key={`tag-${tag}`}>#{tag}</span>)}
            {techNames.map((name) => <span key={name}>{name}</span>)}
          </div>
        </div>
        {hasSparkline && <div className="hidden opacity-80 min-[700px]:block"><BpmSparkline itemId={it.id!} /></div>}
        <div className="flex flex-wrap items-center justify-end gap-1">

          <Button
            size="sm"
            className="min-h-11 sm:min-h-0"
            onClick={() => navigate("/tasks/new", { state: { date: today(), prefill: { itemId: it.id, itemTitle: it.title, itemSubjectId: it.subjectId } } })}
          >
            <Play /> {t("library.practiceThis")}
          </Button>
          <button
            onClick={() => setHelpItem(it)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40 hover:text-primary"
            aria-label={t("library.askTeacher")}
          >
            <MessageCircleQuestion className="h-[18px] w-[18px]" />
            {itemHelp.length > 0 && (
              <span className={`absolute right-1 top-1 inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-1 text-xs leading-none tabular-nums ${openHelp ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{itemHelp.length}</span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40 hover:text-foreground" aria-label={`${t("common.more")}: ${it.title}`}>
                <MoreVertical className="h-[18px] w-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(it)}><Pencil className="mr-2 h-4 w-4" /> {t("common.edit")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => it.id && navigate(`/library/item/${it.id}?tab=analysis`)}><LineChart className="mr-2 h-4 w-4" /> {t("library.analysis.menu")}</DropdownMenuItem>
              {isPerformable(it.kind) && (
                <DropdownMenuItem onClick={() => toggleRepertoire(it)}>
                  <BookmarkCheck className={cn("mr-2 h-4 w-4", it.inRepertoire && "fill-current text-primary")} />
                  {it.inRepertoire ? t("repertoire.remove") : t("repertoire.add")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => askDeleteItem(it)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> {t("common.delete")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>
    );
  };

  const paginate = <T,>(arr: T[], p: number) => arr.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);

  const list = (() => {
    if (items === undefined) return <ListSkeleton />;
    if (!filteredItems.length) {
      return items.length === 0
        ? <EmptyState hint={t("library.empty")} quote={libraryQuote} cta={{ label: t("library.addToLibrary"), onClick: openCreate }} />
        : <EmptyState icon={SearchX} title={t("library.noItemsMatch")} />;
    }

    if (groupByCollection) {
      const cols = (allCollections ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      const links = allCollectionLinks ?? [];
      const filteredIds = new Set(filteredItems.map((i) => i.id));
      const inAnyCollection = new Set<number>();
      const groups = cols.map((c) => {
        const ids = links.filter((l) => l.collectionId === c.id).map((l) => l.itemId).filter((id) => filteredIds.has(id));
        ids.forEach((id) => inAnyCollection.add(id));
        const groupIds = new Set(ids);
        const groupItems = filteredItems.filter((item) => groupIds.has(item.id));
        return { key: `c-${c.id}`, title: c.name, collection: c, items: groupItems };
      });
      const uncollected = filteredItems.filter((i) => !inAnyCollection.has(i.id));
      const all = [...groups, ...(uncollected.length ? [{ key: "__uncollected", title: t("library.uncollected"), collection: undefined, items: uncollected }] : [])];
      return (
        <div className="space-y-8">
          {all.map((g) => {
            const totalPages = Math.max(1, Math.ceil(g.items.length / PAGE_SIZE));
            const p = Math.min(pageByGroup[g.key] ?? 1, totalPages);
            return (
              <section key={g.key}>
                <SectionHeader
                  title={g.title}
                  action={g.collection && <Link to={`/library/collections/${g.collection.id}`} className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4"><FolderOpen className="h-4 w-4" />{t("library.collections")}</Link>}
                />
                {g.items.length === 0 ? (
                  <p className="border-t border-border py-4 text-xs italic text-muted-foreground">{t("library.emptyCollection")}</p>
                ) : (
                  <>
                    <ul className="divide-y divide-border border-t border-border">{paginate(g.items, p).map(renderRow)}</ul>
                    <Pager page={p - 1} totalPages={totalPages} onChange={(np) => setGroupPage(g.key, np + 1)} />
                  </>
                )}
              </section>
            );
          })}
        </div>
      );
    }

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    return (
      <>
        <ul className="divide-y divide-border border-t border-border">{paginate(filteredItems, currentPage).map(renderRow)}</ul>
        <Pager page={currentPage - 1} totalPages={totalPages} onChange={(np) => setPage(np + 1)} />
      </>
    );
  })();

  const linkCls = "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground";

  return (
    <div className="pb-24">
      <PageHeader
        title={t("nav.library")}

        actions={<Button onClick={openCreate}><Plus /> {t("library.add")}</Button>}
      />

      <Tabs value={active} onValueChange={value => setActive(value as LibraryKind)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border max-[699px]:block">
        <TabsList aria-label={t("library.materials")} className="-mb-px flex h-auto flex-wrap justify-start gap-x-4 rounded-none bg-transparent p-0">
          {LIBRARY_KINDS.map(({ key, tKey }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {t(tKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex flex-wrap pb-1 max-[699px]:mt-3">
          <Link to="/library/collections" className={linkCls}><FolderOpen className="h-4 w-4" />{t("library.collections")}</Link>
          <Link to="/library/repertoire" className={linkCls}><BookmarkCheck className="h-4 w-4" />{t("repertoire.tab")}</Link>
          <Link to="/library/repertoire?tab=performances" className={linkCls}><Flag className="h-4 w-4" />{t("library.events")}</Link>
        </div>
      </div>

      <TabsContent value={active}>
      <FilterPanel
        search={{ value: search, onChange: setSearch, placeholder: t("library.searchTitleComposer") }}
        resultCount={items === undefined ? undefined : filteredItems.length}
        filters={[
          ...(subjectFilter !== "all" ? [{ key: "subject", label: `${t("common.subject")}: ${subjectMap.get(Number(subjectFilter))?.name ?? subjectFilter}`, onRemove: () => setSubjectFilter("all") }] : []),
          ...(composerFilter !== "all" ? [{ key: "composer", label: `${t("collection.author")}: ${composerFilter}`, onRemove: () => setComposerFilter("all") }] : []),
          ...(collectionFilter !== "all" ? [{ key: "collection", label: `${t("link.collection")}: ${allCollections?.find(c => c.id === Number(collectionFilter))?.name ?? collectionFilter}`, onRemove: () => setCollectionFilter("all") }] : []),
          ...(techniqueFilter !== "all" ? [{ key: "technique", label: allTechniques?.find(tech => tech.id === Number(techniqueFilter))?.name ?? techniqueFilter, onRemove: () => setTechniqueFilter("all") }] : []),
          ...(favoritesOnly ? [{ key: "favorites", label: t("filters.favoritesOnly"), onRemove: () => setFavoritesOnly(false) }] : []),
          ...(repertoireOnly ? [{ key: "repertoire", label: t("repertoire.title"), onRemove: () => setRepertoireOnly(false) }] : []),
        ]}
        onReset={() => { setSearch(""); setSubjectFilter("all"); setComposerFilter("all"); setCollectionFilter("all"); setTechniqueFilter("all"); setFavoritesOnly(false); setRepertoireOnly(false); }}
        sorting={<>
          <FilterSelect label={t("link.sortBy")} value={sortBy} onChange={setSortBy} options={[{ value: "recent", label: t("library.sortRecent") }, { value: "title", label: t("library.sortTitle") }, { value: "titleDesc", label: t("library.sortTitleDesc") }, { value: "composer", label: t("library.sortComposer") }]} />
          <Button type="button" variant={groupByCollection ? "secondary" : "outline"} className="min-h-11" aria-pressed={groupByCollection} onClick={() => setGroupByCollection(v => !v)}><Layers />{groupByCollection ? t("library.groupedByCollection") : t("library.groupByCollection")}</Button>
          <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={favoritesFirst} onCheckedChange={on => setFavoritesFirst(on === true)} />{t("library.favoritesFirst")}</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={repertoireFirst} onCheckedChange={on => setRepertoireFirst(on === true)} />{t("library.repertoireFirst")}</label>
        </>}
      >
        <FilterSelect label={t("common.subject")} value={subjectFilter} onChange={setSubjectFilter} options={[{ value: "all", label: t("library.allSubjects") }, ...(subjects ?? []).map(s => ({ value: String(s.id), label: s.name }))]} />
        <FilterSelect label={t("collection.author")} value={composerFilter} onChange={setComposerFilter} options={[{ value: "all", label: t("collection.allAuthors") }, ...Array.from(new Set((items ?? []).map(i => i.composer).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, lang)).map(value => ({ value, label: value }))]} />
        <FilterSelect label={t("link.filterByCollection")} value={collectionFilter} onChange={setCollectionFilter} options={[{ value: "all", label: t("link.allCollections") }, ...(allCollections ?? []).map(c => ({ value: String(c.id), label: c.name }))]} />
        <FilterSelect label={t("filters.technique")} value={techniqueFilter} onChange={setTechniqueFilter} options={[{ value: "all", label: t("common.all") }, ...(allTechniques ?? []).map(tech => ({ value: String(tech.id), label: tech.name }))]} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={favoritesOnly} onCheckedChange={on => setFavoritesOnly(on === true)} />{t("filters.favoritesOnly")}</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={repertoireOnly} onCheckedChange={on => setRepertoireOnly(on === true)} />{t("repertoire.title")}</label>
      </FilterPanel>
      {list}
      </TabsContent>
      </Tabs>

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
          itemId={helpItem.id}
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

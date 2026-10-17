import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LIBRARY_QUOTES, pickQuote } from "@/lib/quotes";
import type { LibraryKind, StudyStatus } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NOTE_GLYPH, LIBRARY_KINDS } from "@/lib/constants";
import { today } from "@/lib/date";
import { RotateCcw, SearchX, Plus, Pencil, Trash2, MessageCircleQuestion, MoreVertical, ArrowDownUp, FolderOpen, Flag, Layers, LineChart, Play, Star } from "lucide-react";
import { isPerformable } from "@/domain/logic/repertoireReview";
import { repertoireService } from "@/lib/services/performances";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";
import { ItemHelpSheet } from "@/components/library/ItemHelpSheet";
import { BpmSparkline } from "@/components/library/BpmSparkline";
import { ListSkeleton } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { FeatureEmptyState } from "@/components/shared/FeatureEmptyState";
import { Pager } from "@/components/shared/Pager";
import { PageHeader } from "@/components/shared/PageHeader";
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
  const [statusFilter, setStatusFilter] = useState<StudyStatus | "all">("all");
  const [active, setActive] = useState<LibraryKind>("piece");
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
    if (statusFilter !== "all") arr = arr.filter(i => i.studyStatus === statusFilter);
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
  }, [items, subjectFilter, statusFilter, search, sortBy]);

  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const [pageByGroup, setPageByGroup] = useState<Record<string, number>>({});
  useEffect(() => { setPage(1); setPageByGroup({}); }, [active, subjectFilter, statusFilter, search, sortBy, groupByCollection]);
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
      <li key={it.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-[18px]">
        <div className="min-w-[calc(100%-7rem)] flex-1 min-[700px]:min-w-0">
          <h3 className="font-serif text-[1.375rem] font-semibold leading-tight break-words">
            <Link to={`/library/item/${it.id}`} className="hover:underline underline-offset-4">{it.title}</Link>
            {it.inRepertoire && <Star className="ml-1.5 inline-block h-4 w-4 fill-current align-middle text-primary" aria-label={t("repertoire.title")} />}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(subject?.color, subject?.type, subject?.customColor) }} title={subject?.name} role="img" aria-label={subject?.name} />
            {it.composer && <span className="italic">{it.composer}</span>}
            {it.kind === "technique" && (it.startBpm || it.targetBpm) && <span>{it.startBpm ?? "—"} → {it.targetBpm ?? "—"} BPM</span>}
            {it.kind !== "technique" && it.targetBpm && <span>{it.noteVal ? NOTE_GLYPH[it.noteVal] : "♩"} = {it.targetBpm}</span>}
            {segs.length > 0 && <span>{t("library.segments", { count: segs.length })}</span>}
            <span>{t(`library.status.${it.studyStatus}`)}</span>
            {it.catalog && <span>{it.catalog}</span>}
            {it.tags?.map((tag) => <span key={`tag-${tag}`}>#{tag}</span>)}
            {techNames.map((name) => <span key={name}>{name}</span>)}
          </div>
        </div>
        {hasSparkline && <div className="hidden opacity-80 min-[700px]:block"><BpmSparkline itemId={it.id!} /></div>}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            className="min-h-11 sm:min-h-0"
            onClick={() => navigate("/tasks/new", { state: { date: today(), prefill: { itemId: it.id, itemTitle: it.title, itemSubjectId: it.subjectId } } })}
          >
            <Play /> {t("library.practiceThis")}
          </Button>
          <button
            onClick={() => setHelpItem(it)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40 hover:text-primary"
            aria-label={t("library.askTeacher")}
          >
            <MessageCircleQuestion className="h-[18px] w-[18px]" />
            {itemHelp.length > 0 && (
              <span className={`absolute right-1 top-1 inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-1 text-xs leading-none tabular-nums ${openHelp ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{itemHelp.length}</span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40 hover:text-foreground" aria-label={`${t("common.more")}: ${it.title}`}>
                <MoreVertical className="h-[18px] w-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(it)}><Pencil className="mr-2 h-4 w-4" /> {t("common.edit")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => it.id && navigate(`/library/item/${it.id}?tab=analysis`)}><LineChart className="mr-2 h-4 w-4" /> {t("library.analysis.menu")}</DropdownMenuItem>
              {isPerformable(it.kind) && (
                <DropdownMenuItem onClick={() => toggleRepertoire(it)}>
                  <Star className={cn("mr-2 h-4 w-4", it.inRepertoire && "fill-current text-primary")} />
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
        ? <FeatureEmptyState description={t("library.empty")} quote={libraryQuote} action={{ label: t("library.addToLibrary"), onClick: openCreate }} />
        : <EmptyState icon={SearchX} title={t("library.noItemsMatch")} cta={{ label: t("states.clearFilters"), icon: RotateCcw, onClick: () => { setSearch(""); setSubjectFilter("all"); setStatusFilter("all"); } }} />;
    }

    if (groupByCollection) {
      const cols = (allCollections ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      const links = allCollectionLinks ?? [];
      const filteredIds = new Set(filteredItems.map((i) => i.id));
      const itemsById = new Map(filteredItems.map((i) => [i.id, i]));
      const inAnyCollection = new Set<number>();
      const groups = cols.map((c) => {
        const ids = links.filter((l) => l.collectionId === c.id).map((l) => l.itemId).filter((id) => filteredIds.has(id));
        ids.forEach((id) => inAnyCollection.add(id));
        const groupItems = ids
          .map((id) => itemsById.get(id))
          .filter((item): item is LibraryItem => item !== undefined)
          .sort((a, b) => a.title.localeCompare(b.title));
        return { key: `c-${c.id}`, title: c.name, collection: c, items: groupItems };
      });
      const uncollected = filteredItems.filter((i) => !inAnyCollection.has(i.id));
      const all = [...groups, ...(uncollected.length ? [{ key: "__uncollected", title: t("library.uncollected"), collection: undefined, items: uncollected }] : [])];
      return (
        <div className="space-y-8">
          {all.map((g) => {
            const p = pageByGroup[g.key] ?? 1;
            const totalPages = Math.max(1, Math.ceil(g.items.length / PAGE_SIZE));
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

  const linkCls = "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground";

  return (
    <div className="pb-24">
      <PageHeader
        title={t("nav.library")}
        subtitle={LIBRARY_KINDS.map((k) => t(k.tKey)).join(", ")}
        actions={<Button onClick={openCreate}><Plus /> {t("library.add")}</Button>}
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border max-[699px]:block">
        <div role="tablist" aria-label={t("library.materials")} className="-mb-px flex gap-6 overflow-x-auto overflow-y-hidden no-scrollbar max-[699px]:w-full">
          {LIBRARY_KINDS.map(({ key, tKey }) => (
            <button
              key={key}
              role="tab"
              aria-selected={active === key}
              onClick={() => setActive(key)}
              className={cn("shrink-0 border-b-2 pb-2 text-sm font-medium transition-colors", active === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t(tKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap pb-1 max-[699px]:mt-3">
          <Link to="/library/collections" className={linkCls}><FolderOpen className="h-4 w-4" />{t("library.collections")}</Link>
          <Link to="/library/repertoire" className={linkCls}><Star className="h-4 w-4" />{t("repertoire.tab")}</Link>
          <Link to="/library/repertoire?tab=performances" className={linkCls}><Flag className="h-4 w-4" />{t("library.events")}</Link>
        </div>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_200px_auto]">
        <Input type="search" aria-label={t("library.searchTitleComposer")} placeholder={t("library.searchTitleComposer")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger aria-label={t("common.subject")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("library.allSubjects")}</SelectItem>
            {(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StudyStatus | "all")}>
          <SelectTrigger aria-label={t("library.studyStatus")}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("library.allStatuses")}</SelectItem>{(["not_started", "in_progress", "consolidated"] as const).map(status => <SelectItem key={status} value={status}>{t(`library.status.${status}`)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger aria-label={t("library.sortRecent")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent"><span className="inline-flex items-center gap-2"><ArrowDownUp className="h-3 w-3" /> {t("library.sortRecent")}</span></SelectItem>
            <SelectItem value="title">{t("library.sortTitle")}</SelectItem>
            <SelectItem value="composer">{t("library.sortComposer")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={groupByCollection ? "secondary" : "outline"} aria-pressed={groupByCollection} onClick={() => setGroupByCollection((v) => !v)}>
          <Layers /> {groupByCollection ? t("library.groupedByCollection") : t("library.groupByCollection")}
        </Button>
      </div>

      {list}

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

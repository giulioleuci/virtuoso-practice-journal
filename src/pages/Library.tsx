import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LIBRARY_QUOTES, pickQuote } from "@/lib/quotes";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteLibraryItem, type LibraryKind, type LibraryItem, type Segment } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BookOpen, Music2, Activity, Brain, Plus, Pencil, Trash2, Star, MessageCircleQuestion, MoreVertical, ArrowDownUp, FolderOpen, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";
import { ItemHelpSheet } from "@/components/library/ItemHelpSheet";
import { BpmSparkline } from "@/components/library/BpmSparkline";
import { ListSkeleton } from "@/components/shared/Loading";
import { useSubjects } from "@/hooks/useEntities";
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

const KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string; tint: string }[] = [
  { key: "repertoire", icon: Music2, tKey: "library.kind.repertoire", tint: "hsl(var(--key-terracotta))" },
  { key: "manual",     icon: BookOpen, tKey: "library.kind.manual",   tint: "hsl(var(--key-gold))" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique", tint: "hsl(var(--key-sage))" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory",      tint: "hsl(var(--key-blue))" },
];

const NOTE_GLYPH: Record<string, string> = {
  half: "𝅗𝅥", quarter: "♩", eighth: "♪", sixteenth: "𝅘𝅥𝅯",
};

const STATUS_LABEL: Record<string, string> = {
  in_study: "In study",
  maintenance: "Maintenance",
  pause: "Paused",
};

export default function Library() {
  const { t } = useI18n();
  const [active, setActive] = useState<LibraryKind>("repertoire");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [helpItem, setHelpItem] = useState<LibraryItem | null>(null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "composer">("recent");
  const [groupByCollection, setGroupByCollection] = useState(false);
  const allHelp = useLiveQuery(() => db.helpRequests.toArray(), []);
  const allTechniques = useLiveQuery(() => db.techniques.toArray(), []);
  const subjects = useSubjects();
  const allCollections = useLiveQuery(() => db.collections.filter((c) => !c.deletedAt).toArray(), []);
  const allCollectionLinks = useLiveQuery(() => db.collectionItems.toArray(), []);

  const items = useLiveQuery(
    () => db.library.where("kind").equals(active).filter((i) => !i.deletedAt).toArray(),
    [active]
  );
  const allSegments = useLiveQuery(() => db.segments.toArray(), []);
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

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (it: LibraryItem) => {
    setEditing(it);
    setSheetOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingId == null) return;
    const mode = await deleteLibraryItem(deletingId);
    toast.success(mode === "soft" ? "Archived (kept in history)" : "Deleted");
    setDeletingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-3xl">{t("nav.library")}</h2>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link to="/library/collections"><FolderOpen className="h-4 w-4 mr-1" /> Collections</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> {t("library.add")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {KINDS.map(({ key, icon: Icon, tKey, tint }) => (
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
            <SelectItem value="all">All subjects</SelectItem>
            {(subjects ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent"><span className="inline-flex items-center gap-2"><ArrowDownUp className="h-3 w-3" /> Recent</span></SelectItem>
            <SelectItem value="title">Title (A→Z)</SelectItem>
            <SelectItem value="composer">Composer (A→Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="Search title or composer…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {active === "repertoire" && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={groupByCollection ? "secondary" : "ghost"}
            onClick={() => setGroupByCollection((v) => !v)}
          >
            <Layers className="h-4 w-4 mr-1" />
            {groupByCollection ? "Grouped by collection" : "Group by collection"}
          </Button>
        </div>
      )}

      {(() => {
        const renderCard = (it: LibraryItem) => {
          const segs = it.id ? (segmentsByItem[it.id] ?? []) : [];
          return (
            <li key={it.id} className="paper-card p-4">
              {/* Row 1: title + actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="font-serif text-xl flex-1 min-w-0 truncate">{it.title}</div>
                <div className="flex items-center gap-1 shrink-0">
                  {(() => {
                    const itemHelp = (allHelp ?? []).filter((h) => h.itemId === it.id);
                    const open = itemHelp.filter((h) => !h.resolved).length;
                    return (
                      <button
                        onClick={() => setHelpItem(it)}
                        className="relative p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
                        aria-label="Ask the teacher"
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
                        aria-label="More"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(it)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => it.id && setDeletingId(it.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
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
                      {STATUS_LABEL[it.status]}
                    </span>
                  )}
                  {it.kind === "technique" && (it.startBpm || it.targetBpm) && (
                    <span className="tabular-nums">{it.startBpm ?? "—"} → {it.targetBpm ?? "—"} BPM</span>
                  )}
                  {it.kind === "manual" && (it.totalExercises || it.currentExercise) && (
                    <span>Exercise {it.currentExercise ?? 1}{it.totalExercises ? ` / ${it.totalExercises}` : ""}</span>
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
                    const name = (allTechniques ?? []).find((t) => t.id === id)?.name;
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
                    <span>{segs.length} segment{segs.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
              )}

              {it.kind === "theory" && it.mastery && (
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {(["conceptual","analytical","aural","compositional"] as const).map((k) => (
                    <div key={k}>
                      <div>{k.slice(0,4)}</div>
                      <div className="text-foreground font-serif text-base tabular-nums">
                        {it.mastery![k]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        };

        if (items === undefined) return <ListSkeleton />;
        if (!filteredItems.length) {
          return items.length === 0
            ? <EmptyLibrary onAdd={openCreate} hint={t("library.empty")} />
            : <p className="paper-card p-6 text-center text-muted-foreground italic">No items match.</p>;
        }

        if (active === "repertoire" && groupByCollection) {
          const cols = (allCollections ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
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
          const allGroups = [...groups, { collection: null as null, items: uncollected }];

          return (
            <Accordion type="multiple" defaultValue={allGroups.map((_, i) => `g-${i}`)} className="space-y-2">
              {allGroups.map((g, gi) => (
                <AccordionItem key={gi} value={`g-${gi}`} className="paper-card border-0 px-3">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {g.collection?.color ? (
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(var(--key-${g.collection.color}))` }} />
                      ) : (
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-serif text-lg truncate">
                        {g.collection?.name ?? "Uncollected"}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums ml-auto mr-2">
                        {g.items.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {g.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic px-1 pb-3">Empty.</p>
                    ) : (
                      <ul className="space-y-2 pb-2">{g.items.map(renderCard)}</ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          );
        }

        return <ul className="space-y-2">{filteredItems.map(renderCard)}</ul>;
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
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item and all its segments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyLibrary({ onAdd, hint }: { onAdd: () => void; hint: string }) {
  const quote = useMemo(() => pickQuote(LIBRARY_QUOTES), []);
  return (
    <button
      onClick={onAdd}
      className="paper-card p-10 text-center w-full hover:-translate-y-0.5 transition-transform group"
    >
      <p className="font-serif text-xl italic text-foreground/85 leading-snug">
        “{quote.text}”
      </p>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
        — {quote.author}
      </p>
      <p className="text-sm text-muted-foreground italic mt-4">{hint}</p>
      <span className="inline-flex items-center gap-1 text-primary font-medium text-sm mt-3 group-hover:gap-2 transition-all">
        <Plus className="h-4 w-4" /> Add to library
      </span>
    </button>
  );
}

function TechChips({ ids, all }: { ids: number[]; all: { id?: number; name: string }[] }) {
  const names = ids.map((id) => all.find((t) => t.id === id)?.name).filter(Boolean) as string[];
  if (!names.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {names.map((n) => (
        <span key={n} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/60 text-foreground/70">
          {n}
        </span>
      ))}
    </div>
  );
}
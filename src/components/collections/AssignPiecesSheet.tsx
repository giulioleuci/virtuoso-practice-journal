import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Collection, type LibraryItem } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, X, Music2, Search } from "lucide-react";
import { collectionsService } from "@/lib/services";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collection: Collection | null;
}

export function AssignPiecesSheet({ open, onOpenChange, collection }: Props) {
  const { t } = useI18n();
  const repertoire = useLiveQuery(
    () => db.library.where("kind").equals("repertoire").filter((i) => !i.deletedAt).toArray(),
    []
  ) as LibraryItem[] | undefined;
  const links = useLiveQuery(
    () => collection?.id ? db.collectionItems.where("collectionId").equals(collection.id).toArray() : Promise.resolve([]),
    [collection?.id]
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [composerFilter, setComposerFilter] = useState<string>("all");
  const [editing, setEditing] = useState<LibraryItem | null>(null);

  useEffect(() => {
    if (!open) { setPickerOpen(false); setSearch(""); setComposerFilter("all"); }
  }, [open]);

  const includedIds = useMemo(() => new Set((links ?? []).map((l) => l.itemId)), [links]);
  const included = useMemo(
    () => (repertoire ?? [])
      .filter((i) => i.id !== undefined && includedIds.has(i.id))
      .sort((a, b) => a.title.localeCompare(b.title)),
    [repertoire, includedIds]
  );

  const candidates = useMemo(() => (repertoire ?? []).filter((i) => i.id !== undefined && !includedIds.has(i.id)), [repertoire, includedIds]);
  const composers = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => c.composer && set.add(c.composer));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    let arr = candidates;
    if (composerFilter !== "all") arr = arr.filter((i) => (i.composer ?? "") === composerFilter);
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter((i) => i.title.toLowerCase().includes(q) || (i.composer ?? "").toLowerCase().includes(q));
    return [...arr].sort((a, b) => a.title.localeCompare(b.title));
  }, [candidates, composerFilter, search]);

  const addPiece = async (id: number) => {
    if (!collection?.id) return;
    await collectionsService.addItems(collection.id, [id]);
    toast.success(t("toast.pieceAdded"));
  };

  const removePiece = async (id: number) => {
    if (!collection?.id) return;
    await collectionsService.removeItems(collection.id, [id]);
    toast.success(t("toast.pieceRemoved"));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl bg-background p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-2 text-left">
            <SheetTitle className="font-serif text-2xl">{t("collections.piecesInCollection")}</SheetTitle>
            <SheetDescription className="italic">{collection?.name}</SheetDescription>
          </SheetHeader>

          <div className="px-6 pt-3 pb-2">
            <Button onClick={() => setPickerOpen(true)} className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-1" /> {t("collections.addPiece")}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {!included.length ? (
              <p className="paper-card p-6 text-center text-muted-foreground italic">
                {t("collections.noPiecesYet")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {included.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 px-3 py-3 rounded-xl border border-input bg-card min-h-[56px]">
                    <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <button
                      type="button"
                      onClick={() => setEditing(it)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="block break-words font-medium">{it.title}</span>
                      {it.composer && <span className="block text-xs text-muted-foreground italic">{it.composer}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(it)}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => it.id && removePiece(it.id)}
                      className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                      aria-label={t("common.remove")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur">
            <div className="flex gap-3 w-full items-center">
              <span className="text-xs text-muted-foreground tabular-nums mr-auto">
                {t("collections.pieces", { count: included.length })}
              </span>
              <Button onClick={() => onOpenChange(false)}>{t("common.done")}</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Picker sheet */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl bg-background p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-2 text-left">
            <SheetTitle className="font-serif text-2xl">{t("collections.addPiece")}</SheetTitle>
            <SheetDescription className="italic">{t("collections.pickFromRepertoire")}</SheetDescription>
          </SheetHeader>

          <div className="px-6 pt-2 pb-3 space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("library.searchTitleComposer")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-card pl-9"
              />
            </div>
            {composers.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setComposerFilter("all")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    composerFilter === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input bg-card text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  {t("collections.allComposers")}
                </button>
                {composers.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setComposerFilter(c)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      composerFilter === c
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input bg-card text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {!filteredCandidates.length ? (
              <p className="paper-card p-6 text-center text-muted-foreground italic">
                {candidates.length === 0 ? t("collections.allInCollection") : t("collections.noPiecesMatch")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {filteredCandidates.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => it.id && addPiece(it.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-input bg-card hover:bg-accent/40 text-left min-h-[56px] transition-colors"
                    >
                      <Plus className="h-4 w-4 text-primary shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block break-words font-medium">{it.title}</span>
                        {it.composer && <span className="block text-xs text-muted-foreground italic">{it.composer}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur">
            <Button onClick={() => setPickerOpen(false)} className="w-full">{t("common.done")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit existing piece */}
      <NewLibraryItemSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        kind="repertoire"
        item={editing}
      />
    </>
  );
}

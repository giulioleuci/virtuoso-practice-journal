/** Shared "Link to" picker used by New/Edit task sheets.
 *  Enforces mutual exclusivity: free | item (+optional segments) | collection.
 */
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type TaskLinkType } from "@/lib/db";
import { collectionsService } from "@/lib/services";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { cn } from "@/lib/utils";

interface Props {
  subjectId: number | undefined;
  linkType: TaskLinkType;
  setLinkType: (t: TaskLinkType) => void;
  itemId: number | undefined;
  setItemId: (id: number | undefined) => void;
  segmentIds: number[];
  setSegmentIds: (ids: number[]) => void;
  collectionId: number | undefined;
  setCollectionId: (id: number | undefined) => void;
  /** Optional callback fired when item/segment selection changes — used to seed BPM/title in NewTaskSheet. */
  onItemSelected?: (itemId: number | undefined) => void;
  onSegmentsSelected?: (ids: number[]) => void;
}

const KINDS: { val: LibraryKind | "all"; label: string }[] = [
  { val: "all", label: "All" },
  { val: "repertoire", label: "Repertoire" },
  { val: "manual", label: "Manuals" },
  { val: "technique", label: "Technique" },
  { val: "theory", label: "Theory" },
];

const LINK_OPTS: { val: TaskLinkType; label: string }[] = [
  { val: "free", label: "Free task" },
  { val: "item", label: "Library item" },
  { val: "collection", label: "Collection" },
];

export function LinkTargetFields({
  subjectId, linkType, setLinkType,
  itemId, setItemId, segmentIds, setSegmentIds,
  collectionId, setCollectionId,
}: Props) {
  const library = useLiveQuery(() => db.library.filter((i) => !i.deletedAt).toArray(), []);
  const allCollections = useLiveQuery(() => collectionsService.list(), []);
  const allCollectionItems = useLiveQuery(() => db.collectionItems.toArray(), []);
  const segments = useLiveQuery(
    () => (itemId ? db.segments.where("itemId").equals(itemId).filter((s) => !s.deletedAt).toArray() : Promise.resolve([])),
    [itemId]
  );

  // Filter state local to "item" mode
  const kindFilterKey = `kindFilter:${subjectId ?? 0}`;
  const colFilterKey = `colFilter:${subjectId ?? 0}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Link to</Label>
        <div className="flex flex-wrap gap-1.5">
          {LINK_OPTS.map((o) => (
            <button
              key={o.val}
              type="button"
              onClick={() => {
                setLinkType(o.val);
                if (o.val !== "item") { setItemId(undefined); setSegmentIds([]); }
                if (o.val !== "collection") setCollectionId(undefined);
              }}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                linkType === o.val
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >{o.label}</button>
          ))}
        </div>
      </div>

      {linkType === "item" && (
        <ItemPicker
          subjectId={subjectId}
          library={library ?? []}
          allCollections={allCollections ?? []}
          allCollectionItems={allCollectionItems ?? []}
          itemId={itemId}
          setItemId={(id) => { setItemId(id); setSegmentIds([]); }}
        />
      )}

      {linkType === "item" && itemId && !!segments?.length && (
        <MultiChipPicker
          label="Segments (optional)"
          options={segments.map((s) => ({ value: s.id!, label: s.label }))}
          value={segmentIds}
          onChange={setSegmentIds}
          placeholder="— Whole item —"
        />
      )}

      {linkType === "collection" && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Collection</Label>
          <Select
            value={collectionId?.toString() ?? ""}
            onValueChange={(v) => setCollectionId(Number(v))}
          >
            <SelectTrigger><SelectValue placeholder="Pick a collection" /></SelectTrigger>
            <SelectContent>
              {(allCollections ?? []).length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No collections yet</div>
              )}
              {(allCollections ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id!.toString()}>
                  {c.name}{c.composer ? ` — ${c.composer}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import type { LibraryItem, Collection, CollectionItem } from "@/lib/db";

function ItemPicker({
  subjectId, library, allCollections, allCollectionItems, itemId, setItemId,
}: {
  subjectId: number | undefined;
  library: LibraryItem[];
  allCollections: Collection[];
  allCollectionItems: CollectionItem[];
  itemId: number | undefined;
  setItemId: (id: number | undefined) => void;
}) {
  const [kindFilter, setKindFilter] = useState<LibraryKind | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<"title" | "composer">("title");

  const items = useMemo(() => {
    const byCol = new Map<number, Set<number>>();
    for (const link of allCollectionItems) {
      const set = byCol.get(link.collectionId) ?? new Set<number>();
      set.add(link.itemId);
      byCol.set(link.collectionId, set);
    }
    const colSet = collectionFilter !== "all" ? byCol.get(collectionFilter) ?? new Set<number>() : null;
    const filtered = library.filter((l) => {
      if (l.subjectId !== subjectId) return false;
      if (kindFilter !== "all" && l.kind !== kindFilter) return false;
      if (colSet && !colSet.has(l.id!)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sortBy === "composer") {
        const cmp = (a.composer ?? "").localeCompare(b.composer ?? "");
        if (cmp !== 0) return cmp;
      }
      return a.title.localeCompare(b.title);
    });
  }, [library, subjectId, kindFilter, collectionFilter, sortBy, allCollectionItems]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filter by kind</Label>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.val}
              type="button"
              onClick={() => {
                setKindFilter(k.val);
                if (k.val !== "repertoire" && k.val !== "all") setCollectionFilter("all");
              }}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                kindFilter === k.val
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >{k.label}</button>
          ))}
        </div>
      </div>

      {(kindFilter === "all" || kindFilter === "repertoire") && allCollections.length > 0 && (
        <MultiChipPicker
          label="Filter by collection"
          options={allCollections.map((c) => ({ value: c.id!, label: c.name }))}
          value={collectionFilter === "all" ? [] : [collectionFilter]}
          onChange={(next) => setCollectionFilter(next.length ? next[next.length - 1] : "all")}
          placeholder="All collections"
        />
      )}

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sort by</Label>
        <div className="flex flex-wrap gap-1.5">
          {([
            { val: "title", label: "Title" },
            { val: "composer", label: "Composer / Author" },
          ] as const).map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setSortBy(opt.val)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                sortBy === opt.val
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Library item</Label>
        <Select
          value={itemId?.toString() ?? ""}
          onValueChange={(v) => setItemId(Number(v))}
          disabled={!subjectId}
        >
          <SelectTrigger>
            <SelectValue placeholder={subjectId ? "Pick an item" : "Pick a subject first"} />
          </SelectTrigger>
          <SelectContent>
            {items.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No items</div>
            )}
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id!.toString()}>
                {i.title}{i.composer ? ` — ${i.composer}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

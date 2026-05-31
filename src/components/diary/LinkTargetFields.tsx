/** Shared "Link to" picker used by NewTaskPage, TaskWizard, and task edit flows.
 *  Enforces mutual exclusivity: free | item (+optional segments) | collection.
 */
import { useMemo } from "react";
import { useCollectionLinks, useLibrary } from "@/hooks/useEntities";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type TaskLinkType } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
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
  /** Optional callback fired when item/segment selection changes. */
  onItemSelected?: (itemId: number | undefined) => void;
  onSegmentsSelected?: (ids: number[]) => void;
}

const KIND_VALS: (LibraryKind | "all")[] = ["all", "repertoire", "manual", "technique", "theory"];
const LINK_TYPE_VALS: TaskLinkType[] = ["free", "item", "collection"];

export function LinkTargetFields({
  subjectId, linkType, setLinkType,
  itemId, setItemId, segmentIds, setSegmentIds,
  collectionId, setCollectionId,
}: Props) {
  const { t } = useI18n();
  const library = useLibrary();
  const allCollections = useLiveQuery(() => collectionsService.list(), []);
  const allCollectionItems = useCollectionLinks();
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
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("link.linkTo")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {LINK_TYPE_VALS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setLinkType(val);
                if (val !== "item") { setItemId(undefined); setSegmentIds([]); }
                if (val !== "collection") setCollectionId(undefined);
              }}
              className={cn(
                "text-xs px-3 py-1.5 rounded-paper border transition-colors",
                linkType === val
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >{val === "free" ? t("link.freeTask") : val === "item" ? t("link.item") : t("link.collection")}</button>
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
          label={t("link.segmentsOptional")}
          options={segments.map((s) => ({ value: s.id, label: s.label }))}
          value={segmentIds}
          onChange={setSegmentIds}
          placeholder={t("link.wholeItem")}
        />
      )}

      {linkType === "collection" && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("link.collection")}</Label>
          <Select
            value={collectionId?.toString() ?? ""}
            onValueChange={(v) => setCollectionId(Number(v))}
          >
            <SelectTrigger><SelectValue placeholder={t("link.pickCollection")} /></SelectTrigger>
            <SelectContent>
              {(allCollections ?? []).length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">{t("link.noCollections")}</div>
              )}
              {(allCollections ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
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
  const { t } = useI18n();
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
      if (colSet && !colSet.has(l.id)) return false;
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
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("link.filterByKind")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {KIND_VALS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setKindFilter(val);
                if (val !== "repertoire" && val !== "all") setCollectionFilter("all");
              }}
              className={cn(
                "text-xs px-3 py-1.5 rounded-paper border transition-colors",
                kindFilter === val
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >{val === "all" ? t("common.all") : t(`library.kind.${val}`)}</button>
          ))}
        </div>
      </div>

      {(kindFilter === "all" || kindFilter === "repertoire") && allCollections.length > 0 && (
        <MultiChipPicker
          label={t("link.filterByCollection")}
          options={allCollections.map((c) => ({ value: c.id, label: c.name }))}
          value={collectionFilter === "all" ? [] : [collectionFilter]}
          onChange={(next) => setCollectionFilter(next.length ? next[next.length - 1] : "all")}
          placeholder={t("link.allCollections")}
        />
      )}

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("link.sortBy")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {(["title", "composer"] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setSortBy(val)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-paper border transition-colors",
                sortBy === val
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >{val === "title" ? t("common.title") : t("link.sortByComposerAuthor")}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("link.item")}</Label>
        <Select
          value={itemId?.toString() ?? ""}
          onValueChange={(v) => setItemId(Number(v))}
          disabled={!subjectId}
        >
          <SelectTrigger>
            <SelectValue placeholder={subjectId ? t("link.pickItem") : t("link.pickSubjectFirst")} />
          </SelectTrigger>
          <SelectContent>
            {items.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">{t("link.noItems")}</div>
            )}
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id.toString()}>
                {i.title}{i.composer ? ` — ${i.composer}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

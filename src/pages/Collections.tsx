import { useMemo, useState, useEffect } from "react";
import { useCollectionLinks, useCollections } from "@/presentation/hooks/useEntities";
import { Link, useSearchParams } from "react-router-dom";
import type { Collection } from "@/domain/entities/collection";
import type { CollectionKind } from "@/domain/entities/common";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ChevronLeft, FolderOpen, Music2 } from "lucide-react";
import { collectionsService } from "@/lib/services";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { NewCollectionSheet } from "@/components/collections/NewCollectionSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Collections() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKind = searchParams.get("kind");
  const [active, setActive] = useState<CollectionKind>(
    initialKind === "manual" ? "manual" : "collection"
  );

  useEffect(() => {
    if (searchParams.get("kind") !== active) {
      setSearchParams({ kind: active }, { replace: true });
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCollections = useCollections();
  const links = useCollectionLinks();

  const collections = useMemo(
    () => (allCollections ?? []).filter((c) => c.kind === active),
    [allCollections, active]
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);

  const countFor = (id?: number) =>
    id ? (links ?? []).filter((l) => l.collectionId === id).length : 0;

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (c: Collection) => { setEditing(c); setEditorOpen(true); };

  const deleteCollection = async (c: Collection) => {
    if (!c.id) return;
    const savedLinks = (links ?? [])
      .filter((l) => l.collectionId === c.id)
      .map(({ id: _id, ...link }) => ({ ...link }));
    await deleteWithUndo({
      remove: () => collectionsService.remove(c.id),
      restore: () => collectionsService.restore(c, savedLinks),
      message: t("toast.collectionRemoved"),
      undoLabel: t("common.undo"),
      toast: (msg, opts) => toast.success(msg, opts),
      duration: 5000,
    });
  };

  const sorted = collections.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="pb-24">
      <Link to="/library" className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" /> {t("nav.library")}
      </Link>
      <PageHeader
        title={t("collections.title")}
        actions={<Button onClick={openCreate}><Plus /> {t(`collections.newByKind.${active}`)}</Button>}
      />

      <div role="tablist" className="mb-5 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-border no-scrollbar">
        {(["manual", "collection"] as const).map(key => (
          <button
            key={key}
            role="tab"
            aria-selected={active === key}
            onClick={() => setActive(key)}
            className={cn("-mb-px shrink-0 border-b-2 pb-2 text-sm font-medium transition-colors", active === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t(`collections.kind.${key}`)}
          </button>
        ))}
      </div>

      {allCollections === undefined ? (
        <div className="space-y-2"><div className="paper-skeleton h-20" /><div className="paper-skeleton h-20" /></div>
      ) : !sorted.length ? (
        <EmptyState
          icon={FolderOpen}
          hint={t(`collections.emptyByKind.${active}`)}
          cta={{ label: t(`collections.newByKind.${active}`), onClick: openCreate }}
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {sorted.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: c.color ? `hsl(var(--key-${c.color}))` : "hsl(var(--muted))" }}
                aria-hidden
              />
              <div className="min-w-[calc(100%-2rem)] flex-1 min-[700px]:min-w-0">
                <Link to={`/library/collections/${c.id}`} className="block break-words font-serif text-xl font-semibold leading-tight hover:underline underline-offset-4">{c.name}</Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs tabular-nums text-muted-foreground">
                  {(c.composer || c.catalog) && <span className="italic">{[c.composer, c.catalog, c.edition].filter(Boolean).join(" · ")}</span>}
                  <span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" /> {t("collections.materialCount", { count: countFor(c.id) })}</span>
                </div>
              </div>
              <Button asChild size="sm" variant="outline"><Link to={`/library/collections/${c.id}`}><Music2 />{t("collection.manage")}</Link></Button>
              <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => openEdit(c)} aria-label={`${t("common.edit")} ${c.name}`}><Pencil /></Button>
              <Button size="icon" variant="ghost" className="h-10 w-10 hover:text-destructive" onClick={() => deleteCollection(c)} aria-label={`${t("common.delete")} ${c.name}`}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}

      <NewCollectionSheet
        open={editorOpen}
        onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}
        collection={editing}
        kind={active}
      />
    </div>
  );
}

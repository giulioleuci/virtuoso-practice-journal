import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Pencil, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { LibraryItem } from "@/domain/entities/library";
import { collectionsService } from "@/lib/services";
import { today } from "@/lib/date";
import { subjectColorCss } from "@/lib/subjectColors";
import { useI18n } from "@/lib/i18n";
import { useCollection, useCollectionItems, useLibraryByKind, useSubjects } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { nativeSelect } from "@/components/diary/WhenFields";
import { NewCollectionSheet } from "@/components/collections/NewCollectionSheet";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";

/** One collection: its materials, and the rest of the library to add from. */
export default function CollectionPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const collectionId = Number(id);
  const collection = useCollection(collectionId);
  const links = useCollectionItems(collectionId);
  const kind = collection?.kind ?? "repertoire";
  const library = useLibraryByKind(kind) as LibraryItem[] | undefined;
  const subjects = useSubjects();

  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);

  const includedIds = useMemo(() => new Set((links ?? []).map((l) => l.itemId)), [links]);
  const included = useMemo(() => (library ?? []).filter((i) => includedIds.has(i.id!)).sort((a, b) => a.title.localeCompare(b.title)), [library, includedIds]);
  const candidates = useMemo(() => (library ?? []).filter((i) => !includedIds.has(i.id!)), [library, includedIds]);
  const composers = useMemo(() => [...new Set(candidates.map((c) => c.composer).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [candidates]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates
      .filter((i) => (!composer || i.composer === composer) && (!q || `${i.title} ${i.composer ?? ""}`.toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [candidates, search, composer]);

  if (collection === undefined || library === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!collection || collection.deletedAt) return <EmptyState title={t("collection.notFound")} />;

  const subjectDot = (subjectId: number) => {
    const s = subjects?.find((x) => x.id === subjectId);
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(s?.color, s?.type, s?.customColor) }} title={s?.name} role="img" aria-label={s?.name} />;
  };
  const add = async (item: LibraryItem) => { await collectionsService.addItems(collectionId, [item.id!]); toast.success(t("toast.pieceAdded")); };
  const remove = async (item: LibraryItem) => { await collectionsService.removeItems(collectionId, [item.id!]); toast.success(t("toast.pieceRemoved")); };
  const study = () =>
    navigate("/tasks/new", { state: { date: today(), prefill: { collectionId, subjectId: collection.defaultSubjectId ?? included[0]?.subjectId } } });

  return (
    <div className="pb-24">
      <Link to={`/library/collections?kind=${kind}`} className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />{t("collection.all")}
      </Link>
      <PageHeader
        title={collection.name}
        subtitle={[collection.composer, collection.catalog, collection.notes].filter(Boolean).join(" · ") || undefined}
        actions={<Button variant="outline" onClick={() => setEditOpen(true)}><Pencil />{t("collection.edit")}</Button>}
      />

      <section className="mb-10">
        <SectionHeader title={t("collection.items")} action={included.length > 0 && <Button onClick={study}><Play />{t("collection.study")}</Button>} />
        {included.length === 0 ? (
          <p className="border-t border-border py-6 text-sm text-muted-foreground">{t("collection.emptyItems")}</p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {included.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3.5">
                {subjectDot(item.subjectId)}
                <div className="min-w-0 flex-1">
                  <Link to={`/library/item/${item.id}`} className="break-words text-base font-medium hover:underline underline-offset-4">{item.title}</Link>
                  {item.composer && <div className="text-xs italic text-muted-foreground">{item.composer}</div>}
                </div>
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label={`${t("common.edit")} ${item.title}`} onClick={() => setEditingItem(item)}><Pencil /></Button>
                <Button size="sm" variant="outline" aria-label={t("collection.removeNamed", { title: item.title })} onClick={() => remove(item)}><X />{t("collection.remove")}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title={t("collection.addFromLibrary")} action={<Button variant="outline" onClick={() => setNewItemOpen(true)}><Plus />{t("collection.newItem")}</Button>} />
        <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_240px]">
          <Input type="search" aria-label={t("collection.search")} placeholder={t("collection.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label={t("collection.author")} value={composer} onChange={(e) => setComposer(e.target.value)} className={nativeSelect}>
            <option value="">{t("collection.allAuthors")}</option>
            {composers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title={t("collection.noCandidates")} hint={t("collection.noCandidatesHint")} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                {subjectDot(item.subjectId)}
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium">{item.title}</div>
                  {item.composer && <div className="text-xs italic text-muted-foreground">{item.composer}</div>}
                </div>
                <Button size="sm" aria-label={t("collection.addNamed", { title: item.title })} onClick={() => add(item)}><Plus />{t("collection.add")}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewCollectionSheet open={editOpen} onOpenChange={setEditOpen} collection={collection} kind={kind} />
      <NewLibraryItemSheet open={newItemOpen || editingItem !== null} onOpenChange={(o) => { if (!o) { setNewItemOpen(false); setEditingItem(null); } }} kind={editingItem?.kind ?? kind} item={editingItem} />
    </div>
  );
}

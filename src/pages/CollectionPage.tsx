import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, Pencil, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { CollectionItem } from "@/domain/entities/collection";
import type { LibraryKind } from "@/domain/entities/common";
import { collectionLinkInputSchema } from "@/lib/schemas";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
import type { LibraryItem } from "@/domain/entities/library";
import { collectionsService } from "@/lib/services";
import { today } from "@/lib/date";
import { subjectColorCss } from "@/lib/subjectColors";
import { useI18n } from "@/lib/i18n";
import { useCollection, useCollectionItems, useLibrary, useSubjects } from "@/presentation/hooks/useEntities";
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
  const kind = collection?.kind ?? "collection";
  const library = useLibrary();
  const subjects = useSubjects();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [linkDraft, setLinkDraft] = useState<{ itemId: number; reference: string; pageStart: string; pageEnd: string }>();
  const [newKind, setNewKind] = useState<LibraryKind>("piece");
  const linkInput = linkDraft && { reference: linkDraft.reference.trim() || undefined, pageStart: linkDraft.pageStart === "" ? undefined : Number(linkDraft.pageStart), pageEnd: linkDraft.pageEnd === "" ? undefined : Number(linkDraft.pageEnd) };
  const validLink = collectionLinkInputSchema.safeParse(linkInput).success;
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);

  const includedIds = useMemo(() => new Set((links ?? []).map((l) => l.itemId)), [links]);
  const included = useMemo(() => {
    const byId = new Map((library ?? []).map(item => [item.id, item]));
    return [...(links ?? [])].sort((a, b) => a.position - b.position).flatMap(link => byId.get(link.itemId) ?? []);
  }, [library, links]);
  const candidates = useMemo(() => (library ?? []).filter((i) => !includedIds.has(i.id!)), [library, includedIds]);
  const composers = useMemo(() => [...new Set(candidates.map((c) => c.composer).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [candidates]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates
      .filter((i) => (!composer || i.composer === composer) && (!q || `${i.title} ${i.composer ?? ""}`.toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [candidates, search, composer]);

  if (collection === undefined || library === undefined || links === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!collection || collection.deletedAt) return <EmptyState title={t("collection.notFound")} />;

  const subjectDot = (subjectId: number) => {
    const s = subjects?.find((x) => x.id === subjectId);
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(s?.color, s?.type, s?.customColor) }} title={s?.name} role="img" aria-label={s?.name} />;
  };
  const reportError = (e: unknown) => setError(e instanceof Error && /^(collection|library)\.error\./.test(e.message) ? t(e.message) : t("errors.couldNotSave"));
  const add = async (item: LibraryItem) => {
    setBusy(true); setError(undefined);
    try { await collectionsService.addItems(collectionId, [item.id!]); toast.success(t("toast.pieceAdded")); }
    catch (e) { reportError(e); } finally { setBusy(false); }
  };
  const remove = async (item: LibraryItem) => {
    const link = links.find(l => l.itemId === item.id)!;
    const order = links.map(l => l.itemId);
    setBusy(true); setError(undefined);
    try {
      await deleteWithUndo({ remove: () => collectionsService.removeItems(collectionId, [item.id!]), restore: async () => {
        try {
          await collectionsService.addItems(collectionId, [item.id!]);
          await collectionsService.updateItemLink(collectionId, item.id!, link);
          const current = await collectionsService.items(collectionId);
          const present = new Set(current.map(l => l.itemId));
          await collectionsService.reorderItems(collectionId, [...order.filter(id => present.has(id)), ...current.filter(l => !order.includes(l.itemId)).map(l => l.itemId)]);
        } catch (e) { reportError(e); }
      }, message: t("toast.pieceRemoved"), undoLabel: t("common.undo"), toast: (message, options) => toast.success(message, options) });
    } catch (e) { reportError(e); } finally { setBusy(false); }
  };
  const move = async (itemId: number, direction: -1 | 1) => {
    const ids = links.map(link => link.itemId);
    const i = ids.indexOf(itemId), j = i + direction;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true); setError(undefined);
    try { await collectionsService.reorderItems(collectionId, ids); }
    catch (e) { reportError(e); } finally { setBusy(false); }
  };
  const editLink = (link: CollectionItem) => setLinkDraft({ itemId: link.itemId, reference: link.reference ?? "", pageStart: link.pageStart?.toString() ?? "", pageEnd: link.pageEnd?.toString() ?? "" });
  const saveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkDraft || !linkInput || !validLink || busy) return;
    setBusy(true); setError(undefined);
    try { await collectionsService.updateItemLink(collectionId, linkDraft.itemId, linkInput); setLinkDraft(undefined); }
    catch (e) { reportError(e); } finally { setBusy(false); }
  };
  const study = () =>
    navigate("/tasks/new", { state: { date: today(), prefill: { collectionId, subjectId: collection.defaultSubjectId ?? included[0]?.subjectId } } });

  return (
    <div className="pb-24">
      <Link to={`/library/collections?kind=${kind}`} className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />{t("collection.all")}
      </Link>
      <PageHeader
        title={collection.name}
        subtitle={[collection.composer, collection.catalog, collection.edition, collection.notes].filter(Boolean).join(" · ") || undefined}
        actions={<Button variant="outline" onClick={() => setEditOpen(true)}><Pencil />{t("collections.editCollection")}</Button>}
      />

      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <section className="mb-10">
        <SectionHeader title={t("collection.items")} action={included.length > 0 && <Button onClick={study}><Play />{t("collection.study")}</Button>} />
        {included.length === 0 ? (
          <p className="border-t border-border py-6 text-sm text-muted-foreground">{t("collection.emptyItems")}</p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {included.map((item, index) => {
              const link = links.find(l => l.itemId === item.id)!;
              return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3.5">
                {subjectDot(item.subjectId)}
                <div className="min-w-0 flex-1">
                  <Link to={`/library/item/${item.id}`} className="break-words text-base font-medium hover:underline underline-offset-4">{item.title}</Link>
                  {item.composer && <div className="text-xs italic text-muted-foreground">{item.composer}</div>}
                  <p className="text-xs text-muted-foreground">{t(`library.kind.${item.kind}`)}{link.reference ? ` · ${link.reference}` : ""}{link.pageStart ? ` · ${t("collection.pageStart")}: ${link.pageStart}${link.pageEnd ? `–${link.pageEnd}` : ""}` : ""}</p>
                </div>
                <Button size="icon" variant="ghost" disabled={busy || index === 0} aria-label={t("segments.moveUp")} onClick={() => move(item.id!, -1)}><ArrowUp /></Button>
                <Button size="icon" variant="ghost" disabled={busy || index === included.length - 1} aria-label={t("segments.moveDown")} onClick={() => move(item.id!, 1)}><ArrowDown /></Button>
                <Button size="icon" variant="ghost" aria-label={t("collection.editLink")} onClick={() => editLink(link)}><Pencil /></Button>
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label={`${t("common.edit")} ${item.title}`} onClick={() => setEditingItem(item)}><Pencil /></Button>
                <Button size="sm" variant="outline" disabled={busy} aria-label={t("collection.removeNamed", { title: item.title })} onClick={() => remove(item)}><X />{t("collection.remove")}</Button>
                {linkDraft?.itemId === item.id && <form onSubmit={saveLink} className="grid w-full gap-3 border-t border-border pt-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">{t("collection.reference")}<Input autoFocus maxLength={120} value={linkDraft.reference} onChange={e => setLinkDraft({ ...linkDraft, reference: e.target.value })} /></label>
                  {(["pageStart", "pageEnd"] as const).map(field => <label key={field} className="grid gap-1.5 text-xs font-medium">{t(`collection.${field}`)}<Input type="number" min={1} step={1} aria-invalid={!validLink} value={linkDraft[field]} onChange={e => setLinkDraft({ ...linkDraft, [field]: e.target.value })} /></label>)}
                  {!validLink && <p role="alert" className="text-xs text-destructive sm:col-span-2">{t("collection.error.pages")}</p>}
                  <Button type="button" variant="ghost" onClick={() => setLinkDraft(undefined)}>{t("common.cancel")}</Button><Button disabled={busy || !validLink}>{t("common.save")}</Button>
                </form>}
              </li>
            ); })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title={t("collection.addFromLibrary")} action={<Button variant="outline" onClick={() => { setNewKind("piece"); setNewItemOpen(true); }}><Plus />{t("collection.newItem")}</Button>} />
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
                  <p className="text-xs text-muted-foreground">{t(`library.kind.${item.kind}`)}</p>
                </div>
                <Button size="sm" disabled={busy} aria-label={t("collection.addNamed", { title: item.title })} onClick={() => add(item)}><Plus />{t("common.add")}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewCollectionSheet open={editOpen} onOpenChange={setEditOpen} collection={collection} kind={kind} />
      <NewLibraryItemSheet open={newItemOpen || editingItem !== null} onOpenChange={(o) => { if (!o) { setNewItemOpen(false); setEditingItem(null); } }} kind={editingItem?.kind ?? newKind} item={editingItem} collectionId={collectionId} defaultSubjectId={collection.defaultSubjectId} />
    </div>
  );
}

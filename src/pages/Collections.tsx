import { useMemo, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db, type Collection, type LibraryKind } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ChevronLeft, FolderOpen, Music2, BookOpen, Activity, Brain } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { collectionsService } from "@/lib/services";
import { NewCollectionSheet } from "@/components/collections/NewCollectionSheet";
import { AssignPiecesSheet } from "@/components/collections/AssignPiecesSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string; tint: string }[] = [
  { key: "repertoire", icon: Music2, tKey: "library.kind.repertoire", tint: "hsl(var(--key-terracotta))" },
  { key: "manual",     icon: BookOpen, tKey: "library.kind.manual",   tint: "hsl(var(--key-gold))" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique", tint: "hsl(var(--key-sage))" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory",      tint: "hsl(var(--key-blue))" },
];

export default function Collections() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKind = (searchParams.get("kind") as LibraryKind) || "repertoire";
  const [active, setActive] = useState<LibraryKind>(
    KINDS.some((k) => k.key === initialKind) ? initialKind : "repertoire"
  );

  useEffect(() => {
    if (searchParams.get("kind") !== active) {
      setSearchParams({ kind: active }, { replace: true });
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCollections = useLiveQuery(
    () => db.collections.filter((c) => !c.deletedAt).toArray(),
    []
  );
  const links = useLiveQuery(() => db.collectionItems.toArray(), []);

  const collections = useMemo(
    () => (allCollections ?? []).filter((c) => c.kind === active),
    [allCollections, active]
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [assigning, setAssigning] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  const countFor = (id?: number) =>
    id ? (links ?? []).filter((l) => l.collectionId === id).length : 0;

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (c: Collection) => { setEditing(c); setEditorOpen(true); };

  const confirmDelete = async () => {
    if (!deleting?.id) return;
    await collectionsService.remove(deleting.id);
    toast.success(t("toast.collectionRemoved"));
    setDeleting(null);
  };

  const sorted = collections.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate("/library")} className="-ml-2">
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("collections.back")}
        </Button>
        <h2 className="font-serif text-3xl ml-auto">{t("collections.title")}</h2>
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

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> {t(`collections.newByKind.${active}`)}
        </Button>
      </div>

      {allCollections === undefined ? (
        <div className="space-y-2"><div className="paper-skeleton h-20" /><div className="paper-skeleton h-20" /></div>
      ) : !sorted.length ? (
        <button onClick={openCreate} className="paper-card p-8 text-center w-full hover:-translate-y-0.5 transition-transform">
          <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground italic mb-2">{t(`collections.emptyByKind.${active}`)}</p>
          <span className="inline-flex items-center gap-1 text-primary font-medium text-sm">
            <Plus className="h-4 w-4" /> {t(`collections.newByKind.${active}`)}
          </span>
        </button>
      ) : (
        <ul className="space-y-2">
          {sorted.map((c) => {
            const count = countFor(c.id);
            return (
              <li key={c.id} className="paper-card p-4 flex gap-3">
                <span
                  className="w-1.5 rounded-full self-stretch shrink-0"
                  style={{ backgroundColor: c.color ? `hsl(var(--key-${c.color}))` : "hsl(var(--muted))" }}
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="min-w-0">
                    <div className="font-serif text-xl break-words">{c.name}</div>
                    {(c.composer || c.catalog) && (
                      <div className="text-xs text-muted-foreground break-words italic">
                        {[c.composer, c.catalog].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground tabular-nums mt-1 inline-flex items-center gap-1">
                      <Music2 className="h-3 w-3" /> {t(`collections.itemsCount.${active}`, { count })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 -ml-2">
                    <Button size="sm" variant="ghost" onClick={() => setAssigning(c)}>
                      <Music2 className="h-4 w-4 mr-1" /> {t(`collections.manageItems.${active}`)}
                    </Button>
                    <button
                      onClick={() => openEdit(c)}
                      className="ml-auto p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(c)}
                      className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NewCollectionSheet
        open={editorOpen}
        onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}
        collection={editing}
        kind={active}
      />
      <AssignPiecesSheet
        open={assigning !== null}
        onOpenChange={(o) => !o && setAssigning(null)}
        collection={assigning}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteCollection")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.deleteCollectionDesc", { count: countFor(deleting?.id) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("dialog.detachDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

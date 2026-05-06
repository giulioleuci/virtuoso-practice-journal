import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { db, type Collection } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ChevronLeft, FolderOpen, Music2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { collectionsService } from "@/lib/services";
import { NewCollectionSheet } from "@/components/collections/NewCollectionSheet";
import { AssignPiecesSheet } from "@/components/collections/AssignPiecesSheet";
import { toast } from "sonner";

export default function Collections() {
  const navigate = useNavigate();
  const collections = useLiveQuery(
    () => db.collections.filter((c) => !c.deletedAt).toArray(),
    []
  );
  const links = useLiveQuery(() => db.collectionItems.toArray(), []);

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
    toast.success("Collection removed; pieces detached");
    setDeleting(null);
  };

  const sorted = (collections ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate("/library")} className="-ml-2">
          <ChevronLeft className="h-4 w-4 mr-1" /> Library
        </Button>
        <h2 className="font-serif text-3xl ml-auto">Collections</h2>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> New collection
        </Button>
      </div>

      {collections === undefined ? (
        <div className="space-y-2"><div className="paper-skeleton h-20" /><div className="paper-skeleton h-20" /></div>
      ) : !sorted.length ? (
        <button onClick={openCreate} className="paper-card p-8 text-center w-full hover:-translate-y-0.5 transition-transform">
          <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground italic mb-2">No collections yet.</p>
          <span className="inline-flex items-center gap-1 text-primary font-medium text-sm">
            <Plus className="h-4 w-4" /> Create your first
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
                      <Music2 className="h-3 w-3" /> {count} piece{count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 -ml-2">
                    <Button size="sm" variant="ghost" onClick={() => setAssigning(c)}>
                      <Music2 className="h-4 w-4 mr-1" /> Manage pieces
                    </Button>
                    <button
                      onClick={() => openEdit(c)}
                      className="ml-auto p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(c)}
                      className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                      aria-label="Delete"
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
      />
      <AssignPiecesSheet
        open={assigning !== null}
        onOpenChange={(o) => !o && setAssigning(null)}
        collection={assigning}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              The {countFor(deleting?.id)} piece{countFor(deleting?.id) === 1 ? "" : "s"} inside will be detached but kept in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Detach & delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

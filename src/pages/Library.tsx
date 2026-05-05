import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind, type LibraryItem, type Segment } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BookOpen, Music2, Activity, Brain, Plus, Pencil, Trash2, Star, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";
import { ItemHelpSheet } from "@/components/library/ItemHelpSheet";
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

const KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string }[] = [
  { key: "repertoire", icon: Music2, tKey: "library.kind.repertoire" },
  { key: "manual",     icon: BookOpen, tKey: "library.kind.manual" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory" },
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
  const allHelp = useLiveQuery(() => db.helpRequests.toArray(), []);

  const items = useLiveQuery(
    () => db.library.where("kind").equals(active).toArray(),
    [active]
  );
  const allSegments = useLiveQuery(() => db.segments.toArray(), []);
  const segmentsByItem = (allSegments ?? []).reduce<Record<number, Segment[]>>((acc, s) => {
    (acc[s.itemId] ||= []).push(s);
    return acc;
  }, {});

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
    await db.transaction("rw", db.library, db.segments, async () => {
      await db.segments.where("itemId").equals(deletingId).delete();
      await db.library.delete(deletingId);
    });
    toast.success("Deleted");
    setDeletingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">{t("nav.library")}</h2>
        <Button size="sm" variant="ghost" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> {t("library.add")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {KINDS.map(({ key, icon: Icon, tKey }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={cn(
              "paper-card flex flex-col items-center gap-1 py-3 transition-all",
              active === key ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
            )}
          >
            <Icon className={cn("h-5 w-5", active === key ? "text-primary" : "text-muted-foreground")} />
            <span className="text-[11px] font-medium leading-tight text-center">{t(tKey)}</span>
          </button>
        ))}
      </div>

      {!items?.length ? (
        <button
          onClick={openCreate}
          className="paper-card p-10 text-center w-full hover:-translate-y-0.5 transition-transform"
        >
          <p className="text-muted-foreground italic mb-2">{t("library.empty")}</p>
          <span className="inline-flex items-center gap-1 text-primary font-medium text-sm">
            <Plus className="h-4 w-4" /> {t("library.add")}
          </span>
        </button>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const segs = it.id ? (segmentsByItem[it.id] ?? []) : [];
            const avgConfidence = segs.length
              ? segs.reduce((sum, s) => sum + (s.confidence ?? 0), 0) / segs.length
              : 0;
            return (
              <li key={it.id} className="paper-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-xl truncate">{it.title}</div>
                    {it.composer && (
                      <div className="text-sm text-muted-foreground italic truncate">
                        {it.composer}
                      </div>
                    )}
                    {it.kind === "repertoire" && it.status && (
                      <div className="inline-block mt-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-foreground/80">
                        {STATUS_LABEL[it.status]}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {it.targetBpm && (
                      <div className="text-sm font-serif tabular-nums text-primary whitespace-nowrap">
                        {it.noteVal ? NOTE_GLYPH[it.noteVal] : "♩"} = {it.targetBpm}
                      </div>
                    )}
                    <button
                      onClick={() => openEdit(it)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => it.id && setDeletingId(it.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Technique extras */}
                {it.kind === "technique" && (it.startBpm || it.targetBpm) && (
                  <div className="text-xs text-muted-foreground tabular-nums mt-1">
                    {it.startBpm ?? "—"} → {it.targetBpm ?? "—"} BPM
                  </div>
                )}

                {/* Manual progress */}
                {it.kind === "manual" && (it.totalExercises || it.currentExercise) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Exercise {it.currentExercise ?? 1}
                    {it.totalExercises ? ` / ${it.totalExercises}` : ""}
                  </div>
                )}

                {/* Layers chips */}
                {!!it.layers?.length && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {it.layers.map((l) => (
                      <span
                        key={l}
                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/60 text-foreground/70"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                )}

                {/* Segments preview */}
                {(it.kind === "repertoire" || it.kind === "manual") && segs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span>{segs.length} segment{segs.length === 1 ? "" : "s"}</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span className="tabular-nums">{avgConfidence.toFixed(1)}/5</span>
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {segs.slice(0, 3).map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate flex-1">{s.label}</span>
                          <span className="flex items-center gap-2 shrink-0 text-muted-foreground tabular-nums">
                            {s.targetBpm && (
                              <span>
                                {s.noteVal ? NOTE_GLYPH[s.noteVal] : "♩"}={s.targetBpm}
                              </span>
                            )}
                            <span className="inline-flex">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={cn(
                                    "h-2.5 w-2.5",
                                    n <= s.confidence
                                      ? "fill-primary text-primary"
                                      : "text-muted-foreground/30"
                                  )}
                                />
                              ))}
                            </span>
                          </span>
                        </li>
                      ))}
                      {segs.length > 3 && (
                        <li className="text-[11px] italic text-muted-foreground">
                          +{segs.length - 3} more…
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Theory mastery */}
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
          })}
        </ul>
      )}

      <NewLibraryItemSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditing(null);
        }}
        kind={editing?.kind ?? active}
        item={editing}
      />

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

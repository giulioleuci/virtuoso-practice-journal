import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Collection, type ColorKey, type LibraryKind } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collectionsService } from "@/lib/services";
import { collectionInputSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLORS: ColorKey[] = ["terracotta", "sage", "gold", "blue", "plum"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collection?: Collection | null;
  /** Kind to assign on create. Ignored when editing (uses collection.kind). */
  kind?: LibraryKind;
  onSaved?: (id: number) => void;
}

export function NewCollectionSheet({ open, onOpenChange, collection, kind, onSaved }: Props) {
  const { t } = useI18n();
  const isEdit = !!collection?.id;
  const effectiveKind: LibraryKind = collection?.kind ?? kind ?? "repertoire";
  const showComposerLike = effectiveKind === "repertoire" || effectiveKind === "manual";
  const subjects = useLiveQuery(() => db.subjects.filter((s) => !s.deletedAt).toArray(), []);

  const [name, setName] = useState("");
  const [composer, setComposer] = useState("");
  const [catalog, setCatalog] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<ColorKey | undefined>();
  const [defaultSubjectId, setDefaultSubjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? "");
    setComposer(collection?.composer ?? "");
    setCatalog(collection?.catalog ?? "");
    setNotes(collection?.notes ?? "");
    setColor(collection?.color);
    setDefaultSubjectId(collection?.defaultSubjectId);
  }, [open, collection?.id]);

  const input = {
    kind: effectiveKind,
    name: name.trim(),
    composer: showComposerLike ? (composer.trim() || undefined) : undefined,
    catalog: showComposerLike ? (catalog.trim() || undefined) : undefined,
    notes: notes.trim() || undefined,
    color,
    defaultSubjectId,
  };
  const parsed = collectionInputSchema.safeParse(input);
  const canSave = parsed.success;

  const save = async () => {
    if (!canSave) return;
    try {
      if (isEdit && collection?.id) {
        await collectionsService.update(collection.id, input);
        toast.success(t("toast.collectionUpdated"));
        onSaved?.(collection.id);
      } else {
        const id = await collectionsService.create(input);
        toast.success(t("toast.collectionCreated"));
        onSaved?.(id);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(t("toast.saved"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl bg-background p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <SheetTitle className="font-serif text-3xl">
            {isEdit ? t("collections.editCollection") : t(`collections.newByKind.${effectiveKind}`)}
          </SheetTitle>
          <SheetDescription className="italic">
            {t(`collections.groupHintByKind.${effectiveKind}`)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(`collections.namePlaceholder.${effectiveKind}`)}
              className="bg-card text-lg h-12"
              autoFocus
            />
          </div>

          {showComposerLike && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {effectiveKind === "manual" ? t("library.labelAuthor") : t("library.labelComposer")}
                </Label>
                <Input value={composer} onChange={(e) => setComposer(e.target.value)} placeholder={effectiveKind === "manual" ? "Hanon" : "Chopin"} className="bg-card" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("collections.labelCatalog")}</Label>
                <Input value={catalog} onChange={(e) => setCatalog(e.target.value)} placeholder="Op. 9" className="bg-card" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("collections.labelColor")}</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(undefined)}
                className={cn("h-9 px-3 rounded-full text-xs border", !color ? "border-foreground" : "border-input text-muted-foreground")}
              >{t("collections.colorNone")}</button>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: `hsl(var(--key-${c}))` }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("collections.labelDefaultSubject")}</Label>
            <Select
              value={defaultSubjectId !== undefined ? String(defaultSubjectId) : "none"}
              onValueChange={(v) => setDefaultSubjectId(v === "none" ? undefined : Number(v))}
            >
              <SelectTrigger className="bg-card"><SelectValue placeholder={t("common.optional")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("collections.colorNone")}</SelectItem>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("collections.labelNotesOptional")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" className="bg-card" rows={3} />
          </div>
        </div>

        <SheetFooter className="px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-border bg-background/80 backdrop-blur">
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">{t("common.cancel")}</Button>
            <Button onClick={save} disabled={!canSave} className="flex-1">
              {isEdit ? t("collections.saveChanges") : t("collections.createCollection")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

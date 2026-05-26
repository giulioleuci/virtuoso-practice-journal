import { useSubjects } from "@/hooks/useEntities";
import { type Collection, type ColorKey, type LibraryKind } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { useSheetForm } from "@/hooks/useSheetForm";
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
  const subjects = useSubjects();

  interface FormValues {
    name: string;
    composer: string;
    catalog: string;
    notes: string;
    color?: ColorKey;
    defaultSubjectId?: number;
  }

  const toInput = (v: FormValues) => ({
    kind: effectiveKind,
    name: v.name.trim(),
    composer: showComposerLike ? (v.composer.trim() || undefined) : undefined,
    catalog: showComposerLike ? (v.catalog.trim() || undefined) : undefined,
    notes: v.notes.trim() || undefined,
    color: v.color,
    defaultSubjectId: v.defaultSubjectId,
  });

  const { values, setField, canSave, submit } = useSheetForm<FormValues>({
    open,
    resetKey: collection?.id,
    initial: { name: "", composer: "", catalog: "", notes: "", color: undefined, defaultSubjectId: undefined },
    prefill: () => ({
      name: collection?.name ?? "",
      composer: collection?.composer ?? "",
      catalog: collection?.catalog ?? "",
      notes: collection?.notes ?? "",
      color: collection?.color,
      defaultSubjectId: collection?.defaultSubjectId,
    }),
    validate: (v) => ({ ok: collectionInputSchema.safeParse(toInput(v)).success }),
    onSubmit: async (v) => {
      const input = toInput(v);
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
        toast.error(e instanceof Error ? e.message : t("errors.couldNotSave"));
      }
    },
  });
  const { name, composer, catalog, notes, color, defaultSubjectId } = values;
  const save = submit;

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
              onChange={(e) => setField("name", e.target.value)}
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
                <Input value={composer} onChange={(e) => setField("composer", e.target.value)} placeholder={effectiveKind === "manual" ? "Hanon" : "Chopin"} className="bg-card" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("collections.labelCatalog")}</Label>
                <Input value={catalog} onChange={(e) => setField("catalog", e.target.value)} placeholder="Op. 9" className="bg-card" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("collections.labelColor")}</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setField("color", undefined)}
                className={cn("h-9 px-3 rounded-full text-xs border", !color ? "border-foreground" : "border-input text-muted-foreground")}
              >{t("collections.colorNone")}</button>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setField("color", c)}
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
              onValueChange={(v) => setField("defaultSubjectId", v === "none" ? undefined : Number(v))}
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
            <Textarea value={notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t("collections.notesPlaceholder")} className="bg-card" rows={3} />
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

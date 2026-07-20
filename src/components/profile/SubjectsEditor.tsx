import { useState } from "react";
import { useSubjects, useTechniques } from "@/presentation/hooks/useEntities";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { ColorKey, Subject, SubjectType } from "@/domain/entities/common";
import { subjectsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { COLOR_KEYS, getSubjectColor, subjectColorCss } from "@/lib/subjectColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, X, Trash2, Piano, BookOpen, ChevronDown, Layers, Wrench, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SubjectsEditor() {
  const { t } = useI18n();
  const subjects = useSubjects();
  const techniques = useTechniques();

  const instruments = (subjects ?? []).filter((s) => s.type === "instrument");
  const theory = (subjects ?? []).filter((s) => s.type === "theory");

  return (
    <section className="space-y-5">
      <header className="px-1">
        <h2 className="font-serif text-xl">{t("subjects.title")}</h2>
        <p className="text-xs text-muted-foreground italic mt-1">{t("subjects.desc")}</p>
      </header>

      <SubjectGroup
        icon={<Piano className="h-4 w-4" />}
        title={t("onb.subjects.instruments")}
        addLabel={t("onb.subjects.addInstrument")}
        placeholder={t("onb.subjects.newInstrument")}
        type="instrument"
        items={instruments}
        techniques={techniques ?? []}
        all={subjects ?? []}
      />

      <SubjectGroup
        icon={<BookOpen className="h-4 w-4" />}
        title={t("onb.subjects.theory")}
        addLabel={t("onb.subjects.addTheory")}
        placeholder={t("onb.subjects.newTheory")}
        type="theory"
        items={theory}
        techniques={techniques ?? []}
        all={subjects ?? []}
      />
    </section>
  );
}

function SubjectGroup({
  icon, title, addLabel, placeholder, type, items, techniques, all,
}: {
  icon: React.ReactNode;
  title: string;
  addLabel: string;
  placeholder: string;
  type: SubjectType;
  items: Subject[];
  techniques: { id?: number; subjectId: number; name: string }[];
  all: Subject[];
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const submit = async () => {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    if (all.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t("errors.subjectExists")); return;
    }
    const id = await subjectsService.create(name, type);
    setDraft(""); setAdding(false);
    setOpenId(typeof id === "number" ? id : null);
  };

  return (
    <div className="paper-card p-3 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground px-1">
        {icon}
        <h3 className="text-[11px] uppercase tracking-widest">{title}</h3>
        <span className="text-xs ml-auto tabular-nums">{items.length}</span>
      </div>

      <div className="space-y-2">
        {items.map((s) => (
          <SubjectCard
            key={s.id}
            subject={s}
            techniques={techniques.filter((tech) => tech.subjectId === s.id)}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id ?? null)}
          />
        ))}
        {!items.length && !adding && (
          <p className="text-xs italic text-muted-foreground py-1 px-1">—</p>
        )}
      </div>

      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(); }
              if (e.key === "Escape") { setAdding(false); setDraft(""); }
            }}
            placeholder={placeholder}
            className="h-11"
          />
          <Button size="default" onClick={submit} className="h-11 px-4">{t("common.add")}</Button>
          <Button size="icon" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }} className="h-11 w-11 shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          onClick={() => setAdding(true)}
          className="w-full justify-center h-11 border border-dashed border-border/60 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />{addLabel}
        </Button>
      )}
    </div>
  );
}

function InlineEdit({ value, onSave, onCancel, placeholder, size = "sm" }: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
  size?: "sm" | "md";
}) {
  const [draft, setDraft] = useState(value);
  const h = size === "md" ? "h-10" : "h-9";
  const btnH = size === "md" ? "h-10 w-10" : "h-9 w-9";
  return (
    <div className="flex items-center gap-1.5 w-full">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) onSave(draft.trim()); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className={cn("text-sm flex-1", h)}
      />
      <button
        onClick={() => { if (draft.trim()) onSave(draft.trim()); }}
        className={cn("rounded-md hover:bg-accent text-primary inline-flex items-center justify-center shrink-0", btnH)}
        aria-label="save"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={onCancel}
        className={cn("rounded-md hover:bg-accent text-muted-foreground inline-flex items-center justify-center shrink-0", btnH)}
        aria-label="cancel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Chip({
  label, onEdit, onRemove,
}: {
  label: string;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="inline-flex items-stretch rounded-full bg-accent/70 overflow-hidden h-8 max-w-full">
      <span className="px-3 inline-flex items-center text-xs truncate">{label}</span>
      {onEdit && (
        <button
          onClick={onEdit}
          className="px-2 inline-flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-primary border-l border-background/60"
          aria-label="edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="px-2 inline-flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-destructive border-l border-background/60"
          aria-label="remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span className="text-[10px] uppercase tracking-widest">{label}</span>
      {count !== undefined && <span className="text-[10px] tabular-nums ml-auto">{count}</span>}
    </div>
  );
}

function SubjectCard({
  subject, techniques, open, onToggle,
}: {
  subject: Subject;
  techniques: { id?: number; subjectId: number; name: string }[];
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const [layerDraft, setLayerDraft] = useState("");
  const [techDraft, setTechDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingLayer, setEditingLayer] = useState<string | null>(null);
  const [editingTechId, setEditingTechId] = useState<number | null>(null);

  const layerCount = subject.type === "theory" ? THEORY_LAYERS.length : (subject.layers ?? []).length;

  const doDelete = async () => {
    if (!subject.id) return;
    await subjectsService.remove(subject.id);
    toast.success(t("toast.subjectDeleted"));
    setConfirmDelete(false);
  };

  const saveName = async (newName: string) => {
    if (!subject.id) return;
    await subjectsService.rename(subject.id, newName);
    setEditingName(false);
  };

  const addLayer = async () => {
    const v = layerDraft.trim();
    if (!v || !subject.id) return;
    await subjectsService.addLayer(subject.id, v);
    setLayerDraft("");
  };

  const removeLayer = async (l: string) => {
    if (!subject.id) return;
    await subjectsService.removeLayer(subject.id, l);
  };

  const saveLayer = async (oldName: string, newName: string) => {
    if (!subject.id) return;
    await subjectsService.renameLayer(subject.id, oldName, newName);
    setEditingLayer(null);
  };

  const addTechnique = async () => {
    const v = techDraft.trim();
    if (!v || !subject.id) return;
    if (techniques.some((tech) => tech.name.toLowerCase() === v.toLowerCase())) return;
    await subjectsService.addTechnique(subject.id, v);
    setTechDraft("");
  };

  const saveTechnique = async (id: number, newName: string) => {
    await subjectsService.renameTechnique(id, newName);
    setEditingTechId(null);
  };

  const dotColor = subjectColorCss(subject.color, subject.type, subject.customColor);

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 overflow-hidden">
      {/* Header row — always visible, large tap target */}
      <div className="flex items-stretch">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 p-3.5 text-left hover:bg-accent/40 active:bg-accent/60 transition-colors min-w-0"
          aria-expanded={open}
        >
          <span
            className="h-4 w-4 rounded-full shrink-0 ring-1 ring-border/40"
            style={{ backgroundColor: dotColor }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-serif text-base truncate leading-tight">{subject.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{layerCount}</span>
              <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" />{techniques.length}</span>
            </div>
          </div>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="border-t border-border/40 divide-y divide-border/40">
          {/* Name */}
          <div className="p-3 space-y-2">
            <SectionHeader icon={<Pencil className="h-3 w-3" />} label={t("subjects.editSubjectName")} />
            {editingName ? (
              <InlineEdit
                value={subject.name}
                onSave={saveName}
                onCancel={() => setEditingName(false)}
                size="md"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="w-full flex items-center gap-2 px-3 h-10 rounded-md bg-background/60 border border-border/40 hover:bg-accent/40 text-left"
              >
                <span className="font-serif text-base flex-1 min-w-0 truncate">{subject.name}</span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            )}
          </div>

          {/* Layers */}
          <div className="p-3 space-y-2.5">
            <SectionHeader
              icon={<Layers className="h-3 w-3" />}
              label={t("subjects.layers")}
              count={layerCount}
            />
            {subject.type === "theory" ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {THEORY_LAYERS.map((l) => (
                    <Chip key={l} label={t(`library.mastery.${l}`)} />
                  ))}
                </div>
                <p className="text-[11px] italic text-muted-foreground">{t("subjects.theoryLayersFixed")}</p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(subject.layers ?? []).map((l) => (
                    editingLayer === l ? (
                      <div key={l} className="w-full">
                        <InlineEdit
                          value={l}
                          onSave={(v) => saveLayer(l, v)}
                          onCancel={() => setEditingLayer(null)}
                        />
                      </div>
                    ) : (
                      <Chip
                        key={l}
                        label={l}
                        onEdit={() => setEditingLayer(l)}
                        onRemove={() => removeLayer(l)}
                      />
                    )
                  ))}
                  {!(subject.layers ?? []).length && (
                    <span className="text-[11px] italic text-muted-foreground">{t("subjects.layersHint")}</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={layerDraft}
                    onChange={(e) => setLayerDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLayer())}
                    placeholder={t("subjects.addLayer")}
                    className="h-10 text-sm"
                  />
                  <Button size="icon" variant="outline" onClick={addLayer} className="h-10 w-10 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Techniques */}
          <div className="p-3 space-y-2.5">
            <SectionHeader
              icon={<Wrench className="h-3 w-3" />}
              label={t("subjects.techniques")}
              count={techniques.length}
            />
            <div className="flex flex-wrap gap-1.5">
              {techniques.map((tech) => (
                editingTechId === tech.id ? (
                  <div key={tech.id} className="w-full">
                    <InlineEdit
                      value={tech.name}
                      onSave={(v) => tech.id != null && saveTechnique(tech.id, v)}
                      onCancel={() => setEditingTechId(null)}
                    />
                  </div>
                ) : (
                  <Chip
                    key={tech.id}
                    label={tech.name}
                    onEdit={() => tech.id != null && setEditingTechId(tech.id)}
                    onRemove={() => tech.id && subjectsService.removeTechnique(tech.id)}
                  />
                )
              ))}
              {!techniques.length && (
                <span className="text-[11px] italic text-muted-foreground">{t("subjects.techniquesHint")}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={techDraft}
                onChange={(e) => setTechDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTechnique())}
                placeholder={t("subjects.addTechnique")}
                className="h-10 text-sm"
              />
              <Button size="icon" variant="outline" onClick={addTechnique} className="h-10 w-10 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Color */}
          <div className="p-3 space-y-2.5">
            <SectionHeader icon={<span className="h-3 w-3 rounded-full" style={{ backgroundColor: dotColor }} />} label={t("subjects.colorLabel")} />
            <div className="grid grid-cols-6 gap-2.5">
              {COLOR_KEYS.map((ck) => {
                const selected = !subject.customColor && getSubjectColor(subject.color, subject.type) === ck;
                return (
                  <button
                    key={ck}
                    onClick={() => subject.id && subjectsService.setColor(subject.id, ck as ColorKey)}
                    className={cn(
                      "aspect-square w-full rounded-full transition-all flex items-center justify-center",
                      selected ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : "active:scale-95"
                    )}
                    style={{ backgroundColor: `hsl(var(--key-${ck}))` }}
                    aria-label={ck}
                    aria-pressed={selected}
                  >
                    {selected && <Check className="h-4 w-4 text-background mix-blend-difference" />}
                  </button>
                );
              })}
              <label
                className={cn(
                  "relative aspect-square w-full rounded-full cursor-pointer transition-all overflow-hidden border border-border/60",
                  subject.customColor ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : "active:scale-95"
                )}
                style={
                  subject.customColor
                    ? { backgroundColor: subject.customColor }
                    : { background: "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)" }
                }
                aria-label={t("subjects.customColor")}
                title={t("subjects.customColor")}
              >
                <input
                  type="color"
                  value={subject.customColor ?? "#a0522d"}
                  onChange={(e) => subject.id && subjectsService.setCustomColor(subject.id, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label={t("subjects.customColor")}
                />
              </label>
            </div>
            {subject.customColor && (
              <button
                onClick={() => subject.id && subjectsService.setCustomColor(subject.id, undefined)}
                className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {t("common.reset")}
              </button>
            )}
          </div>

          {/* Delete */}
          <div className="p-3">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="w-full h-11 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />{t("subjects.deleteSubject")}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteSubject", { name: subject.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.deleteSubjectDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, THEORY_LAYERS, type Subject, type SubjectType, type ColorKey } from "@/lib/db"; // db used for useLiveQuery reads only
import { subjectsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { COLOR_KEYS, getSubjectColor, subjectColorCss } from "@/lib/subjectColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, X, Trash2, Piano, BookOpen, ChevronDown, Layers, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SubjectsEditor() {
  const { t } = useI18n();
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const techniques = useLiveQuery(() => db.techniques.toArray(), []);

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
    <div className="paper-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
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
          <p className="text-xs italic text-muted-foreground py-1">—</p>
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
            className="h-9"
          />
          <Button size="sm" onClick={submit}>{t("common.add")}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />{addLabel}
        </Button>
      )}
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

  const layerCount = subject.type === "theory" ? THEORY_LAYERS.length : (subject.layers ?? []).length;

  const doDelete = async () => {
    if (!subject.id) return;
    await subjectsService.remove(subject.id);
    toast.success(t("toast.subjectDeleted"));
    setConfirmDelete(false);
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

  const addTechnique = async () => {
    const v = techDraft.trim();
    if (!v || !subject.id) return;
    if (techniques.some((tech) => tech.name.toLowerCase() === v.toLowerCase())) return;
    await subjectsService.addTechnique(subject.id, v);
    setTechDraft("");
  };

  return (
    <div className="rounded-md border border-border/60 bg-background/40 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-accent/40 active:bg-accent/60 transition-colors"
      >
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: subjectColorCss(subject.color, subject.type, subject.customColor) }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base truncate">{subject.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{layerCount}</span>
            <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" />{techniques.length}</span>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="p-3 pt-1 space-y-4 border-t border-border/40">
          {/* Layers */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-3 w-3" />
              <span className="text-[10px] uppercase tracking-widest">{t("subjects.layers")}</span>
            </div>
            {subject.type === "theory" ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {THEORY_LAYERS.map((l) => (
                    <span key={l} className="bg-accent/70 px-2.5 py-1 rounded-full text-xs">
                      {t(`library.mastery.${l}`)}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] italic text-muted-foreground">{t("subjects.theoryLayersFixed")}</p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(subject.layers ?? []).map((l) => (
                    <span key={l} className="inline-flex items-center gap-1 bg-accent/70 px-2.5 py-1 rounded-full text-xs">
                      {l}
                      <button
                        onClick={() => removeLayer(l)}
                        aria-label={t("subjects.removeLayer", { name: l })}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
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
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="ghost" onClick={addLayer} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Techniques */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wrench className="h-3 w-3" />
              <span className="text-[10px] uppercase tracking-widest">{t("subjects.techniques")}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {techniques.map((tech) => (
                <span key={tech.id} className="inline-flex items-center gap-1 bg-accent/70 px-2.5 py-1 rounded-full text-xs">
                  {tech.name}
                  <button
                    onClick={() => tech.id && subjectsService.removeTechnique(tech.id)}
                    aria-label={t("subjects.removeTechnique", { name: tech.name })}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
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
                className="h-8 text-sm"
              />
              <Button size="sm" variant="ghost" onClick={addTechnique} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("subjects.colorLabel")}
            </span>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_KEYS.map((ck) => (
                <button
                  key={ck}
                  onClick={() => subject.id && db.subjects.update(subject.id, { color: ck as ColorKey, customColor: undefined })}
                  className={cn(
                    "h-6 w-6 rounded-full transition-all",
                    !subject.customColor && getSubjectColor(subject.color, subject.type) === ck
                      ? "ring-2 ring-offset-2 ring-foreground scale-110"
                      : "hover:scale-110"
                  )}
                  style={{ backgroundColor: `hsl(var(--key-${ck}))` }}
                  aria-label={ck}
                />
              ))}
              <label
                className={cn(
                  "relative h-6 w-6 rounded-full cursor-pointer transition-all overflow-hidden border border-border/60",
                  subject.customColor ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-110"
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
                  onChange={(e) => subject.id && db.subjects.update(subject.id, { customColor: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label={t("subjects.customColor")}
                />
              </label>
              {subject.customColor && (
                <button
                  onClick={() => subject.id && db.subjects.update(subject.id, { customColor: undefined })}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {t("common.reset")}
                </button>
              )}
            </div>
          </div>


          <div className="pt-1 border-t border-border/40 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />{t("subjects.deleteSubject")}
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

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, THEORY_LAYERS, type Subject, type SubjectType } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SUBJECT_TYPE_VALS: SubjectType[] = ["instrument", "theory", "composition", "other"];

export function SubjectsEditor() {
  const { t } = useI18n();
  const subjects = useLiveQuery(() => db.subjects.toArray(), []);
  const techniques = useLiveQuery(() => db.techniques.toArray(), []);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<SubjectType>("instrument");
  const [layerDraft, setLayerDraft] = useState<Record<number, string>>({});
  const [techDraft, setTechDraft] = useState<Record<number, string>>({});

  const addSubject = async () => {
    const name = newName.trim();
    if (!name) return;
    if (subjects?.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t("errors.subjectExists")); return;
    }
    await db.subjects.add({ name, type: newType, layers: [], createdAt: Date.now() });
    setNewName("");
  };

  const removeSubject = async (s: Subject) => {
    if (!s.id) return;
    if (!confirm(t("subjects.confirmDelete", { name: s.name }))) return;
    await db.transaction("rw", db.subjects, db.techniques, async () => {
      await db.techniques.where("subjectId").equals(s.id!).delete();
      await db.subjects.delete(s.id!);
    });
    toast.success(t("toast.subjectDeleted"));
  };

  const addLayer = async (s: Subject) => {
    if (!s.id) return;
    const v = (layerDraft[s.id] ?? "").trim();
    if (!v) return;
    const cur = s.layers ?? [];
    if (cur.includes(v)) return;
    await db.subjects.update(s.id, { layers: [...cur, v] });
    setLayerDraft((d) => ({ ...d, [s.id!]: "" }));
  };

  const removeLayer = async (s: Subject, layer: string) => {
    if (!s.id) return;
    await db.subjects.update(s.id, { layers: (s.layers ?? []).filter((l) => l !== layer) });
  };

  const addTechnique = async (s: Subject) => {
    if (!s.id) return;
    const v = (techDraft[s.id] ?? "").trim();
    if (!v) return;
    const exists = (techniques ?? []).some(
      (tech) => tech.subjectId === s.id && tech.name.toLowerCase() === v.toLowerCase()
    );
    if (exists) return;
    await db.techniques.add({ subjectId: s.id, name: v, createdAt: Date.now() });
    setTechDraft((d) => ({ ...d, [s.id!]: "" }));
  };

  const removeTechnique = async (id: number) => {
    await db.techniques.delete(id);
  };

  return (
    <section className="paper-card p-5 space-y-4">
      <h3 className="font-serif text-xl">{t("subjects.title")}</h3>
      <p className="text-xs text-muted-foreground italic -mt-2">
        {t("subjects.desc")}
      </p>

      <div className="paper-card p-3 flex flex-wrap gap-2 items-center">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubject()}
          placeholder={t("subjects.new")}
          className="border-0 bg-transparent focus-visible:ring-0 flex-1 min-w-[160px]"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as SubjectType)}
          className="bg-background border border-border rounded-md px-2 py-1.5 text-sm"
        >
          {SUBJECT_TYPE_VALS.map((val) => <option key={val} value={val}>{t(`subjects.type.${val}`)}</option>)}
        </select>
        <Button size="icon" variant="ghost" onClick={addSubject}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {(subjects ?? []).map((s) => {
          const subjTechs = (techniques ?? []).filter((t) => t.subjectId === s.id);
          const layerCount = (s.layers ?? []).length;
          return (
            <AccordionItem key={s.id} value={`subj-${s.id}`} className="paper-card border-0 px-3">
              <div className="flex items-center justify-between gap-2">
                <AccordionTrigger className="flex-1 hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-left">
                    <span className="font-serif text-lg">{s.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(`subjects.type.${s.type}`)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      · {layerCount}L · {subjTechs.length}T
                    </span>
                  </div>
                </AccordionTrigger>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSubject(s); }}
                  className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-accent shrink-0"
                  aria-label={t("subjects.deleteSubject")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <AccordionContent className="space-y-3 pb-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("subjects.layers")}</Label>
                  {s.type === "theory" ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {THEORY_LAYERS.map((l) => (
                          <span key={l} className="inline-flex items-center gap-1 bg-accent px-2.5 py-1 rounded-full text-xs">
                            {t(`library.mastery.${l}`)}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs italic text-muted-foreground">{t("subjects.theoryLayersFixed")}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {(s.layers ?? []).map((l) => (
                          <span key={l} className="inline-flex items-center gap-1 bg-accent px-2.5 py-1 rounded-full text-xs">
                            {l}
                            <button onClick={() => removeLayer(s, l)} aria-label={t("subjects.removeLayer", { name: l })}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {!(s.layers ?? []).length && (
                          <span className="text-xs italic text-muted-foreground">{t("subjects.layersHint")}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          value={layerDraft[s.id!] ?? ""}
                          onChange={(e) => setLayerDraft((d) => ({ ...d, [s.id!]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLayer(s))}
                          placeholder={t("subjects.addLayer")}
                          className="h-8 text-sm"
                        />
                        <Button size="sm" variant="ghost" onClick={() => addLayer(s)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("subjects.techniques")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {subjTechs.map((tech) => (
                      <span key={tech.id} className="inline-flex items-center gap-1 bg-accent px-2.5 py-1 rounded-full text-xs">
                        {tech.name}
                        <button onClick={() => tech.id && removeTechnique(tech.id)} aria-label={t("subjects.removeTechnique", { name: tech.name })}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {!subjTechs.length && (
                      <span className="text-xs italic text-muted-foreground">{t("subjects.techniquesHint")}</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      value={techDraft[s.id!] ?? ""}
                      onChange={(e) => setTechDraft((d) => ({ ...d, [s.id!]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTechnique(s))}
                      placeholder={t("subjects.addTechnique")}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="ghost" onClick={() => addTechnique(s)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}

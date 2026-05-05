import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Subject, type SubjectType } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SUBJECT_TYPES: { val: SubjectType; label: string }[] = [
  { val: "instrument", label: "Instrument" },
  { val: "theory", label: "Theory" },
  { val: "composition", label: "Composition" },
  { val: "other", label: "Other" },
];

export function SubjectsEditor() {
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
      toast.error("Subject already exists"); return;
    }
    await db.subjects.add({ name, type: newType, layers: [], createdAt: Date.now() });
    setNewName("");
  };

  const removeSubject = async (s: Subject) => {
    if (!s.id) return;
    if (!confirm(`Delete subject "${s.name}"? This will also remove its techniques.`)) return;
    await db.transaction("rw", db.subjects, db.techniques, async () => {
      await db.techniques.where("subjectId").equals(s.id!).delete();
      await db.subjects.delete(s.id!);
    });
    toast.success("Subject deleted");
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
      (t) => t.subjectId === s.id && t.name.toLowerCase() === v.toLowerCase()
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
      <h3 className="font-serif text-xl">Subjects, layers & techniques</h3>
      <p className="text-xs text-muted-foreground italic -mt-2">
        Layers and techniques you define here become the only options usable elsewhere.
      </p>

      <div className="paper-card p-3 flex flex-wrap gap-2 items-center">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubject()}
          placeholder="New subject (e.g. Piano)"
          className="border-0 bg-transparent focus-visible:ring-0 flex-1 min-w-[160px]"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as SubjectType)}
          className="bg-background border border-border rounded-md px-2 py-1.5 text-sm"
        >
          {SUBJECT_TYPES.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
        </select>
        <Button size="icon" variant="ghost" onClick={addSubject}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {(subjects ?? []).map((s) => {
          const subjTechs = (techniques ?? []).filter((t) => t.subjectId === s.id);
          return (
            <div key={s.id} className="paper-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-serif text-lg">{s.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.type}</div>
                </div>
                <button
                  onClick={() => removeSubject(s)}
                  className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-accent"
                  aria-label="Delete subject"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Layers</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(s.layers ?? []).map((l) => (
                    <span key={l} className="inline-flex items-center gap-1 bg-accent px-2.5 py-1 rounded-full text-xs">
                      {l}
                      <button onClick={() => removeLayer(s, l)} aria-label={`Remove ${l}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {!(s.layers ?? []).length && (
                    <span className="text-xs italic text-muted-foreground">e.g. RH, LH, Both…</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={layerDraft[s.id!] ?? ""}
                    onChange={(e) => setLayerDraft((d) => ({ ...d, [s.id!]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLayer(s))}
                    placeholder="Add layer…"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="ghost" onClick={() => addLayer(s)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Techniques</Label>
                <div className="flex flex-wrap gap-1.5">
                  {subjTechs.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1 bg-accent px-2.5 py-1 rounded-full text-xs">
                      {t.name}
                      <button onClick={() => t.id && removeTechnique(t.id)} aria-label={`Remove ${t.name}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {!subjTechs.length && (
                    <span className="text-xs italic text-muted-foreground">e.g. legato, tremolo, with pedal…</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={techDraft[s.id!] ?? ""}
                    onChange={(e) => setTechDraft((d) => ({ ...d, [s.id!]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTechnique(s))}
                    placeholder="Add technique…"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="ghost" onClick={() => addTechnique(s)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

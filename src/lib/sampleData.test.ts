import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { seedSampleData } from "./sampleData";
import { seedGuitarSampleData } from "./sampleDataGuitar";
import { backupService } from "./services/backup";
import { isPerformable } from "@/domain/logic/repertoireReview";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import type { Session } from "@/domain/entities/session";

describe("study sample data", () => {
  it("seeds the requested guitar technique sections and harmony topics", async () => {
    await seedGuitarSampleData();
    const guitar = await db.subjects.where("name").equals("Chitarra").first();
    const items = await db.library.where("subjectId").equals(guitar!.id!).toArray();
    for (const [title, labels, techniques] of [
      ["Legati ascendenti", ["1-2", "1-3", "1-4", "2-3", "2-4", "3-4", "1-3-4", "1-2-4", "1-2+2-3+3-4"], ["Legato ascendente"]],
      ["Legati discendenti", ["2-1", "3-1", "4-1", "3-2", "4-2", "4-3", "4-3-1", "4-2-1", "4-3+3-2+2-1"], ["Legato discendente"]],
      ["Legati combinati", ["1-2-1", "1-3-1", "1-4-1", "2-3-2", "2-4-2", "3-4-3", "1-3-4-3", "1-2-4-2", "1-2-4-3", "1-4-2-3", "1-4-3-4", "1-4-2-4", "1-3-4-2", "1-4-3-2"], ["Legato ascendente", "Legato discendente"]],
      ["Legati cromatici", ["1-2-3-4", "4-3-2-1"], ["Legato ascendente", "Legato discendente"]],
      ["Tremolo", ["p-m-a-i", "p-i-m-a", "p-m-i", "p-i-m"], ["Tremolo"]],
    ] as const) {
      const matches = items.filter(item => item.title === title);
      expect(matches).toHaveLength(1);
      const item = matches[0];
      expect(item.kind).toBe("technique");
      const assignedTechniques = await db.techniques.bulkGet(item.techniqueIds!);
      expect(assignedTechniques.map(technique => technique!.name)).toEqual(techniques);
      const sections = await db.segments.where("itemId").equals(item.id!).sortBy("position");
      expect(sections.map(section => section.label)).toEqual(labels);
      expect(sections.map(section => section.position)).toEqual(labels.map((_, index) => index));
      for (const section of sections) {
        expect(section.techniqueIds).toBeUndefined();
        expect(section.targetBpm).toBeUndefined();
        expect(section.noteVal).toBeUndefined();
        expect(section.layers).toEqual([]);
      }
    }
    const harmony = await db.subjects.where("name").equals("Armonia").first();
    const topics = await db.library.where("subjectId").equals(harmony!.id!).filter(item => item.kind === "theory").toArray();
    expect(topics.map(item => item.title)).toEqual([
      "Triadi e rivolti", "Regole di condotta delle parti", "Funzioni armoniche", "Rivolti delle triadi",
      "Triade aumentata e diminuita", "Cadenze", "Accordi di settima", "Accordi di nona",
      "Armonizzazione secondo la regola dell'ottava", "Note di passaggio", "Cromatismi", "Dominanti secondarie",
      "Modulazione", "Tecniche di modulazione ai toni vicini", "Ritardi", "Pedale",
      "Progressioni tonali", "Progressioni modulanti", "Progressioni imitate",
    ]);
    expect(topics.every(item => item.targetBpm === undefined)).toBe(true);
  });

  it("seeds guitar studies, scales with inherited properties, and the requested pieces", async () => {
    await seedGuitarSampleData();
    const guitar = await db.subjects.where("name").equals("Chitarra").first();
    const items = await db.library.where("subjectId").equals(guitar!.id!).toArray();
    const arpeggios = items.find(item => item.title === "Arpeggi op. 1 Giuliani")!;
    expect(arpeggios).toMatchObject({ kind: "study", composer: "M. Giuliani", catalog: "Op.1 prima parte", targetBpm: 60, noteVal: "quarter" });
    const sections = await db.segments.where("itemId").equals(arpeggios.id!).sortBy("position");
    expect(sections.map(section => section.label)).toEqual(Array.from({ length: 120 }, (_, i) => `Arpeggio ${i + 1}`));
    const notes = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"];
    for (const [title, suffix] of [["Scale maggiori", "maggiore"], ["Scale minori armoniche", "minore arm."], ["Scale minori melodiche", "minore mel."]]) {
      const scale = items.find(item => item.title === title)!;
      expect(scale).toMatchObject({ kind: "technique", targetBpm: 100, noteVal: "quarter" });
      const scaleSections = await db.segments.where("itemId").equals(scale.id!).sortBy("position");
      expect(scaleSections.map(section => section.label)).toEqual(notes.map(note => `${note} ${suffix}`));
      sections.push(...scaleSections);
    }
    for (const section of sections) {
      expect(section.targetBpm).toBeUndefined();
      expect(section.noteVal).toBeUndefined();
      expect(section.techniqueIds).toBeUndefined();
      expect(section.layers).toEqual([]);
    }
    expect(items.filter(item => item.kind === "piece").map(item => [item.title, item.composer])).toEqual([
      ["Lágrima", "Francisco Tárrega"],
      ["Endecha", "Francisco Tárrega"],
      ["Oremus", "Francisco Tárrega"],
      ["Preludio n. 8 in Fa diesis minore", "Manuel M. Ponce"],
      ["La Melanconia", "M. Giuliani"],
    ]);
  });

  it.each([["complete", seedSampleData], ["guitar", seedGuitarSampleData]] as const)("seeds %s with five types and a mixed manual using valid backup data", async (name, seed) => {
    await seed();
    const items = await db.library.toArray();
    expect(new Set(items.map(item => item.kind))).toEqual(new Set(["piece", "study", "technique", "exercise", "theory"]));
    const manuals = await db.collections.where("kind").equals("manual").toArray();
    const links = await db.collectionItems.toArray();
    expect(manuals.some(manual => new Set(links.filter(link => link.collectionId === manual.id).map(link => items.find(item => item.id === link.itemId)!.kind)).size > 1)).toBe(true);
    const segments = await db.segments.toArray();
    expect(segments.some(s => s.barStart !== undefined && s.targetBpm === undefined && items.find(i => i.id === s.itemId)?.targetBpm !== undefined)).toBe(true);
    expect(segments.some(s => s.barStart !== undefined && s.targetBpm !== undefined)).toBe(true);
    expect(items.some(i => i.kind === "exercise" && i.targetBpm === undefined)).toBe(true);
    expect(items.some(i => i.kind === "theory" && i.targetBpm === undefined)).toBe(true);
    if (name === "complete") {
      const study = items.find(i => i.kind === "study" && i.inRepertoire)!;
      expect(study).toBeDefined();
      expect(await db.performanceItems.where("itemId").equals(study.id!).count()).toBeGreaterThan(0);
      expect(links.filter(link => link.itemId === study.id).length).toBeGreaterThan(1);
      const history = await dexiePresentationReads.read<Session[]>("sessions.segmentHistory", [study.id]);
      expect(history.length).toBeGreaterThan(0);
      expect(new Set(history.map(s => s.id)).size).toBe(history.length);
      expect(history).toEqual(await db.sessions.where("itemId").equals(study.id!).toArray());
    } else {
      expect(await db.tasks.count()).toBe(0);
      expect(await db.sessions.count()).toBe(0);
      expect(await db.lessons.count()).toBe(0);
    }
    for (const link of await db.performanceItems.toArray()) expect(isPerformable(items.find(i => i.id === link.itemId)!.kind)).toBe(true);
    const backup = await backupService.exportAll();
    expect(JSON.parse(backup).version).toBe(6);
    await backupService.importAll(backup);
    expect(await db.library.toArray()).toEqual(items);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { subjectsService } from "@/lib/services/subjects";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("subjectsService.create", () => {
  it("inserts a subject with empty layers and returns its id", async () => {
    const id = await subjectsService.create("Piano", "instrument");
    const subject = await db.subjects.get(id);
    expect(subject).toBeDefined();
    expect(subject!.name).toBe("Piano");
    expect(subject!.type).toBe("instrument");
    expect(subject!.layers).toEqual([]);
    expect(subject!.createdAt).toBeGreaterThan(0);
  });

  it("allows creating theory subjects", async () => {
    const id = await subjectsService.create("Harmony", "theory");
    const subject = await db.subjects.get(id);
    expect(subject!.type).toBe("theory");
  });

  it("returns distinct ids for different subjects", async () => {
    const id1 = await subjectsService.create("Piano", "instrument");
    const id2 = await subjectsService.create("Guitar", "instrument");
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("subjectsService.remove", () => {
  it("deletes the subject and all its techniques atomically", async () => {
    const subjectId = await subjectsService.create("Violin", "instrument");
    await subjectsService.addTechnique(subjectId, "Spiccato");
    await subjectsService.addTechnique(subjectId, "Legato");

    expect(await db.techniques.where("subjectId").equals(subjectId).count()).toBe(2);

    await subjectsService.remove(subjectId);

    expect(await db.subjects.get(subjectId)).toBeUndefined();
    expect(await db.techniques.where("subjectId").equals(subjectId).count()).toBe(0);
  });

  it("does not delete techniques from other subjects", async () => {
    const id1 = await subjectsService.create("Piano", "instrument");
    const id2 = await subjectsService.create("Guitar", "instrument");
    await subjectsService.addTechnique(id2, "Fingerpicking");

    await subjectsService.remove(id1);

    expect(await db.techniques.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// addLayer / removeLayer
// ---------------------------------------------------------------------------

describe("subjectsService.addLayer", () => {
  it("appends a layer to an empty subject", async () => {
    const id = await subjectsService.create("Piano", "instrument");
    await subjectsService.addLayer(id, "slow");

    const subject = await db.subjects.get(id);
    expect(subject!.layers).toEqual(["slow"]);
  });

  it("appends multiple distinct layers in order", async () => {
    const id = await subjectsService.create("Piano", "instrument");
    await subjectsService.addLayer(id, "slow");
    await subjectsService.addLayer(id, "hands-separate");

    const subject = await db.subjects.get(id);
    expect(subject!.layers).toEqual(["slow", "hands-separate"]);
  });

  it("is a no-op when the layer already exists", async () => {
    const id = await subjectsService.create("Piano", "instrument");
    await subjectsService.addLayer(id, "slow");
    await subjectsService.addLayer(id, "slow");

    const subject = await db.subjects.get(id);
    expect(subject!.layers).toHaveLength(1);
  });
});

describe("subjectsService.removeLayer", () => {
  it("removes the specified layer", async () => {
    const id = await subjectsService.create("Piano", "instrument");
    await subjectsService.addLayer(id, "slow");
    await subjectsService.addLayer(id, "fast");
    await subjectsService.removeLayer(id, "slow");

    const subject = await db.subjects.get(id);
    expect(subject!.layers).toEqual(["fast"]);
  });

  it("is a no-op when the layer does not exist", async () => {
    const id = await subjectsService.create("Piano", "instrument");
    await subjectsService.addLayer(id, "slow");
    await subjectsService.removeLayer(id, "nonexistent");

    const subject = await db.subjects.get(id);
    expect(subject!.layers).toEqual(["slow"]);
  });
});

// ---------------------------------------------------------------------------
// addTechnique / removeTechnique
// ---------------------------------------------------------------------------

describe("subjectsService.addTechnique", () => {
  it("creates a technique linked to the subject", async () => {
    const subjectId = await subjectsService.create("Piano", "instrument");
    const techId = await subjectsService.addTechnique(subjectId, "Staccato");

    const tech = await db.techniques.get(techId);
    expect(tech).toBeDefined();
    expect(tech!.name).toBe("Staccato");
    expect(tech!.subjectId).toBe(subjectId);
    expect(tech!.createdAt).toBeGreaterThan(0);
  });
});

describe("subjectsService.removeTechnique", () => {
  it("hard-deletes the technique by id", async () => {
    const subjectId = await subjectsService.create("Piano", "instrument");
    const techId = await subjectsService.addTechnique(subjectId, "Staccato");

    await subjectsService.removeTechnique(techId);
    expect(await db.techniques.get(techId)).toBeUndefined();
  });

  it("does not affect other techniques", async () => {
    const subjectId = await subjectsService.create("Piano", "instrument");
    const id1 = await subjectsService.addTechnique(subjectId, "Staccato");
    const id2 = await subjectsService.addTechnique(subjectId, "Legato");

    await subjectsService.removeTechnique(id1);
    expect(await db.techniques.get(id2)).toBeDefined();
  });
});

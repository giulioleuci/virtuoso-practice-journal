import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { helpRequestsService } from "@/lib/services/helpRequests";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

describe("helpRequestsService.add", () => {
  it("creates an unresolved help request for the given item", async () => {
    const id = await helpRequestsService.add(42, "How do I play this passage?");

    const req = await db.helpRequests.get(id);
    expect(req).toBeDefined();
    expect(req!.itemId).toBe(42);
    expect(req!.question).toBe("How do I play this passage?");
    expect(req!.resolved).toBe(false);
    expect(req!.createdAt).toBeGreaterThan(0);
  });

  it("returns distinct ids for multiple questions", async () => {
    const id1 = await helpRequestsService.add(1, "Question 1");
    const id2 = await helpRequestsService.add(1, "Question 2");
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// answer
// ---------------------------------------------------------------------------

describe("helpRequestsService.answer", () => {
  it("marks the request resolved and stores the answer with a timestamp", async () => {
    const before = Date.now();
    const id = await helpRequestsService.add(1, "What fingering?");
    await helpRequestsService.answer(id, "Use 1-2-3.");

    const req = await db.helpRequests.get(id);
    expect(req!.answer).toBe("Use 1-2-3.");
    expect(req!.resolved).toBe(true);
    expect(req!.answeredAt).toBeGreaterThanOrEqual(before);
  });

  it("does not affect other requests", async () => {
    const id1 = await helpRequestsService.add(1, "Q1");
    const id2 = await helpRequestsService.add(1, "Q2");
    await helpRequestsService.answer(id1, "Answer");

    const req2 = await db.helpRequests.get(id2);
    expect(req2!.resolved).toBe(false);
    expect(req2!.answer).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("helpRequestsService.remove", () => {
  it("hard-deletes the request", async () => {
    const id = await helpRequestsService.add(1, "Delete me");
    await helpRequestsService.remove(id);
    expect(await db.helpRequests.get(id)).toBeUndefined();
  });

  it("does not remove other requests", async () => {
    const id1 = await helpRequestsService.add(1, "Keep");
    const id2 = await helpRequestsService.add(1, "Remove");
    await helpRequestsService.remove(id2);
    expect(await db.helpRequests.get(id1)).toBeDefined();
  });
});

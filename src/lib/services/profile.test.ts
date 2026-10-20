import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { profileService } from "@/lib/services/profile";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

describe("profileService.initialize", () => {
  it("creates the profile row and all subject rows in a transaction", async () => {
    await profileService.initialize({
      subjects: [
        { name: "Piano", type: "instrument" },
        { name: "Harmony", type: "theory" },
      ],
      name: "Alice",
      lang: "en",
      reminderTime: "18:00",
      reminderFreq: "daily",
      reminderDays: [0, 1, 2, 3, 4, 5, 6],
      reminderEnabled: true,
      lateRecoveryDays: 3,
      graceDay: true,
      groupByPhase: false,
      onboarded: true,
    });

    const profile = await db.profile.get("me");
    expect(profile).toBeDefined();
    expect(profile!.name).toBe("Alice");
    expect(profile!.onboarded).toBe(true);
    expect(profile!.id).toBe("me");

    const subjects = await db.subjects.toArray();
    expect(subjects).toHaveLength(2);
    expect(subjects.map((s) => s.name).sort()).toEqual(["Harmony", "Piano"]);
    expect(subjects[0].createdAt).toBeGreaterThan(0);
  });

  it("stores zero subjects when none are provided", async () => {
    await profileService.initialize({
      subjects: [],
      name: "Bob",
      lang: "it",
      reminderTime: "08:00",
      reminderFreq: "weekdays",
      reminderDays: [1, 2, 3, 4, 5],
      reminderEnabled: false,
      lateRecoveryDays: 1,
      graceDay: false,
      groupByPhase: false,
      onboarded: true,
    });

    expect(await db.subjects.count()).toBe(0);
    const profile = await db.profile.get("me");
    expect(profile!.lang).toBe("it");
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe("profileService.get", () => {
  it("returns undefined when no profile exists", async () => {
    expect(await profileService.get()).toBeUndefined();
  });

  it("returns the profile row after initialize", async () => {
    await profileService.initialize({
      subjects: [],
      name: "Charlie",
      lang: "de",
      reminderTime: "09:00",
      reminderFreq: "daily",
      reminderDays: [0, 1, 2, 3, 4, 5, 6],
      reminderEnabled: true,
      lateRecoveryDays: 2,
      graceDay: true,
      groupByPhase: true,
      onboarded: true,
    });

    const profile = await profileService.get();
    expect(profile).toBeDefined();
    expect(profile!.name).toBe("Charlie");
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("profileService.update", () => {
  beforeEach(async () => {
    await profileService.initialize({
      subjects: [],
      name: "Diana",
      lang: "en",
      reminderTime: "20:00",
      reminderFreq: "daily",
      reminderDays: [0, 1, 2, 3, 4, 5, 6],
      reminderEnabled: true,
      lateRecoveryDays: 3,
      graceDay: true,
      groupByPhase: false,
      onboarded: true,
    });
  });

  it("patches specified fields without touching others", async () => {
    await profileService.update({ name: "Diana Updated", lateRecoveryDays: 7 });

    const profile = await db.profile.get("me");
    expect(profile!.name).toBe("Diana Updated");
    expect(profile!.lateRecoveryDays).toBe(7);
    expect(profile!.lang).toBe("en");
    expect(profile!.onboarded).toBe(true);
  });

  it("updates reminderEnabled flag", async () => {
    await profileService.update({ reminderEnabled: false });

    const profile = await db.profile.get("me");
    expect(profile!.reminderEnabled).toBe(false);
  });

  it("updates introSeen flag", async () => {
    await profileService.update({ introSeen: true });

    const profile = await db.profile.get("me");
    expect(profile!.introSeen).toBe(true);
  });
});

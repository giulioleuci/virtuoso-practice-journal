import { db } from "@/infrastructure/dexie/db";
import type { Profile } from "@/domain/entities/profile";
import type { OnboardingInput, ProfilePort } from "@/domain/ports/profile";
import { now } from "@/lib/date";
export type { OnboardingInput } from "@/domain/ports/profile";
export const profileRepository = {
  get: () => db.profile.get("me"),
  update: async (patch: Partial<Profile>) => { await db.profile.update("me", patch); },
  async initialize({ subjects, ...profile }: OnboardingInput) {
    const ts = now();
    const row: Profile = { ...profile, id: "me", createdAt: ts };
    await db.transaction("rw", db.subjects, db.profile, async () => {
      for (const subject of subjects) {
        await db.subjects.add({ ...subject, createdAt: ts });
      }
      await db.profile.put(row);
    });
    return row;
  },
} satisfies ProfilePort;

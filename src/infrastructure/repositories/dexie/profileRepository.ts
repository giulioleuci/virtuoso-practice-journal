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
    return db.transaction("rw", db.subjects, db.profile, async () => {
      // A second submit (double tap) finds the first one's profile and keeps it; transactions on these tables serialize.
      const existing = await db.profile.get("me");
      if (existing?.onboarded) return existing;
      for (const subject of subjects) {
        await db.subjects.add({ ...subject, createdAt: ts });
      }
      await db.profile.put(row);
      return row;
    });
  },
} satisfies ProfilePort;

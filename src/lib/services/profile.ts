/** Profile service — wraps all writes to the profile and onboarding tables. */
import { db, type Profile, type Subject } from "@/lib/db";
import { now } from "./_shared";

export type OnboardingInput = Omit<Profile, "id" | "createdAt"> & {
  subjects: Array<Pick<Subject, "name" | "type">>;
};

export const profileService = {
  async get(): Promise<Profile | undefined> {
    return db.profile.get("me");
  },

  async update(patch: Partial<Profile>): Promise<void> {
    await db.profile.update("me", patch);
  },

  async initialize({ subjects, ...profileData }: OnboardingInput): Promise<void> {
    const ts = now();
    await db.transaction("rw", db.subjects, db.profile, async () => {
      await db.subjects.bulkAdd(subjects.map((s) => ({ ...s, createdAt: ts })));
      await db.profile.put({ ...profileData, id: "me", createdAt: ts });
    });
  },
};

import { db } from "@/infrastructure/dexie/db";
import type { Profile } from "@/domain/entities/profile";
import type { Subject } from "@/domain/entities/common";
import { now } from "@/lib/date";
export type OnboardingInput = Omit<Profile, "id" | "createdAt"> & { subjects: Array<Pick<Subject, "name" | "type">> };
export const profileRepository = { get: () => db.profile.get("me"), update: async (patch: Partial<Profile>) => { await db.profile.update("me", patch); }, async initialize({ subjects, ...profile }: OnboardingInput) { const ts = now(); await db.transaction("rw", db.subjects, db.profile, async () => { await db.subjects.bulkAdd(subjects.map((subject) => ({ ...subject, createdAt: ts }))); await db.profile.put({ ...profile, id: "me", createdAt: ts }); }); } };

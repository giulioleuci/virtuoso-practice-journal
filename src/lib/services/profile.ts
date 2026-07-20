import { profileRepository } from "@/infrastructure/repositories/dexie/profileRepository";
export type { OnboardingInput } from "@/infrastructure/repositories/dexie/profileRepository";
export const profileService = profileRepository;

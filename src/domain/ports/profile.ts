import type { Profile } from "../entities/profile";
import type { Subject } from "../entities/common";

export type OnboardingInput = Omit<Profile, "id" | "createdAt"> & {
  subjects: Array<Pick<Subject, "name" | "type">>;
};

export interface ProfilePort {
  get(): Promise<Profile | undefined>;
  initialize(input: OnboardingInput): Promise<Profile>;
  update(patch: Partial<Profile>): Promise<void>;
}

import type { Profile } from "../entities/profile";

export interface ProfilePort {
  get(): Promise<Profile | undefined>;
  initialize(): Promise<Profile>;
  update(patch: Partial<Profile>): Promise<void>;
}

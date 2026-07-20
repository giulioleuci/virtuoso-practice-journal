import type { Profile } from "@/domain/entities/profile";
import type { ProfilePort } from "@/domain/ports/profile";
export type ProfileDto = Profile;
export interface ProfileQueries { current(): Promise<ProfileDto | undefined>; }
export const profileQueries = (profile: ProfilePort): ProfileQueries => ({ current: () => profile.get() });

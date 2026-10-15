import type { Recording } from "../entities/session";

export type AudioErrorCode = "denied" | "unavailable" | "unsupported" | "interrupted" | "quota";

export class AudioError extends Error {
  constructor(readonly code: AudioErrorCode) { super(`audio:${code}`); }
}

/** A clip whose audio is already stored on the device while its metadata waits for the session save. */
export type AudioDraft = Pick<Recording, "uid" | "mimeType" | "durationMs" | "segmentId" | "title">;

export interface AudioPort {
  /** Starts recording; rejects with AudioError "denied" | "unavailable" | "unsupported". `onInterrupt` fires when the input stops by itself. */
  start(onInterrupt: () => void): Promise<void>;
  /** Stops and stores the audio locally; rejects with AudioError "quota" when it could not be stored. */
  stop(): Promise<AudioDraft>;
  /** Playable URL, or null when this device holds no audio for `uid`. */
  url(uid: string): Promise<string | null>;
  release(url: string): void;
  available(uids: string[]): Promise<Set<string>>;
  discard(uids: string[]): Promise<void>;
  /** Explicit "delete all data" only. */
  wipe(): Promise<void>;
}

export interface RecordingPort {
  add(recording: Omit<Recording, "id">): Promise<number>;
  rename(id: number, title: string | undefined): Promise<void>;
  /** Removes metadata and local audio together. */
  remove(recording: Recording): Promise<void>;
}

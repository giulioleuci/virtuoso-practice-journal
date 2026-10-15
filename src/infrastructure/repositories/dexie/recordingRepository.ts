import { db } from "@/infrastructure/dexie/db";
import { browserAudio } from "@/infrastructure/audio/browserAudio";
import type { RecordingPort } from "@/domain/ports/audio";

export const recordingRepository = {
  add: (recording) => db.recordings.add(recording) as Promise<number>,
  rename: async (id, title) => { await db.recordings.update(id, { title }); },
  // Metadata first: a failed audio delete leaves preserved audio, never a row that promises missing audio.
  async remove(recording) {
    if (recording.id !== undefined) await db.recordings.delete(recording.id);
    await browserAudio.discard([recording.uid]);
  },
} satisfies RecordingPort;

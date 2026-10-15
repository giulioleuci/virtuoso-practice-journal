import { AudioError, type AudioDraft, type AudioPort } from "@/domain/ports/audio";
import { audioDb } from "@/infrastructure/dexie/audioDb";

const TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
let endedAt = 0;
let stopped: Promise<void> = Promise.resolve();

const failure = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : "";
  return new AudioError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "NotReadableError" || name === "OverconstrainedError" ? "unavailable" : "unsupported");
};

/** MediaRecorder + IndexedDB: no plugin, no backend; audio never leaves the device. */
export const browserAudio: AudioPort = {
  async start(onInterrupt) {
    const mimeType = typeof MediaRecorder === "undefined" ? undefined : TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    if (!navigator.mediaDevices?.getUserMedia || mimeType === undefined) throw new AudioError("unsupported");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (error) { throw failure(error); }
    void navigator.storage?.persist?.();
    const active = new MediaRecorder(stream, { mimeType });
    chunks = [];
    stopped = new Promise((resolve) => { active.onstop = () => { endedAt = Date.now(); resolve(); }; });
    active.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    active.onerror = onInterrupt;
    stream.getAudioTracks()[0]?.addEventListener("ended", onInterrupt, { once: true });
    recorder = active;
    startedAt = Date.now();
    active.start(1000);
  },
  async stop(): Promise<AudioDraft> {
    const active = recorder;
    if (!active) throw new AudioError("unavailable");
    if (active.state !== "inactive") active.stop();
    await stopped;
    active.stream.getTracks().forEach((track) => track.stop());
    recorder = null;
    const data = await new Blob(chunks, { type: active.mimeType }).arrayBuffer();
    chunks = [];
    if (!data.byteLength) throw new AudioError("interrupted");
    const draft: AudioDraft = { uid: crypto.randomUUID(), mimeType: active.mimeType, durationMs: endedAt - startedAt };
    try { await audioDb.clips.put({ uid: draft.uid, data, mimeType: draft.mimeType }); } catch { throw new AudioError("quota"); }
    return draft;
  },
  async url(uid) {
    const row = await audioDb.clips.get(uid);
    return row ? URL.createObjectURL(new Blob([row.data], { type: row.mimeType })) : null;
  },
  release: (url) => URL.revokeObjectURL(url),
  async available(uids) { return new Set(uids.length ? await audioDb.clips.where("uid").anyOf(uids).primaryKeys() : []); },
  async discard(uids) { if (uids.length) await audioDb.clips.bulkDelete(uids); },
  async wipe() { await audioDb.clips.clear(); },
};

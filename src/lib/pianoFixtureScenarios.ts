import { db } from "@/infrastructure/dexie/db";
import { audioDb } from "@/infrastructure/dexie/audioDb";
import { addDays, dayKey } from "./date";
import { buildSessionSnapshot } from "./domain/snapshots";
import { sessionContext } from "@/domain/logic/sessionContext";
import { sessionTempoIndexes, type Session } from "@/domain/entities/session";
import type { SegmentMark } from "@/domain/entities/common";
import type { Task } from "@/domain/entities/task";
import { studyRoutinesService } from "./services";

/** Extra playable scenarios; all dates share the seed's local calendar anchor. */
export async function seedPianoScenarios(anchor: Date, now: number, pianoId: number, harmonyId: number) {
  const key = (offset: number) => dayKey(addDays(anchor, offset));
  const stamp = (offset: number, hour = 9) => {
    const date = addDays(anchor, offset);
    date.setHours(hour, 0, 0, 0);
    return Math.min(date.getTime(), now);
  };
  const items = await db.library.toArray();
  const itemId = (title: string) => {
    const item = items.find(item => item.title === title);
    if (item?.id === undefined) throw new Error(`Missing piano fixture: ${title}`);
    return item.id;
  };
  const ballade = itemId("Ballade No. 1 in G minor, Op. 23");
  const nocturne = itemId("Nocturne in E♭ major, Op. 9 No. 2");
  const sonata = itemId("Sonata Op. 110 in A♭ major");
  const scales = itemId("24 scales — major & minor (4 octaves, hands together)");
  const sections = await db.segments.where("itemId").equals(ballade).sortBy("position");
  const intro = sections[0];
  const theme = sections[1];
  const coda = sections[3];
  if (!intro || !theme || !coda) throw new Error("Missing Ballade sections");

  await db.subjects.update(pianoId, { name: "Pianoforte", color: "terracotta" });
  await db.subjects.update(harmonyId, { name: "Armonia", color: "blue", layers: ["analytical", "aural", "compositional"] });
  await db.library.update(ballade, { isFavorite: true, tags: ["Recital", "Memoria"], notes: "Curare le voci interne e il cambio di pedale nelle cadenze." });
  await db.library.update(nocturne, { isFavorite: true, tags: ["Ripasso", "Cantabile"] });
  await db.library.update(sonata, { tags: ["Esame", "Polifonia"] });
  await db.segments.update(theme.id, { notes: "Evidenziare il canto senza irrigidire il polso." });

  const addTask = async (offset: number, input: Omit<Task, "id" | "date" | "createdAt">) => {
    const id = await db.tasks.add({ ...input, date: key(offset), createdAt: stamp(offset) });
    const task = await db.tasks.get(id);
    if (!task) throw new Error("Missing scenario task");
    return task;
  };
  const log = async (task: Task, marks: SegmentMark[], notStudied?: number[]) => {
    return db.sessions.add({
      taskId: task.id, ...sessionContext(task), date: task.date, marks,
      ...sessionTempoIndexes(marks), notStudied,
      snapshot: await buildSessionSnapshot(task),
      notes: "Ascolto delle voci interne; annotazioni separate per ogni frammento.",
      createdAt: Math.min(new Date(`${task.date}T10:00:00`).getTime(), now),
    });
  };
  const both = ["Both"];
  const partial = await addTask(0, {
    subjectId: pianoId, linkType: "item", itemId: ballade,
    title: "Ballata — introduzione completata, tema da riprendere", importance: "medium",
    plan: [intro, theme, coda].map(segment => ({ segmentId: segment.id, bpm: 68, noteVal: "quarter", layers: both, techniques: [] })),
    done: false, executionNotes: "Riprendere dal primo tema, poi affrontare la coda lentamente.",
  });
  const partialSessionId = await log(partial, [{ ...partial.plan[0], bpm: 70, confidence: 4, mood: 5, focus: 4, notes: "Introduzione fluida e memorizzata.", beatsPerBar: 4 }], [theme.id, coda.id]);

  await addTask(0, { subjectId: pianoId, linkType: "free", title: "Respirazione, postura e rilassamento del polso", importance: "low", plan: [{ layers: [], techniques: [] }], done: false });
  await addTask(-1, { subjectId: pianoId, linkType: "item", itemId: sonata, title: "Sonata op. 110 — recupero del fugato", importance: "high", plan: [{ bpm: 72, noteVal: "quarter", layers: both, techniques: [] }], done: false });
  await addTask(-4, { subjectId: pianoId, linkType: "free", title: "Ascolto comparato di due interpretazioni", plan: [{ layers: [], techniques: [] }], done: false });
  await addTask(-2, { subjectId: pianoId, linkType: "item", itemId: nocturne, title: "Notturno — pausa programmata", plan: [{ bpm: 120, noteVal: "eighth", layers: both, techniques: [] }], done: false, skipped: true });

  // Include every click-support level, section ratings and mixed rhythmic units.
  for (const [index, click] of (["all", "1-3", "first", "bar2", "bar4", "none"] as const).entries()) {
    const task = await addTask(-1 - index * 7, { subjectId: pianoId, linkType: "item", itemId: nocturne, title: "Notturno — autonomia dal metronomo", plan: [{ bpm: 132, noteVal: "eighth", click, layers: ["Both", "Memorized"], techniques: [] }], done: true });
    await log(task, [{ ...task.plan[0], bpm: 132 - index * 4, confidence: index < 2 ? 5 : 3, mood: 5 - index % 3, focus: 4 - index % 2, beatsPerBar: 3, notes: "Cantabile regolare; ascoltare l'accompagnamento." }]);
  }

  // Fixed weekly comparisons: quarter-note 64→70 and eighth-note 128→140.
  for (const [offset, bpm, noteVal] of [[-8, 64, "quarter"], [-1, 140, "eighth"]] as const) {
    const task = await addTask(offset, { subjectId: pianoId, linkType: "item", itemId: sonata, title: "Sonata — confronto delle figure ritmiche", plan: [{ bpm: 92, noteVal: "quarter", layers: both, techniques: [] }], done: true });
    await log(task, [{ ...task.plan[0], bpm, noteVal, confidence: 4, mood: 4, focus: 5 }]);
  }
  // Repertoire at different freshness levels, including a piece due for review.
  const oldTask = await addTask(-48, { subjectId: pianoId, linkType: "item", itemId: itemId("WTC I — Prelude & Fugue in C major, BWV 846"), title: "Bach in Do maggiore — ultimo ripasso", plan: [{ bpm: 72, noteVal: "quarter", layers: ["Memorized"], techniques: [] }], done: true });
  await log(oldTask, [{ ...oldTask.plan[0], confidence: 5, focus: 5, mood: 4 }]);
  const spontaneous: Omit<Session, "id"> = { subjectId: harmonyId, linkType: "free", date: key(-1), marks: [{ layers: ["aural"], techniques: [], confidence: 3, mood: 4, focus: 3, notes: "Riconoscimento delle cadenze senza spartito." }], snapshot: { subjectName: "Armonia", taskTitle: "Sessione libera — dettato armonico" }, createdAt: stamp(-1, 11) };
  await db.sessions.add(spontaneous);

  const archivedItem = await db.library.add({ subjectId: pianoId, kind: "study", title: "Burgmüller — Arabesque op. 100 n. 2 (archiviato)", composer: "F. Burgmüller", createdAt: stamp(-150), deletedAt: stamp(-5) });
  const archivedTask = await addTask(-20, { subjectId: pianoId, linkType: "item", itemId: archivedItem, title: "Arabesque — studio concluso", plan: [{ bpm: 100, noteVal: "quarter", layers: both, techniques: [] }], done: true, deletedAt: stamp(-5) });
  await log(archivedTask, [{ ...archivedTask.plan[0], confidence: 5, mood: 5, focus: 4 }]);

  const collections = await db.collections.toArray();
  const collection = collections.find(collection => collection.name === "Daily studies");
  if (collection?.id === undefined) throw new Error("Missing daily collection");
  const combinedId = await studyRoutinesService.create({
    name: "Laboratorio adattivo — tecnica e repertorio", subjectId: pianoId,
    groups: [
      { id: "fragments", name: "Frammenti da consolidare", combine: true, importance: "technique", repetitionCap: 7, pool: [intro, theme, coda].map(segment => ({ type: "segment", id: segment.id })) },
      { id: "review", name: "Ripasso del repertorio", importance: "low", pool: [{ type: "item", id: nocturne }, { type: "item", id: sonata }] },
      { id: "manuals", name: "Raccolte di esercizi", pool: [{ type: "collection", id: collection.id }] },
    ],
    matrix: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [String(day), { fragments: 2, review: day % 2, manuals: day % 3 === 0 ? 1 : 0 }])),
    weeksAhead: 2, repetitionCap: 4, adaptivity: "balanced", avoidBackToBack: true,
    startDate: key(0), tempoRule: { enabled: true, successes: 3, minConfidence: 4, increase: { kind: "percent", value: 5 }, decrease: { failures: 2, step: { kind: "percent", value: 5 } }, releaseClick: true },
  });
  const customized = await db.tasks.where("studyRoutineId").equals(combinedId).filter(task => task.date === key(1)).first();
  if (customized?.id !== undefined) await db.tasks.update(customized.id, { customized: true, executionNotes: "Adattato dopo la lezione: privilegiare il legato." });
  const scaleSections = await db.segments.where("itemId").equals(scales).toArray();
  for (const [index, section] of scaleSections.slice(0, 8).entries()) {
    const task = await addTask(-1 - index, { subjectId: pianoId, linkType: "item", itemId: scales, title: `Scale — ${section.label}`, plan: [{ segmentId: section.id, bpm: 100, noteVal: "sixteenth", layers: both, techniques: [] }], done: true });
    await log(task, [{ ...task.plan[0], bpm: 100 + index, confidence: 1 + index % 5, focus: 3 + index % 3, mood: 3 + index % 3 }]);
  }
  const eventId = await db.performances.add({ name: "Saggio di classe — esperienza conclusa", kind: "concert", subjectId: pianoId, date: key(-21), venue: "Auditorium del conservatorio", notes: "Buon controllo del cantabile; riprendere la coda.", createdAt: stamp(-60) });
  await db.performanceItems.add({ eventId, itemId: ballade, createdAt: stamp(-60) });
  const assignment = await db.assignments.toCollection().first();
  if (assignment) await db.assignments.update(assignment.id, { ignored: true, taskIds: [] });

  // A real playable WAV, explicitly labelled synthetic rather than a performance recording.
  const sampleRate = 8000;
  const samples = sampleRate * 2;
  const bytes = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 4000 * Math.min(i / 400, (samples - i) / 400, 1)), true);
  const uid = crypto.randomUUID();
  await audioDb.clips.put({ uid, data: bytes, mimeType: "audio/wav" });
  await db.recordings.add({ uid, sessionId: partialSessionId, segmentId: intro.id, title: "Esempio sintetico — La 440 Hz", date: key(0), mimeType: "audio/wav", durationMs: 2000, createdAt: now });
}
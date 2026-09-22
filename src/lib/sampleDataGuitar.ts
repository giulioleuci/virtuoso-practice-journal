import { db } from "./db";
import { backupService } from "./services/backup";

/**
 * Second fixture set: Italian guitar + harmony student, library only.
 * No tasks, no sessions, no lessons, no homework.
 */

const NOTES_IT = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"];

export async function seedGuitarSampleData() {
  await backupService.wipeAll();
  const now = Date.now();
  const D = 86400000;

  await db.profile.put({
    id: "me",
    name: "Giulio",
    lang: "it",
    reminderTime: "18:30",
    reminderFreq: "daily",
    reminderDays: [0, 1, 2, 3, 4, 5, 6],
    reminderEnabled: true,
    reminderPreset: "gentle",
    reminderIncludeContext: true,
    lateRecoveryDays: 3,
    carryoverDays: 7,
    graceDay: true,
    groupByPhase: true,
    hideHeroQuote: false,
    weekStartsOn: 1,
    onboarded: true,
    introSeen: true,
    createdAt: now - 60 * D,
  });

  // ---------- Materie ----------
  const chitarraId = (await db.subjects.add({
    name: "Chitarra",
    type: "instrument",
    layers: ["Mano destra", "Mano sinistra", "Insieme", "Lento", "A tempo", "A memoria"],
    createdAt: now - 60 * D,
  })) as number;

  const armoniaId = (await db.subjects.add({
    name: "Armonia",
    type: "theory",
    createdAt: now - 60 * D,
  })) as number;

  // ---------- Tecniche ----------
  const tech = async (subjectId: number, name: string) =>
    (await db.techniques.add({ subjectId, name, createdAt: now })) as number;

  const tArpeggio = await tech(chitarraId, "Arpeggio");
  const tLegatoAsc = await tech(chitarraId, "Legato ascendente");
  const tLegatoDisc = await tech(chitarraId, "Legato discendente");
  const tToccoLibero = await tech(chitarraId, "Tocco libero");
  const tToccoAppoggiato = await tech(chitarraId, "Tocco appoggiato");
  const tTremolo = await tech(chitarraId, "Tremolo");

  await tech(armoniaId, "Basso continuo");
  await tech(armoniaId, "Armonizzazione del corale");
  await tech(armoniaId, "Modulazione");

  // ---------- Libreria: tecnica (scale) ----------
  const addSegments = async (itemId: number, labels: string[], targetBpm: number) => {
    for (const label of labels) {
      await db.segments.add({
        itemId,
        label,
        targetBpm,
        noteVal: "quarter",
        layers: [],
        createdAt: now,
      });
    }
  };

  const scaleTech = [tToccoAppoggiato, tToccoLibero];

  const scaleMaggioriId = (await db.library.add({
    subjectId: chitarraId,
    kind: "technique",
    title: "Scale maggiori",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMaggioriId, NOTES_IT.map((n) => `${n} maggiore`), 100);

  const scaleMinoriMelId = (await db.library.add({
    subjectId: chitarraId,
    kind: "technique",
    title: "Scale minori melodiche",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMinoriMelId, NOTES_IT.map((n) => `${n} minore mel.`), 100);

  const scaleMinoriArmId = (await db.library.add({
    subjectId: chitarraId,
    kind: "technique",
    title: "Scale minori armoniche",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMinoriArmId, NOTES_IT.map((n) => `${n} minore arm.`), 100);

  // ---------- Libreria: manuale ----------
  const giulianiId = (await db.library.add({
    subjectId: chitarraId,
    kind: "manual",
    title: "120 Arpeggi Op. 1",
    composer: "Giuliani M.",
    totalExercises: 120,
    currentExercise: 1,
    targetBpm: 60,
    noteVal: "quarter",
    techniqueIds: [tArpeggio, tToccoLibero, tTremolo, tLegatoAsc, tLegatoDisc],
    createdAt: now - 45 * D,
  })) as number;
  await addSegments(
    giulianiId,
    Array.from({ length: 120 }, (_, i) => `Arp. ${i + 1}`),
    60,
  );

  // ---------- Raccolta: Scale ----------
  const raccoltaId = (await db.collections.add({
    kind: "technique",
    name: "Scale",
    defaultSubjectId: chitarraId,
    createdAt: now - 50 * D,
    updatedAt: now - 50 * D,
  })) as number;

  const scaleIds = [scaleMaggioriId, scaleMinoriArmId, scaleMinoriMelId];
  for (let i = 0; i < scaleIds.length; i++) {
    await db.collectionItems.add({
      collectionId: raccoltaId,
      itemId: scaleIds[i],
      position: i,
      createdAt: now,
    });
  }
}

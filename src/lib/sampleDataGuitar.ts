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
    for (const [position, label] of labels.entries()) {
      await db.segments.add({
        itemId, position,
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
    kind: "technique", studyStatus: "not_started",
    title: "Scale maggiori",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMaggioriId, NOTES_IT.map((n) => `${n} maggiore`), 100);

  const scaleMinoriMelId = (await db.library.add({
    subjectId: chitarraId,
    kind: "technique", studyStatus: "not_started",
    title: "Scale minori melodiche",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMinoriMelId, NOTES_IT.map((n) => `${n} minore mel.`), 100);

  const scaleMinoriArmId = (await db.library.add({
    subjectId: chitarraId,
    kind: "technique", studyStatus: "not_started",
    title: "Scale minori armoniche",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMinoriArmId, NOTES_IT.map((n) => `${n} minore arm.`), 100);

  // Each printed exercise has its own material identity; the manual keeps its index.
  const manualId = await db.collections.add({ kind: "manual", name: "120 Arpeggi Op. 1", composer: "Mauro Giuliani", edition: "Edizione per lo studio", defaultSubjectId: chitarraId, createdAt: now, updatedAt: now });
  const arpeggioId = await db.library.add({ subjectId: chitarraId, kind: "technique", studyStatus: "not_started", title: "Arpeggio n. 1", composer: "Mauro Giuliani", catalog: "Op. 1 n. 1", targetBpm: 60, noteVal: "quarter", techniqueIds: [tArpeggio, tToccoLibero, tTremolo, tLegatoAsc, tLegatoDisc], createdAt: now });
  const studyId = await db.library.add({ subjectId: chitarraId, kind: "study", studyStatus: "not_started", title: "Studio in Do maggiore", composer: "Mauro Giuliani", targetBpm: 80, noteVal: "quarter", createdAt: now });
  const theoryId = await db.library.add({ subjectId: chitarraId, kind: "theory", studyStatus: "not_started", title: "Indicazioni sul tocco e sul rilassamento", notes: "Leggere prima degli arpeggi.", createdAt: now });
  await db.library.add({ subjectId: chitarraId, kind: "piece", studyStatus: "not_started", title: "Lágrima", composer: "Francisco Tárrega", createdAt: now });
  await db.library.add({ subjectId: armoniaId, kind: "exercise", studyStatus: "not_started", title: "Basso da armonizzare n. 1", createdAt: now });
  await db.segments.bulkAdd([
    { itemId: studyId, label: "Prima frase", position: 0, barStart: 1, barEnd: 8, layers: [], createdAt: now },
    { itemId: studyId, label: "Passaggio legato", position: 1, barStart: 4, barEnd: 6, targetBpm: 56, noteVal: "quarter", layers: [], createdAt: now },
  ]);
  await db.collectionItems.bulkAdd([
    { collectionId: manualId, itemId: theoryId, position: 0, reference: "Introduzione", pageStart: 1, createdAt: now },
    { collectionId: manualId, itemId: arpeggioId, position: 1, reference: "Arpeggio 1", pageStart: 3, createdAt: now },
    { collectionId: manualId, itemId: studyId, position: 2, reference: "Studio", pageStart: 8, pageEnd: 9, createdAt: now },
  ]);

  // ---------- Raccolta: Scale ----------
  const raccoltaId = (await db.collections.add({
    kind: "collection",
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

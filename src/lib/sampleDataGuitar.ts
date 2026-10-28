import { db } from "@/infrastructure/dexie/db";
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
  const addSegments = async (itemId: number, labels: string[]) => {
    for (const [position, label] of labels.entries()) {
      await db.segments.add({
        itemId, position,
        label,
        layers: [],
        createdAt: now,
      });
    }
  };

  for (const [title, techniqueIds, labels] of [
    ["Legati ascendenti", [tLegatoAsc], ["1-2", "1-3", "1-4", "2-3", "2-4", "3-4", "1-3-4", "1-2-4", "1-2+2-3+3-4"]],
    ["Legati discendenti", [tLegatoDisc], ["2-1", "3-1", "4-1", "3-2", "4-2", "4-3", "4-3-1", "4-2-1", "4-3+3-2+2-1"]],
    ["Legati combinati", [tLegatoAsc, tLegatoDisc], ["1-2-1", "1-3-1", "1-4-1", "2-3-2", "2-4-2", "3-4-3", "1-3-4-3", "1-2-4-2", "1-2-4-3", "1-4-2-3", "1-4-3-4", "1-4-2-4", "1-3-4-2", "1-4-3-2"]],
    ["Legati cromatici", [tLegatoAsc, tLegatoDisc], ["1-2-3-4", "4-3-2-1"]],
    ["Tremolo", [tTremolo], ["p-m-a-i", "p-i-m-a", "p-m-i", "p-i-m"]],
  ] as const) {
    const itemId = await db.library.add({ subjectId: chitarraId, kind: "technique", title, techniqueIds: [...techniqueIds], createdAt: now });
    await addSegments(itemId, [...labels]);
  }

  await db.library.bulkAdd([
    "Triadi e rivolti",
    "Regole di condotta delle parti",
    "Funzioni armoniche",
    "Rivolti delle triadi",
    "Triade aumentata e diminuita",
    "Cadenze",
    "Accordi di settima",
    "Accordi di nona",
    "Armonizzazione secondo la regola dell'ottava",
    "Note di passaggio",
    "Cromatismi",
    "Dominanti secondarie",
    "Modulazione",
    "Tecniche di modulazione ai toni vicini",
    "Ritardi",
    "Pedale",
    "Progressioni tonali",
    "Progressioni modulanti",
    "Progressioni imitate",
  ].map(title => ({ subjectId: armoniaId, kind: "theory" as const, title, createdAt: now })));

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
  await addSegments(scaleMaggioriId, NOTES_IT.map((n) => `${n} maggiore`));

  const scaleMinoriMelId = (await db.library.add({
    subjectId: chitarraId,
    kind: "technique",
    title: "Scale minori melodiche",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMinoriMelId, NOTES_IT.map((n) => `${n} minore mel.`));

  const scaleMinoriArmId = (await db.library.add({
    subjectId: chitarraId,
    kind: "technique",
    title: "Scale minori armoniche",
    targetBpm: 100,
    noteVal: "quarter",
    techniqueIds: scaleTech,
    createdAt: now - 50 * D,
  })) as number;
  await addSegments(scaleMinoriArmId, NOTES_IT.map((n) => `${n} minore arm.`));

  const manualId = await db.collections.add({ kind: "manual", name: "120 Arpeggi Op. 1", composer: "Mauro Giuliani", edition: "Edizione per lo studio", defaultSubjectId: chitarraId, createdAt: now, updatedAt: now });
  const arpeggioId = await db.library.add({ subjectId: chitarraId, kind: "study", title: "Arpeggi op. 1 Giuliani", composer: "M. Giuliani", catalog: "Op.1 prima parte", targetBpm: 60, noteVal: "quarter", techniqueIds: [tArpeggio, tToccoLibero, tTremolo, tLegatoAsc, tLegatoDisc], createdAt: now });
  await addSegments(arpeggioId, Array.from({ length: 120 }, (_, i) => `Arpeggio ${i + 1}`));
  const studyId = await db.library.add({ subjectId: chitarraId, kind: "study", title: "Studio in Do maggiore", composer: "Mauro Giuliani", targetBpm: 80, noteVal: "quarter", createdAt: now });
  const theoryId = await db.library.add({ subjectId: chitarraId, kind: "theory", title: "Indicazioni sul tocco e sul rilassamento", notes: "Leggere prima degli arpeggi.", createdAt: now });
  await db.library.add({ subjectId: chitarraId, kind: "piece", title: "Lágrima", composer: "Francisco Tárrega", createdAt: now });
  await db.library.bulkAdd([
    { subjectId: chitarraId, kind: "piece", title: "Endecha", composer: "Francisco Tárrega", createdAt: now },
    { subjectId: chitarraId, kind: "piece", title: "Oremus", composer: "Francisco Tárrega", createdAt: now },
    { subjectId: chitarraId, kind: "piece", title: "Preludio n. 8 in Fa diesis minore", composer: "Manuel M. Ponce", createdAt: now },
    { subjectId: chitarraId, kind: "piece", title: "La Melanconia", composer: "M. Giuliani", createdAt: now },
  ]);
  await db.library.add({ subjectId: armoniaId, kind: "exercise", title: "Basso da armonizzare n. 1", createdAt: now });
  await db.segments.bulkAdd([
    { itemId: studyId, label: "Prima frase", position: 0, barStart: 1, barEnd: 8, layers: [], createdAt: now },
    { itemId: studyId, label: "Passaggio legato", position: 1, barStart: 4, barEnd: 6, targetBpm: 56, noteVal: "quarter", layers: [], createdAt: now },
  ]);
  await db.collectionItems.bulkAdd([
    { collectionId: manualId, itemId: theoryId, position: 0, reference: "Introduzione", pageStart: 1, createdAt: now },
    { collectionId: manualId, itemId: arpeggioId, position: 1, reference: "Op.1 prima parte", pageStart: 3, createdAt: now },
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

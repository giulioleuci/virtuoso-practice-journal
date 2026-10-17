import { db, THEORY_LAYERS, type LessonRecurrence, type NoteVal, type SegmentEntry, type SegmentMark } from "./db";
import { sessionContext } from "@/domain/logic/sessionContext";
import { buildSessionSnapshot, buildLessonSnapshot } from "./domain/snapshots";
import { backupService } from "./services/backup";
import { lessonsService } from "./services/lessons";
import { dayKey, today, addDays } from "./date";
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
// Deterministic pseudo-random in [0,1) from a seed (so re-seeding is stable).
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

export async function seedSampleData() {
  await backupService.wipeAll();
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const now = Date.now();
  const D = 86400000;

  // ---------- Profile ----------
  await db.profile.put({
    id: "me",
    name: "Wolfgang",
    lang: "en",
    reminderTime: "18:30",
    reminderFreq: "daily",
    reminderDays: [0, 1, 2, 3, 4, 5, 6],
    reminderEnabled: true,
    reminderPreset: "motivational",
    reminderIncludeContext: true,
    lateRecoveryDays: 3,
    carryoverDays: 7,
    graceDay: true,
    groupByPhase: true,
    hideHeroQuote: false,
    weekStartsOn: 1,
    onboarded: true,
    introSeen: true,
    createdAt: now - 200 * D,
  });


  // ---------- Subjects ----------
  const pianoId = (await db.subjects.add({
    name: "Piano", type: "instrument",
    layers: ["RH", "LH", "Both", "Slow", "In rhythm", "Memorized"],
    createdAt: now - 200 * D,
  })) as number;
  const harmonyId = (await db.subjects.add({
    name: "Harmony", type: "theory",
    createdAt: now - 200 * D,
  })) as number;

  // ---------- Techniques ----------
  const tech = async (subjectId: number, name: string) =>
    (await db.techniques.add({ subjectId, name, createdAt: now })) as number;

  const tPedal      = await tech(pianoId, "Pedal");
  const tNoPedal    = await tech(pianoId, "Without pedal");
  const tLegato     = await tech(pianoId, "Legato");
  const tStaccato   = await tech(pianoId, "Staccato");
  const tOctaves    = await tech(pianoId, "Octaves");
  const tArpeggios  = await tech(pianoId, "Arpeggios");
  const tTrills     = await tech(pianoId, "Trills");
  const tVoicing    = await tech(pianoId, "Voicing");

  const tFigured    = await tech(harmonyId, "Figured bass");
  const tChorale    = await tech(harmonyId, "Chorale writing");
  const tModulation = await tech(harmonyId, "Modulation");
  const tCounter    = await tech(harmonyId, "Counterpoint");

  // ---------- Library ----------
  // Repertoire (4)
  const chopinBallade = (await db.library.add({
    subjectId: pianoId, kind: "piece", studyStatus: "in_progress",
    title: "Ballade No. 1 in G minor, Op. 23", composer: "Chopin",
targetBpm: 76, noteVal: "quarter",
    techniqueIds: [tPedal, tArpeggios, tOctaves, tVoicing],
    createdAt: now - 90 * D,
  })) as number;

  const bachWtcCsh = (await db.library.add({
    subjectId: pianoId, kind: "piece", studyStatus: "in_progress",
    title: "WTC I — Prelude & Fugue in C# minor, BWV 849", composer: "Bach",
targetBpm: 60, noteVal: "quarter",
    techniqueIds: [tNoPedal, tLegato, tVoicing],
    createdAt: now - 60 * D,
  })) as number;

  const beethoven110 = (await db.library.add({
    subjectId: pianoId, kind: "piece", studyStatus: "in_progress",
    title: "Sonata Op. 110 in A♭ major", composer: "Beethoven",
targetBpm: 92, noteVal: "quarter",
    techniqueIds: [tPedal, tLegato, tVoicing],
    createdAt: now - 180 * D,
  })) as number;

  const nocturne9_2 = (await db.library.add({
    subjectId: pianoId, kind: "piece", studyStatus: "in_progress",
    title: "Nocturne in E♭ major, Op. 9 No. 2", composer: "Chopin",
targetBpm: 132, noteVal: "eighth",
    techniqueIds: [tPedal, tLegato, tTrills],
    createdAt: now - 220 * D,
  })) as number;

  const nocturne9_1 = (await db.library.add({
    subjectId: pianoId, kind: "piece", studyStatus: "in_progress",
    title: "Nocturne in B♭ minor, Op. 9 No. 1", composer: "Chopin",
targetBpm: 116, noteVal: "eighth",
    techniqueIds: [tPedal, tLegato, tVoicing],
    createdAt: now - 40 * D,
  })) as number;

  const wtcCmaj = (await db.library.add({
    subjectId: pianoId, kind: "piece", studyStatus: "in_progress",
    title: "WTC I — Prelude & Fugue in C major, BWV 846", composer: "Bach",
targetBpm: 72, noteVal: "quarter",
    techniqueIds: [tNoPedal, tLegato, tVoicing],
    createdAt: now - 240 * D,
  })) as number;

  const beethoven109 = (await db.library.add({
    subjectId: pianoId, kind: "piece", studyStatus: "in_progress",
    title: "Sonata Op. 109 in E major", composer: "Beethoven",
targetBpm: 84, noteVal: "quarter",
    techniqueIds: [tPedal, tLegato, tVoicing, tTrills],
    createdAt: now - 35 * D,
  })) as number;

  // Manuals (4)
  const hanon = (await db.library.add({
    subjectId: pianoId, kind: "technique", studyStatus: "in_progress",
    title: "Hanon — Exercise 18", composer: "Hanon",
    targetBpm: 108, noteVal: "sixteenth",
    techniqueIds: [tNoPedal, tLegato],
    createdAt: now - 150 * D,
  })) as number;

  const cortot = (await db.library.add({
    subjectId: pianoId, kind: "technique", studyStatus: "in_progress",
    title: "Cortot — Finger equality", composer: "Cortot",
    targetBpm: 80, noteVal: "eighth",
    techniqueIds: [tArpeggios, tTrills],
    createdAt: now - 80 * D,
  })) as number;

  const czerny740 = (await db.library.add({
    subjectId: pianoId, kind: "study", studyStatus: "in_progress",
    title: "Czerny — Study No. 5, Op. 740", composer: "Czerny",
    targetBpm: 120, noteVal: "sixteenth",
    techniqueIds: [tLegato, tStaccato, tArpeggios],
    createdAt: now - 70 * D,
  })) as number;

  const piston = (await db.library.add({
    subjectId: harmonyId, kind: "exercise", studyStatus: "in_progress",
    title: "Piston — Figured bass, Chapter 12", composer: "Walter Piston",
    techniqueIds: [tFigured, tChorale],
    createdAt: now - 70 * D,
  })) as number;

  // Technique items (extra, not counted toward minimums)
  const scales = (await db.library.add({
    subjectId: pianoId, kind: "technique", studyStatus: "in_progress",
    title: "24 scales — major & minor (4 octaves, hands together)",
    startBpm: 80, targetBpm: 132, noteVal: "sixteenth",
    techniqueIds: [tLegato, tStaccato],
    createdAt: now - 120 * D,
  })) as number;

  // 24 segments — one per major and minor key (12 + 12)
  const MAJORS = ["C","G","D","A","E","B","F#","C#","F","Bb","Eb","Ab"];
  const MINORS = ["a","e","b","f#","c#","g#","d#","a#","d","g","c","f"];
  const majorSegmentIds: number[] = [];
  const minorSegmentIds: number[] = [];
  for (const key of MAJORS) {
    const id = (await db.segments.add({
      position: majorSegmentIds.length, itemId: scales, label: `${key} major`, targetBpm: 132, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      createdAt: now - 120 * D,
    })) as number;
    majorSegmentIds.push(id);
  }
  for (const key of MINORS) {
    const id = (await db.segments.add({
      position: MAJORS.length + minorSegmentIds.length, itemId: scales, label: `${key} minor`, targetBpm: 132, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      createdAt: now - 120 * D,
    })) as number;
    minorSegmentIds.push(id);
  }


  const arpeggios = (await db.library.add({
    subjectId: pianoId, kind: "technique", studyStatus: "in_progress",
    title: "Dominant 7th arpeggios — all keys",
    startBpm: 70, targetBpm: 120, noteVal: "sixteenth",
    techniqueIds: [tArpeggios],
    createdAt: now - 110 * D,
  })) as number;

  // Theory (4)
  const secDom = (await db.library.add({
    subjectId: harmonyId, kind: "theory", studyStatus: "not_started",
    title: "Secondary dominants & tonicization",
    techniqueIds: [tChorale, tModulation],
    createdAt: now - 50 * D,
  })) as number;

  const modMix = (await db.library.add({
    subjectId: harmonyId, kind: "theory", studyStatus: "not_started",
    title: "Modal mixture & Neapolitan",
    techniqueIds: [tChorale],
    createdAt: now - 30 * D,
  })) as number;

  const speciesCpt = (await db.library.add({
    subjectId: harmonyId, kind: "theory", studyStatus: "not_started",
    title: "Species counterpoint — first & second species",
    techniqueIds: [tCounter, tChorale],
    createdAt: now - 45 * D,
  })) as number;

  const augSixth = (await db.library.add({
    subjectId: harmonyId, kind: "theory", studyStatus: "not_started",
    title: "Augmented sixth chords (It / Fr / Ger)",
    techniqueIds: [tChorale, tModulation],
    createdAt: now - 20 * D,
  })) as number;

  // ---------- Collections (4) ----------
  const colNocturnesOp9 = (await db.collections.add({
    kind: "collection",
    name: "Nocturnes, Op. 9", composer: "Chopin", catalog: "Op. 9",
    notes: "Three nocturnes dedicated to Madame Camille Pleyel.",
    color: "plum", defaultSubjectId: pianoId,
    createdAt: now - 60 * D, updatedAt: now,
  })) as number;

  const colWtcI = (await db.collections.add({
    kind: "collection",
    name: "Well-Tempered Clavier, Book I", composer: "Bach", catalog: "BWV 846–869",
    color: "blue", defaultSubjectId: pianoId,
    createdAt: now - 60 * D, updatedAt: now,
  })) as number;

  const colBeethovenLate = (await db.collections.add({
    kind: "collection",
    name: "Late Beethoven Sonatas", composer: "Beethoven", catalog: "Op. 101–111",
    color: "terracotta", defaultSubjectId: pianoId,
    createdAt: now - 60 * D, updatedAt: now,
  })) as number;

  const colCzerny = (await db.collections.add({
    kind: "manual",
    name: "Czerny Studies", composer: "Czerny", catalog: "Op. 740",
    notes: "Daily finger-dexterity studies.",
    color: "gold", defaultSubjectId: pianoId,
    createdAt: now - 60 * D, updatedAt: now,
  })) as number;

  const colHanon = await db.collections.add({ kind: "manual", name: "The Virtuoso Pianist", composer: "Hanon", edition: "Student edition", defaultSubjectId: pianoId, createdAt: now, updatedAt: now });
  const colCortot = await db.collections.add({ kind: "manual", name: "Rational Principles of Pianoforte Technique", composer: "Cortot", defaultSubjectId: pianoId, createdAt: now, updatedAt: now });
  const colPiston = await db.collections.add({ kind: "manual", name: "Harmony", composer: "Walter Piston", defaultSubjectId: harmonyId, createdAt: now, updatedAt: now });
  const colDaily = await db.collections.add({ kind: "collection", name: "Daily studies", defaultSubjectId: pianoId, createdAt: now, updatedAt: now });
  const pianoTheory = await db.library.add({ subjectId: pianoId, kind: "theory", studyStatus: "not_started", title: "Articulation and relaxed touch", notes: "Read before practicing the study.", createdAt: now });
  await db.collectionItems.bulkAdd([
    { collectionId: colHanon, itemId: hanon, position: 0, reference: "Exercise 18", pageStart: 12, pageEnd: 13, createdAt: now },
    { collectionId: colCortot, itemId: cortot, position: 0, reference: "Chapter 1", pageStart: 5, createdAt: now },
    { collectionId: colPiston, itemId: piston, position: 0, reference: "Chapter 12 — Exercise 1", pageStart: 37, createdAt: now },
    { collectionId: colPiston, itemId: secDom, position: 1, reference: "Secondary dominants", pageStart: 42, createdAt: now },
    { collectionId: colCzerny, itemId: pianoTheory, position: 0, reference: "Introduction", pageStart: 1, createdAt: now },
    { collectionId: colDaily, itemId: czerny740, position: 0, reference: "First study", createdAt: now },
    { collectionId: colDaily, itemId: scales, position: 1, createdAt: now },
    { collectionId: colNocturnesOp9, itemId: nocturne9_1, position: 1, createdAt: now },
    { collectionId: colNocturnesOp9, itemId: nocturne9_2, position: 2, createdAt: now },
    { collectionId: colWtcI,         itemId: bachWtcCsh,  position: 1, createdAt: now },
    { collectionId: colWtcI,         itemId: wtcCmaj,     position: 2, createdAt: now },
    { collectionId: colBeethovenLate, itemId: beethoven109, position: 1, createdAt: now },
    { collectionId: colBeethovenLate, itemId: beethoven110, position: 2, createdAt: now },
    { collectionId: colCzerny,       itemId: czerny740,   position: 1, createdAt: now },
  ]);

  // ---------- Repertoire ("to keep" pieces with spaced reviews) ----------
  // Mix of states: overdue, due today, and comfortably scheduled.
  const repertoirePlan: { itemId: number; addedDaysAgo: number; intervalDays: number; lastReviewedDaysAgo: number }[] = [
    { itemId: czerny740, addedDaysAgo: 30, intervalDays: 7, lastReviewedDaysAgo: 2 },
    { itemId: nocturne9_2,   addedDaysAgo: 200, intervalDays: 30, lastReviewedDaysAgo: 40 }, // overdue
    { itemId: wtcCmaj,       addedDaysAgo: 220, intervalDays: 60, lastReviewedDaysAgo: 60 }, // due today
    { itemId: beethoven110,  addedDaysAgo: 150, intervalDays: 14, lastReviewedDaysAgo: 9 },  // due in 5 days
    { itemId: chopinBallade, addedDaysAgo: 80,  intervalDays: 7,  lastReviewedDaysAgo: 2 },  // due in 5 days
    { itemId: bachWtcCsh,    addedDaysAgo: 55,  intervalDays: 90, lastReviewedDaysAgo: 10 }, // far out
  ];
  for (const plan of repertoirePlan) {
    await db.library.update(plan.itemId, {
      inRepertoire: true,
      repertoireAddedAt: now - plan.addedDaysAgo * D,
      reviewIntervalDays: plan.intervalDays,
      lastReviewedAt: dayKey(addDays(todayDate, -plan.lastReviewedDaysAgo)),
      nextReviewAt: dayKey(addDays(todayDate, plan.intervalDays - plan.lastReviewedDaysAgo)),
    });
  }

  // ---------- Performance events + programmes ----------
  const concertId = (await db.performances.add({
    name: "Autumn recital — Sala Verdi",
    kind: "concert",
    date: dayKey(addDays(todayDate, 45)),
    subjectId: pianoId,
    venue: "Sala Verdi, Milano",
    notes: "45-minute programme, no interval.",
    createdAt: now - 30 * D,
  })) as number;

  const examId = (await db.performances.add({
    name: "End-of-year exam",
    kind: "exam",
    date: dayKey(addDays(todayDate, 90)),
    subjectId: pianoId,
    venue: "Conservatorio — Aula magna",
    notes: "Bach + a Classical sonata required.",
    createdAt: now - 20 * D,
  })) as number;

  const auditionId = (await db.performances.add({
    name: "Chamber series audition",
    kind: "audition",
    date: dayKey(addDays(todayDate, 12)),
    subjectId: pianoId,
    venue: "Teatro Comunale",
    createdAt: now - 10 * D,
  })) as number;

  await db.performanceItems.bulkAdd([
    { eventId: concertId, itemId: czerny740, createdAt: now },
    { eventId: concertId,  itemId: chopinBallade, createdAt: now },
    { eventId: concertId,  itemId: nocturne9_2,   createdAt: now },
    { eventId: concertId,  itemId: beethoven110,  createdAt: now },
    { eventId: examId,     itemId: bachWtcCsh,    createdAt: now },
    { eventId: examId,     itemId: beethoven109,  createdAt: now },
    { eventId: auditionId, itemId: nocturne9_1,   createdAt: now },
    { eventId: auditionId, itemId: wtcCmaj,       createdAt: now },
  ]);



  // ---------- Segments ----------
  const seg = async (
    itemId: number, label: string, targetBpm: number,
    noteVal: NoteVal,
    layers: string[], techniqueIds: number[]
  ) => (await db.segments.add({
    itemId, label, position: await db.segments.where("itemId").equals(itemId).count(), targetBpm, noteVal, layers, techniqueIds,
    createdAt: now - 60 * D,
  })) as number;

  const balladeIntro = await seg(chopinBallade, "mm. 1–8 — Introduction",   72, "quarter", ["RH","LH","Both"], [tVoicing, tPedal]);
  const balladeA     = await seg(chopinBallade, "mm. 9–36 — First theme",   76, "quarter", ["RH","LH","Both","Slow"], [tLegato, tVoicing]);
  const balladeB     = await seg(chopinBallade, "mm. 68–94 — Second theme", 84, "quarter", ["Both","In rhythm"], [tPedal, tVoicing]);
  const balladeCoda  = await seg(chopinBallade, "Presto con fuoco — Coda", 132, "quarter", ["RH","Slow"], [tOctaves, tArpeggios]);

  await db.segments.update(balladeIntro, { barStart: 0, barEnd: 8, targetBpm: undefined, noteVal: undefined });
  await db.segments.update(balladeA, { barStart: 9, barEnd: 36 });
  await db.segments.update(balladeB, { barStart: 68, barEnd: 94 });
  await db.segments.update(balladeCoda, { barStart: 208, barEnd: 264 });

  const wtcPrelude = await seg(bachWtcCsh, "Prelude — full",       60, "quarter", ["Both","Memorized"], [tLegato]);
  const wtcFugue   = await seg(bachWtcCsh, "Fugue — exposition",   56, "quarter", ["RH","LH","Both"], [tVoicing]);

  const hanonEx18 = await seg(hanon, "Exercise 18", 96, "sixteenth", ["RH","LH","Both"], [tLegato]);
  const cortotCh1 = await seg(cortot, "Chapter 1 — finger equality", 76, "eighth", ["RH","LH"], [tLegato]);

  // ---------- Lesson recurrences ----------
  const wedDow = 3;
  const lessonRecId = (await db.recurrences.add({
    subjectId: pianoId, teacher: "Prof. Aldo Ferri",
    schedules: [{ dayOfWeek: wedDow, startTime: "17:00", endTime: "18:00", frequency: "weekly" }],
    startDate: dayKey(addDays(todayDate, -90)), color: "terracotta",
    createdAt: now - 100 * D,
  })) as number;

  // Harmony has two weekly slots (Tuesday & Friday)
  const harmonyRecId = (await db.recurrences.add({
    subjectId: harmonyId, teacher: "Prof.ssa Lia Conti",
    schedules: [
      { dayOfWeek: 2, startTime: "15:00", endTime: "16:00", frequency: "weekly" },
      { dayOfWeek: 5, startTime: "10:00", endTime: "11:30", frequency: "weekly" },
    ],
    startDate: dayKey(addDays(todayDate, -84)), color: "blue",
    createdAt: now - 100 * D,
  })) as number;


  // ---------- Past lessons + assignments ----------
  // Build the last 6 Wednesdays (from todayDate)
  const lastSixWeds: Date[] = [];
  {
    const todayDow = todayDate.getDay();
    const offsetToLastWed = ((todayDow - wedDow + 7) % 7) || 7; // strictly past
    let d = addDays(todayDate, -offsetToLastWed);
    for (let i = 0; i < 6; i++) {
      lastSixWeds.push(new Date(d));
      d = addDays(d, -7);
    }
  }
  lastSixWeds.reverse();

  const linkedHomework: { assignmentId: number; itemId: number }[] = [];
  const lessonAssignmentTexts: { text: string; transformed: boolean; pieces: number[] }[][] = [
    [
      { text: "Slow practice mm. 9–36 hands separately at ♩=60", transformed: true, pieces: [chopinBallade] },
      { text: "Hanon 18 at ♩=96, then ♩=104 next week",          transformed: true, pieces: [hanon] },
      { text: "Memorize Bach Prelude entirely",                  transformed: false, pieces: [bachWtcCsh] },
    ],
    [
      { text: "Voicing of inner lines — Ballade first theme",    transformed: true, pieces: [chopinBallade] },
      { text: "Czerny 740 No. 5 — staccato touch, ♩=120",        transformed: true, pieces: [czerny740] },
    ],
    [
      { text: "Op. 110 — work the fugato slowly",                transformed: true, pieces: [beethoven110] },
      { text: "Nocturne Op.9 No.2 — ornament fingerings",        transformed: true, pieces: [nocturne9_2] },
      { text: "Pick up Cortot Ch. 1 again, daily",               transformed: false, pieces: [cortot] },
    ],
    [
      { text: "Bach Fugue — exposition memorized",               transformed: true, pieces: [bachWtcCsh] },
      { text: "Ballade Coda — octaves, slow",                    transformed: true, pieces: [chopinBallade] },
    ],
    [
      { text: "Op. 109 — variations theme, voicing",             transformed: true, pieces: [beethoven109] },
      { text: "Hanon 18 at ♩=104, evenness across both hands",   transformed: true, pieces: [hanon] },
      { text: "Add a recording session this week",               transformed: false, pieces: [] },
    ],
    [
      { text: "Ballade — bring Intro + First theme run-through", transformed: true, pieces: [chopinBallade] },
      { text: "Nocturne Op.9 No.1 — left-hand evenness",         transformed: true, pieces: [nocturne9_1] },
    ],
  ];

  for (let li = 0; li < lastSixWeds.length; li++) {
    const d = lastSixWeds[li];
    const items = lessonAssignmentTexts[li];
    const pieceIds = Array.from(new Set(items.flatMap((a) => a.pieces)));
    const { snapshot, piecesPlayedTitles } = await buildLessonSnapshot(
      pianoId,
      { subjectId: pianoId, teacher: "Prof. Aldo Ferri",
        schedules: [{ dayOfWeek: wedDow, startTime: "17:00", endTime: "18:00", frequency: "weekly" }],
        startDate: dayKey(addDays(todayDate, -90)), color: "terracotta", createdAt: now } satisfies LessonRecurrence,
      pieceIds,
    );

    const lessonId = (await db.lessons.add({
      recurrenceId: lessonRecId, subjectId: pianoId, date: dayKey(d),
      notes: "Voicing of inner lines; pedaling for legato bass; tempo control.",
      piecesPlayed: pieceIds, piecesPlayedTitles, snapshot,
      createdAt: d.getTime(),
    })) as number;
    for (const a of items) {
      const assignmentId = await lessonsService.addAssignment(lessonId, a.text);
      if (a.transformed && a.pieces[0]) linkedHomework.push({ assignmentId, itemId: a.pieces[0] });
    }
  }

  // One past harmony lesson
  {
    const d = addDays(todayDate, -14);
    const pieceIds = [piston, secDom];
    const { snapshot, piecesPlayedTitles } = await buildLessonSnapshot(
      harmonyId,
      { subjectId: harmonyId, teacher: "Prof.ssa Lia Conti",
        schedules: [
          { dayOfWeek: 2, startTime: "15:00", endTime: "16:00", frequency: "weekly" },
          { dayOfWeek: 5, startTime: "10:00", endTime: "11:30", frequency: "weekly" },
        ],
        startDate: dayKey(addDays(todayDate, -84)), color: "blue", createdAt: now } satisfies LessonRecurrence,
      pieceIds,
    );

    const lessonId = (await db.lessons.add({
      recurrenceId: harmonyRecId, subjectId: harmonyId, date: dayKey(d),
      notes: "Reviewed secondary dominants; introduced Neapolitan sixth.",
      piecesPlayed: pieceIds, piecesPlayedTitles, snapshot,
      createdAt: d.getTime(),
    })) as number;
    linkedHomework.push({ assignmentId: await lessonsService.addAssignment(lessonId, "Realize 4 figured-bass exercises (Piston ch. 12)"), itemId: piston });
    linkedHomework.push({ assignmentId: await lessonsService.addAssignment(lessonId, "Aural drill: identify V/V vs V in 10 examples"), itemId: secDom });
    await lessonsService.addAssignment(lessonId, "Compose a short period using Neapolitan sixth");
  }

  // ---------- Tasks: history with sessions ----------
  type TaskRow = Parameters<typeof db.tasks.add>[0];

  /** One plan entry per section (or a single whole-task entry) sharing the same targets. */
  const plan = (layers: string[], techniques: number[], bpm?: number, noteVal?: NoteVal, segmentIds?: number[]): SegmentEntry[] =>
    (segmentIds?.length ? segmentIds : [undefined]).map((segmentId) => ({ segmentId, bpm, noteVal, layers, techniques }));

  /** Deterministic session marks for a plan: confidence follows `trend`, `bias` shifts each section. */
  const sessionMarks = (entries: SegmentEntry[], trend: number, seed: number, bias: (k: number) => number = () => 0): SegmentMark[] =>
    entries.map((e, k) => ({
      ...e,
      targetBpm: e.bpm,
      targetNoteVal: e.noteVal,
      bpm: e.bpm ? clamp(Math.round(e.bpm - 6 + bias(k) / 2 + rand(seed + k * 17) * 10), 20, 400) : undefined,
      confidence: clamp(Math.round((trend + bias(k) - 8 + rand(seed + k * 31) * 18) / 20), 1, 5),
    }));

  const histDays = 30;
  const pastTasks: TaskRow[] = [];

  for (let i = histDays; i >= 1; i--) {
    const dateObj = addDays(todayDate, -i);
    const d = dayKey(dateObj);
    const dow = dateObj.getDay();

    // Daily Hanon
    pastTasks.push({
      date: d, subjectId: pianoId, linkType: "item", itemId: hanon,
      title: "Hanon — Exercise 18", plan: plan(["RH","LH","Both"], [tLegato], 96, "sixteenth", [hanonEx18]),
      done: true, createdAt: now - i * D,
    });

    // Scales 5x/week
    if ([1,2,3,4,5].includes(dow)) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: scales,
        title: "Scales — 4 octaves HT",
        plan: plan(["Both"], [tLegato, tStaccato], 100 + Math.min(20, Math.floor((histDays - i) / 2)), "sixteenth"),
        done: true, createdAt: now - i * D,
      });
    }

    // Ballade — every other day
    if (i % 2 === 0) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: chopinBallade,
        title: "Ballade — first theme", plan: plan(["RH","LH","Slow"], [tVoicing, tLegato], 66, "quarter", [balladeA]),
        done: true, createdAt: now - i * D,
      });
    }

    // Bach — 3x/week (a few skipped)
    if (i % 3 === 0) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: bachWtcCsh,
        title: "Bach — Fugue exposition", plan: plan(["RH","LH","Both"], [tVoicing], 56, "quarter", [wtcFugue]),
        done: i > 4, skipped: i <= 4 ? false : undefined,
        createdAt: now - i * D,
      });
    }

    // Czerny — 2x/week
    if ([2, 6].includes(dow)) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: czerny740,
        title: "Czerny 740 — No. 5 staccato",
        plan: plan(["RH","LH","Both"], [tStaccato, tLegato], 110 + Math.min(10, Math.floor((histDays - i) / 3)), "sixteenth"),
        done: true, createdAt: now - i * D,
      });
    }

    // Harmony — 2x/week (theory layers)
    if ([2, 5].includes(dow)) {
      pastTasks.push({
        date: d, subjectId: harmonyId, linkType: "item", itemId: piston,
        title: "Piston — chapter exercises", plan: plan([...THEORY_LAYERS], [tFigured, tChorale]),
        done: true, createdAt: now - i * D,
      });
    }

    // Theory aural drill — once a week
    if (dow === 4) {
      pastTasks.push({
        date: d, subjectId: harmonyId, linkType: "item", itemId: secDom,
        title: "Aural drill — secondary dominants", plan: plan(["aural", "analytical"], [tModulation]),
        done: true, createdAt: now - i * D,
      });
    }
  }

  // Insert + create sessions for done ones
  for (let idx = 0; idx < pastTasks.length; idx++) {
    const t = pastTasks[idx];
    const id = (await db.tasks.add(t)) as number;
    if (!t.done) continue;

    const fullTask = await db.tasks.get(id);
    if (!fullTask) continue;
    const snapshot = await buildSessionSnapshot(fullTask);

    // Trend: more recent → higher confidence
    const ageDays = Math.round((todayDate.getTime() - new Date(t.date).getTime()) / D);
    const trend = clamp(70 + (histDays - ageDays) * 0.6, 40, 95);

    await db.sessions.add({
      taskId: id, ...sessionContext(fullTask), date: t.date,
      notes: idx % 5 === 0
        ? "Inner voices clearer today; pedaling lighter at the cadence."
        : undefined,
      marks: sessionMarks(t.plan, trend, idx * 7 + 1),
      snapshot,
      createdAt: now - (histDays - idx) * 3600000,
    });
  }

  // ---------- Multi-section history: Ballade Intro + A theme run-throughs ----------
  // Adds 8 past sessions with one mark per section so the segment breakdown views have real data.
  for (let k = 0; k < 8; k++) {
    const ageDays = 2 + k * 3; // 2, 5, 8, 11, ... days ago
    const d = dayKey(addDays(todayDate, -ageDays));
    const taskPlan = plan(["RH", "LH", "Both", "Slow"], [tVoicing, tLegato, tPedal], 68, "quarter", [balladeIntro, balladeA]);
    const taskId = (await db.tasks.add({
      date: d,
      subjectId: pianoId,
      linkType: "item",
      itemId: chopinBallade,
      title: "Ballade — Intro + First theme (slow run-through)",
      plan: taskPlan,
      done: true,
      createdAt: now - ageDays * D,
    })) as number;
    const fullTask = await db.tasks.get(taskId);
    if (!fullTask) continue;
    const snapshot = await buildSessionSnapshot(fullTask);

    // Intro slightly ahead of the first theme, both improving over time.
    await db.sessions.add({
      taskId,
      ...sessionContext(fullTask),
      date: d,
      notes: k % 3 === 0
        ? "Intro voicing settled; first theme still needs pedal cleanup at bar 16."
        : undefined,
      marks: sessionMarks(taskPlan, clamp(68 + (30 - ageDays) * 0.8, 45, 92), k * 31, (si) => (si === 0 ? 6 : -4)),
      snapshot,
      createdAt: now - ageDays * D + 3600000,
    });
  }

  // ---------- Extra multi-section histories (Bach P&F, Hanon 18, Cortot Ch.1) ----------
  const extraMultiSeg: Array<{
    itemId: number; segmentIds: number[]; title: string;
    targetBpm: number; noteVal: NoteVal;
    layers: string[]; techniques: number[]; count: number; step: number;
  }> = [
    {
      itemId: bachWtcCsh, segmentIds: [wtcPrelude, wtcFugue],
      title: "Bach C# minor P&F — full run",
      targetBpm: 60, noteVal: "quarter",
      layers: ["RH", "LH", "Both", "Memorized"],
      techniques: [tVoicing, tLegato],
      count: 6, step: 4,
    },
    {
      itemId: hanon, segmentIds: [hanonEx18],
      title: "Hanon 18 — HS then HT",
      targetBpm: 104, noteVal: "sixteenth",
      layers: ["RH", "LH", "Both"],
      techniques: [tLegato],
      count: 5, step: 2,
    },
    {
      itemId: cortot, segmentIds: [cortotCh1],
      title: "Cortot Ch. 1 — finger equality drill",
      targetBpm: 80, noteVal: "eighth",
      layers: ["RH", "LH"],
      techniques: [tLegato],
      count: 4, step: 5,
    },
  ];

  let extraSeed = 1000;
  for (const scenario of extraMultiSeg) {
    for (let k = 0; k < scenario.count; k++) {
      const ageDays = 3 + k * scenario.step;
      const d = dayKey(addDays(todayDate, -ageDays));
      const taskPlan = plan(scenario.layers, scenario.techniques, scenario.targetBpm, scenario.noteVal, scenario.segmentIds);
      const taskId = (await db.tasks.add({
        date: d, subjectId: pianoId, linkType: "item",
        itemId: scenario.itemId, title: scenario.title, plan: taskPlan,
        done: true, createdAt: now - ageDays * D,
      })) as number;
      const fullTask = await db.tasks.get(taskId);
      if (!fullTask) continue;
      const snapshot = await buildSessionSnapshot(fullTask);

      await db.sessions.add({
        taskId, ...sessionContext(fullTask), date: d,
        marks: sessionMarks(taskPlan, clamp(60 + (30 - ageDays) * 0.9, 40, 92), extraSeed + k * 29, (si) => (si === 0 ? 4 : -3)),
        snapshot,
        createdAt: now - ageDays * D + 7200000,
      });
      extraSeed += 7;
    }
  }

  // ---------- Today + upcoming ----------
  const upcoming: TaskRow[] = [];
  const todayKey = dayKey(todayDate);

  // Hanon — daily template
  const hanonPlan = plan(["RH","LH","Both"], [tLegato], 104, "sixteenth", [hanonEx18]);
  const hanonTpl = (await db.tasks.add({
    date: todayKey, subjectId: pianoId, linkType: "item", itemId: hanon,
    title: "Hanon — Exercise 18", plan: hanonPlan,
    done: false, createdAt: now,
    recurrence: { kind: "interval", everyXDays: 1, startDate: todayKey, occurrences: 14 },
  })) as number;
  for (let i = 1; i < 14; i++) {
    upcoming.push({
      date: dayKey(addDays(todayDate, i)), subjectId: pianoId, linkType: "item", itemId: hanon,
      title: "Hanon — Exercise 18", plan: hanonPlan,
      done: false, recurrenceTaskId: hanonTpl, createdAt: now,
    });
  }

  // Ballade — every other day
  const balladePlan = plan(["RH","LH","Slow"], [tVoicing, tLegato], 70, "quarter", [balladeA]);
  const balladeTpl = (await db.tasks.add({
    date: todayKey, subjectId: pianoId, linkType: "item", itemId: chopinBallade,
    title: "Ballade — first theme (slow, voicing)", plan: balladePlan,
    done: false, createdAt: now,
    recurrence: { kind: "interval", everyXDays: 2, startDate: todayKey, occurrences: 7 },
  })) as number;
  for (let i = 2; i <= 12; i += 2) {
    upcoming.push({
      date: dayKey(addDays(todayDate, i)), subjectId: pianoId, linkType: "item", itemId: chopinBallade,
      title: "Ballade — first theme (slow, voicing)", plan: balladePlan,
      done: false, recurrenceTaskId: balladeTpl, createdAt: now,
    });
  }

  // Bach fugue — Mon/Wed/Fri
  const bachPlan = plan(["RH","LH","Both"], [tVoicing], 60, "quarter", [wtcFugue]);
  const bachTpl = (await db.tasks.add({
    date: todayKey, subjectId: pianoId, linkType: "item", itemId: bachWtcCsh,
    title: "Bach — Fugue exposition", plan: bachPlan,
    done: false, createdAt: now,
    recurrence: { kind: "weekdays", days: [1, 3, 5], startDate: todayKey, occurrences: 9 },
  })) as number;
  for (let i = 1; i <= 21; i++) {
    const d = addDays(todayDate, i);
    if ([1, 3, 5].includes(d.getDay())) {
      upcoming.push({
        date: dayKey(d), subjectId: pianoId, linkType: "item", itemId: bachWtcCsh,
        title: "Bach — Fugue exposition", plan: bachPlan,
        done: false, recurrenceTaskId: bachTpl, createdAt: now,
      });
    }
  }

  // Harmony — Piston Tue/Fri
  const pistonPlan = plan([...THEORY_LAYERS], [tFigured, tChorale]);
  const pistonTpl = (await db.tasks.add({
    date: todayKey, subjectId: harmonyId, linkType: "item", itemId: piston,
    title: "Piston — chapter exercises", plan: pistonPlan,
    done: false, createdAt: now,
    recurrence: { kind: "weekdays", days: [2, 5], startDate: todayKey, occurrences: 8 },
  })) as number;
  for (let i = 1; i <= 28; i++) {
    const d = addDays(todayDate, i);
    if ([2, 5].includes(d.getDay())) {
      upcoming.push({
        date: dayKey(d), subjectId: harmonyId, linkType: "item", itemId: piston,
        title: "Piston — chapter exercises", plan: pistonPlan,
        done: false, recurrenceTaskId: pistonTpl, createdAt: now,
      });
    }
  }

  // One-off tasks for today — coda, multi-section, theory, collection
  upcoming.push({
    date: todayKey, subjectId: pianoId, linkType: "item", itemId: chopinBallade,
    title: "Ballade — Coda octaves (slow)", plan: plan(["RH","Slow"], [tOctaves], 90, "quarter", [balladeCoda]),
    done: false, createdAt: now,
  });

  upcoming.push({
    date: todayKey, subjectId: pianoId, linkType: "item", itemId: chopinBallade,
    title: "Ballade — Intro + First theme (slow run-through)",
    plan: plan(["RH","LH","Both","Slow"], [tVoicing, tLegato, tPedal], 70, "quarter", [balladeIntro, balladeA]),
    done: false, createdAt: now,
  });

  upcoming.push({
    date: todayKey, subjectId: harmonyId, linkType: "item", itemId: secDom,
    title: "Aural drill — secondary dominants", plan: plan(["aural", "compositional"], [tChorale, tModulation]),
    done: false, createdAt: now,
  });

  upcoming.push({
    date: dayKey(addDays(todayDate, 1)), subjectId: pianoId,
    linkType: "collection", collectionId: colNocturnesOp9,
    title: "Nocturnes Op. 9 — review session", plan: plan(["Both", "Memorized"], [tVoicing, tPedal]),
    done: false, createdAt: now,
  });

  upcoming.push({
    date: dayKey(addDays(todayDate, 2)), subjectId: pianoId,
    linkType: "collection", collectionId: colCzerny,
    title: "Czerny — daily set", plan: plan(["RH","LH","Both"], [tLegato, tStaccato]),
    done: false, createdAt: now,
  });

  await db.tasks.bulkAdd(upcoming);

  // Homework from past lessons that already became tasks: link it to the first task of the same piece.
  for (const { assignmentId, itemId } of linkedHomework) {
    const task = await db.tasks.where("itemId").equals(itemId).first();
    if (task?.id !== undefined) await lessonsService.linkTask(assignmentId, task.id);
  }

  // ---------- Study routine: 24 piano scales ----------
  // Mon/Tue/Thu/Fri (1, 2, 4, 5) — 3 majors + 3 minors per day.
  // Cap=1 per week so each scale is studied exactly once per week.
  {
    const majorsGroup = {
      id: "majors_" + now.toString(36),
      name: "Major scales",
      pool: majorSegmentIds.map((id) => ({ type: "segment" as const, id })),
    };
    const minorsGroup = {
      id: "minors_" + now.toString(36),
      name: "Minor scales",
      pool: minorSegmentIds.map((id) => ({ type: "segment" as const, id })),
    };
    const matrix: Record<string, Record<string, number>> = {};
    for (const dow of [1, 2, 4, 5]) {
      matrix[String(dow)] = { [majorsGroup.id]: 3, [minorsGroup.id]: 3 };
    }
    const { studyRoutinesService } = await import("./services");
    await studyRoutinesService.create({
      name: "Scale routine",
      subjectId: pianoId,
      groups: [majorsGroup, minorsGroup],
      matrix,
      weeksAhead: 4,
      repetitionCap: 1,
      useSpacedRepetition: false,
      startDate: dayKey(todayDate),
    });
  }

  // ---------- Help requests ----------
  await db.helpRequests.bulkAdd([
    {
      itemId: chopinBallade, taskId: balladeTpl,
      question: "How do you shape the inner-voice crescendo in mm. 28–32 without losing the bass line?",
      resolved: false, createdAt: now - 2 * D,
    },
    {
      itemId: bachWtcCsh,
      question: "Best fingering for the stretto entries in the C# minor Fugue?",
      resolved: false, createdAt: now - D,
    },
    {
      itemId: hanon,
      question: "Should I keep Hanon 18 at ♩=104 for another week or push?",
      answer: "Stay at 104 until perfectly even, then jump in 4-bpm steps.",
      answeredAt: now - 3 * D, resolved: true, createdAt: now - 5 * D,
    },
  ]);

  // ---------- Homework captured live in the upcoming lessons ----------
  const nextOn = (dow: number) => dayKey(addDays(todayDate, (dow - todayDate.getDay() + 7) % 7));
  const pianoLesson = await lessonsService.ensureFor(pianoId, await db.recurrences.get(lessonRecId), nextOn(wedDow));
  await lessonsService.addAssignment(pianoLesson, "Ballade — coda octaves at ♩=90, hands separately");
  await lessonsService.addAssignment(pianoLesson, "Record the Nocturne Op. 9 No. 2 and listen back");
  const harmonyLesson = await lessonsService.ensureFor(harmonyId, await db.recurrences.get(harmonyRecId), nextOn(2));
  await lessonsService.addAssignment(harmonyLesson, "Analyse two chorales for augmented sixth chords");
}

import { db, wipeAll, buildSessionSnapshot, buildLessonSnapshot, THEORY_LAYERS, type Task, type SessionQuality } from "./db";
import { dayKey, today } from "./recurrence";
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
// Deterministic pseudo-random in [0,1) from a seed (so re-seeding is stable).
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

export async function seedSampleData() {
  await wipeAll();
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
    lateRecoveryDays: 3,
    carryoverDays: 7,
    graceDay: true,
    groupByPhase: true,
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
    subjectId: pianoId, kind: "repertoire",
    title: "Ballade No. 1 in G minor, Op. 23", composer: "Chopin",
    status: "in_study", targetBpm: 76, noteVal: "quarter",
    techniqueIds: [tPedal, tArpeggios, tOctaves, tVoicing],
    createdAt: now - 90 * D,
  })) as number;

  const bachWtcCsh = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "WTC I — Prelude & Fugue in C# minor, BWV 849", composer: "Bach",
    status: "in_study", targetBpm: 60, noteVal: "quarter",
    techniqueIds: [tNoPedal, tLegato, tVoicing],
    createdAt: now - 60 * D,
  })) as number;

  const beethoven110 = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Sonata Op. 110 in A♭ major", composer: "Beethoven",
    status: "maintenance", targetBpm: 92, noteVal: "quarter",
    techniqueIds: [tPedal, tLegato, tVoicing],
    createdAt: now - 180 * D,
  })) as number;

  const nocturne9_2 = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Nocturne in E♭ major, Op. 9 No. 2", composer: "Chopin",
    status: "maintenance", targetBpm: 132, noteVal: "eighth",
    techniqueIds: [tPedal, tLegato, tTrills],
    createdAt: now - 220 * D,
  })) as number;

  const nocturne9_1 = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Nocturne in B♭ minor, Op. 9 No. 1", composer: "Chopin",
    status: "in_study", targetBpm: 116, noteVal: "eighth",
    techniqueIds: [tPedal, tLegato, tVoicing],
    createdAt: now - 40 * D,
  })) as number;

  const wtcCmaj = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "WTC I — Prelude & Fugue in C major, BWV 846", composer: "Bach",
    status: "maintenance", targetBpm: 72, noteVal: "quarter",
    techniqueIds: [tNoPedal, tLegato, tVoicing],
    createdAt: now - 240 * D,
  })) as number;

  const beethoven109 = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Sonata Op. 109 in E major", composer: "Beethoven",
    status: "in_study", targetBpm: 84, noteVal: "quarter",
    techniqueIds: [tPedal, tLegato, tVoicing, tTrills],
    createdAt: now - 35 * D,
  })) as number;

  // Manuals (4)
  const hanon = (await db.library.add({
    subjectId: pianoId, kind: "manual",
    title: "Hanon — The Virtuoso Pianist", composer: "Hanon",
    totalExercises: 60, currentExercise: 18,
    targetBpm: 108, noteVal: "sixteenth",
    techniqueIds: [tNoPedal, tLegato],
    createdAt: now - 150 * D,
  })) as number;

  const cortot = (await db.library.add({
    subjectId: pianoId, kind: "manual",
    title: "Cortot — Rational Principles of Pianoforte Technique", composer: "Cortot",
    totalExercises: 50, currentExercise: 7,
    targetBpm: 80, noteVal: "eighth",
    techniqueIds: [tArpeggios, tTrills],
    createdAt: now - 80 * D,
  })) as number;

  const czerny740 = (await db.library.add({
    subjectId: pianoId, kind: "manual",
    title: "Czerny — The Art of Finger Dexterity, Op. 740", composer: "Czerny",
    totalExercises: 50, currentExercise: 5,
    targetBpm: 120, noteVal: "sixteenth",
    techniqueIds: [tLegato, tStaccato, tArpeggios],
    createdAt: now - 70 * D,
  })) as number;

  const piston = (await db.library.add({
    subjectId: harmonyId, kind: "manual",
    title: "Piston — Harmony", composer: "Walter Piston",
    totalExercises: 32, currentExercise: 12,
    techniqueIds: [tFigured, tChorale],
    createdAt: now - 70 * D,
  })) as number;

  // Technique items (extra, not counted toward minimums)
  const scales = (await db.library.add({
    subjectId: pianoId, kind: "technique",
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
      itemId: scales, label: `${key} major`, targetBpm: 132, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      createdAt: now - 120 * D,
    })) as number;
    majorSegmentIds.push(id);
  }
  for (const key of MINORS) {
    const id = (await db.segments.add({
      itemId: scales, label: `${key} minor`, targetBpm: 132, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      createdAt: now - 120 * D,
    })) as number;
    minorSegmentIds.push(id);
  }


  const arpeggios = (await db.library.add({
    subjectId: pianoId, kind: "technique",
    title: "Dominant 7th arpeggios — all keys",
    startBpm: 70, targetBpm: 120, noteVal: "sixteenth",
    techniqueIds: [tArpeggios],
    createdAt: now - 110 * D,
  })) as number;

  // Theory (4)
  const secDom = (await db.library.add({
    subjectId: harmonyId, kind: "theory",
    title: "Secondary dominants & tonicization",
    mastery: { conceptual: 78, analytical: 70, aural: 55, compositional: 60, reading: 65 },
    techniqueIds: [tChorale, tModulation],
    createdAt: now - 50 * D,
  })) as number;

  const modMix = (await db.library.add({
    subjectId: harmonyId, kind: "theory",
    title: "Modal mixture & Neapolitan",
    mastery: { conceptual: 60, analytical: 55, aural: 40, compositional: 45, reading: 50 },
    techniqueIds: [tChorale],
    createdAt: now - 30 * D,
  })) as number;

  const speciesCpt = (await db.library.add({
    subjectId: harmonyId, kind: "theory",
    title: "Species counterpoint — first & second species",
    mastery: { conceptual: 70, analytical: 60, aural: 50, compositional: 65, reading: 55 },
    techniqueIds: [tCounter, tChorale],
    createdAt: now - 45 * D,
  })) as number;

  const augSixth = (await db.library.add({
    subjectId: harmonyId, kind: "theory",
    title: "Augmented sixth chords (It / Fr / Ger)",
    mastery: { conceptual: 50, analytical: 45, aural: 35, compositional: 40, reading: 40 },
    techniqueIds: [tChorale, tModulation],
    createdAt: now - 20 * D,
  })) as number;

  // ---------- Collections (4) ----------
  const colNocturnesOp9 = (await db.collections.add({
    kind: "repertoire",
    name: "Nocturnes, Op. 9", composer: "Chopin", catalog: "Op. 9",
    notes: "Three nocturnes dedicated to Madame Camille Pleyel.",
    color: "plum", defaultSubjectId: pianoId,
    createdAt: now - 60 * D, updatedAt: now,
  })) as number;

  const colWtcI = (await db.collections.add({
    kind: "repertoire",
    name: "Well-Tempered Clavier, Book I", composer: "Bach", catalog: "BWV 846–869",
    color: "blue", defaultSubjectId: pianoId,
    createdAt: now - 60 * D, updatedAt: now,
  })) as number;

  const colBeethovenLate = (await db.collections.add({
    kind: "repertoire",
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

  await db.collectionItems.bulkAdd([
    { collectionId: colNocturnesOp9, itemId: nocturne9_1, position: 1, createdAt: now },
    { collectionId: colNocturnesOp9, itemId: nocturne9_2, position: 2, createdAt: now },
    { collectionId: colWtcI,         itemId: bachWtcCsh,  position: 1, createdAt: now },
    { collectionId: colWtcI,         itemId: wtcCmaj,     position: 2, createdAt: now },
    { collectionId: colBeethovenLate, itemId: beethoven109, position: 1, createdAt: now },
    { collectionId: colBeethovenLate, itemId: beethoven110, position: 2, createdAt: now },
    { collectionId: colCzerny,       itemId: czerny740,   position: 1, createdAt: now },
  ]);

  // ---------- Segments ----------
  const seg = async (
    itemId: number, label: string, targetBpm: number,
    noteVal: "half" | "quarter" | "eighth" | "sixteenth",
    layers: string[], techniqueIds: number[]
  ) => (await db.segments.add({
    itemId, label, targetBpm, noteVal, layers, techniqueIds,
    createdAt: now - 60 * D,
  })) as number;

  const balladeIntro = await seg(chopinBallade, "mm. 1–8 — Introduction",   72, "quarter", ["RH","LH","Both"], [tVoicing, tPedal]);
  const balladeA     = await seg(chopinBallade, "mm. 9–36 — First theme",   76, "quarter", ["RH","LH","Both","Slow"], [tLegato, tVoicing]);
  const balladeB     = await seg(chopinBallade, "mm. 68–94 — Second theme", 84, "quarter", ["Both","In rhythm"], [tPedal, tVoicing]);
  const balladeCoda  = await seg(chopinBallade, "Presto con fuoco — Coda", 132, "quarter", ["RH","Slow"], [tOctaves, tArpeggios]);

  const wtcPrelude = await seg(bachWtcCsh, "Prelude — full",       60, "quarter", ["Both","Memorized"], [tLegato]);
  const wtcFugue   = await seg(bachWtcCsh, "Fugue — exposition",   56, "quarter", ["RH","LH","Both"], [tVoicing]);

  const hanonEx18 = await seg(hanon, "Exercise 18", 96, "sixteenth", ["RH","LH","Both"], [tLegato]);
  const cortotCh1 = await seg(cortot, "Chapter 1 — finger equality", 76, "eighth", ["RH","LH"], [tLegato]);

  // ---------- Lesson recurrences ----------
  const wedDow = 3;
  const lessonRecId = (await db.recurrences.add({
    subjectId: pianoId, teacher: "Prof. Aldo Ferri", frequency: "weekly",
    dayOfWeek: wedDow, startTime: "17:00", endTime: "18:00",
    startDate: dayKey(addDays(todayDate, -90)), color: "terracotta",
    createdAt: now - 100 * D,
  })) as number;

  const harmonyRecId = (await db.recurrences.add({
    subjectId: harmonyId, teacher: "Prof.ssa Lia Conti", frequency: "biweekly",
    dayOfWeek: 5, startTime: "10:00", endTime: "11:30",
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
      { subjectId: pianoId, teacher: "Prof. Aldo Ferri", frequency: "weekly",
        dayOfWeek: wedDow, startTime: "17:00", endTime: "18:00",
        startDate: dayKey(addDays(todayDate, -90)), color: "terracotta", createdAt: now } as any,
      pieceIds,
    );
    const lessonId = (await db.lessons.add({
      recurrenceId: lessonRecId, subjectId: pianoId, date: dayKey(d),
      notes: "Voicing of inner lines; pedaling for legato bass; tempo control.",
      piecesPlayed: pieceIds, piecesPlayedTitles, snapshot,
      createdAt: d.getTime(),
    })) as number;
    await db.assignments.bulkAdd(items.map((a) => ({
      lessonId, text: a.text, transformed: a.transformed, createdAt: d.getTime(),
    })));
  }

  // One past harmony lesson
  {
    const d = addDays(todayDate, -14);
    const pieceIds = [piston, secDom];
    const { snapshot, piecesPlayedTitles } = await buildLessonSnapshot(
      harmonyId,
      { subjectId: harmonyId, teacher: "Prof.ssa Lia Conti", frequency: "biweekly",
        dayOfWeek: 5, startTime: "10:00", endTime: "11:30",
        startDate: dayKey(addDays(todayDate, -84)), color: "blue", createdAt: now } as any,
      pieceIds,
    );
    const lessonId = (await db.lessons.add({
      recurrenceId: harmonyRecId, subjectId: harmonyId, date: dayKey(d),
      notes: "Reviewed secondary dominants; introduced Neapolitan sixth.",
      piecesPlayed: pieceIds, piecesPlayedTitles, snapshot,
      createdAt: d.getTime(),
    })) as number;
    await db.assignments.bulkAdd([
      { lessonId, text: "Realize 4 figured-bass exercises (Piston ch. 12)", transformed: true, createdAt: d.getTime() },
      { lessonId, text: "Aural drill: identify V/V vs V in 10 examples",    transformed: true, createdAt: d.getTime() },
      { lessonId, text: "Compose a short period using Neapolitan sixth",     transformed: false, createdAt: d.getTime() },
    ]);
  }

  // ---------- Tasks: history with sessions ----------
  type TaskRow = Parameters<typeof db.tasks.add>[0];

  const pickQuality = (n: number): SessionQuality =>
    (n >= 85 ? "great" : n >= 70 ? "well" : n >= 55 ? "improve" : "hard");

  const histDays = 30;
  const pastTasks: TaskRow[] = [];

  for (let i = histDays; i >= 1; i--) {
    const dateObj = addDays(todayDate, -i);
    const d = dayKey(dateObj);
    const dow = dateObj.getDay();

    // Daily Hanon
    pastTasks.push({
      date: d, subjectId: pianoId, linkType: "item", itemId: hanon, segmentIds: [hanonEx18],
      title: "Hanon — Exercise 18", targetBpm: 96, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      done: true, createdAt: now - i * D,
    });

    // Scales 5x/week
    if ([1,2,3,4,5].includes(dow)) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: scales,
        title: "Scales — 4 octaves HT",
        targetBpm: 100 + Math.min(20, Math.floor((histDays - i) / 2)),
        noteVal: "sixteenth", layers: ["Both"], techniqueIds: [tLegato, tStaccato],
        done: true, createdAt: now - i * D,
      });
    }

    // Ballade — every other day
    if (i % 2 === 0) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: chopinBallade, segmentIds: [balladeA],
        title: "Ballade — first theme", targetBpm: 66, noteVal: "quarter",
        layers: ["RH","LH","Slow"], techniqueIds: [tVoicing, tLegato],
        done: true, createdAt: now - i * D,
      });
    }

    // Bach — 3x/week (a few skipped)
    if (i % 3 === 0) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: bachWtcCsh, segmentIds: [wtcFugue],
        title: "Bach — Fugue exposition", targetBpm: 56, noteVal: "quarter",
        layers: ["RH","LH","Both"], techniqueIds: [tVoicing],
        done: i > 4, skipped: i <= 4 ? false : undefined,
        createdAt: now - i * D,
      });
    }

    // Czerny — 2x/week
    if ([2, 6].includes(dow)) {
      pastTasks.push({
        date: d, subjectId: pianoId, linkType: "item", itemId: czerny740,
        title: "Czerny 740 — No. 5 staccato",
        targetBpm: 110 + Math.min(10, Math.floor((histDays - i) / 3)), noteVal: "sixteenth",
        layers: ["RH","LH","Both"], techniqueIds: [tStaccato, tLegato],
        done: true, createdAt: now - i * D,
      });
    }

    // Harmony — 2x/week (theory layers)
    if ([2, 5].includes(dow)) {
      pastTasks.push({
        date: d, subjectId: harmonyId, linkType: "item", itemId: piston,
        title: "Piston — chapter exercises",
        layers: [...THEORY_LAYERS], techniqueIds: [tFigured, tChorale],
        done: true, createdAt: now - i * D,
      });
    }

    // Theory aural drill — once a week
    if (dow === 4) {
      pastTasks.push({
        date: d, subjectId: harmonyId, linkType: "item", itemId: secDom,
        title: "Aural drill — secondary dominants",
        layers: ["aural", "analytical"], techniqueIds: [tModulation],
        done: true, createdAt: now - i * D,
      });
    }
  }

  // Insert + create sessions for done ones, with full dimensions
  for (let idx = 0; idx < pastTasks.length; idx++) {
    const t = pastTasks[idx];
    const id = (await db.tasks.add(t)) as number;
    if (!t.done) continue;

    const fullTask = await db.tasks.get(id);
    if (!fullTask) continue;
    const snapshot = await buildSessionSnapshot(fullTask);

    const r = rand(idx + 1);
    const baseBpm = t.targetBpm ?? 0;
    const bpmReached = baseBpm
      ? clamp(Math.round(baseBpm - 6 + r * 10), 20, 400)
      : undefined;

    const layersUsed = t.layers ?? [];
    const techniquesUsed = t.techniqueIds ?? [];

    // Trend: more recent → higher scores
    const ageDays = Math.round((todayDate.getTime() - new Date(t.date).getTime()) / D);
    const trend = clamp(70 + (histDays - ageDays) * 0.6, 40, 95);

    const layerScores: Record<string, number> = {};
    layersUsed.forEach((l, k) => {
      layerScores[l] = clamp(Math.round(trend - 8 + rand(idx * 7 + k) * 16), 0, 100);
    });
    const techniqueScores: Record<number, number> = {};
    techniquesUsed.forEach((tid, k) => {
      techniqueScores[tid] = clamp(Math.round(trend - 10 + rand(idx * 11 + k) * 20), 0, 100);
    });

    const meanScore = (() => {
      const all = [...Object.values(layerScores), ...Object.values(techniqueScores)];
      return all.length ? all.reduce((a, b) => a + b, 0) / all.length : trend;
    })();

    await db.sessions.add({
      taskId: id, date: t.date,
      bpmReached, noteVal: t.noteVal,
      reps: t.targetBpm ? Math.round(4 + r * 8) : undefined,
      quality: pickQuality(meanScore),
      confidence: clamp(Math.round(meanScore / 20), 1, 5),
      notes: idx % 5 === 0
        ? "Inner voices clearer today; pedaling lighter at the cadence."
        : undefined,
      layersUsed, techniquesUsed,
      layerScores, techniqueScores,
      snapshot,
      createdAt: now - (histDays - idx) * 3600000,
    });
  }

  // ---------- Today + upcoming ----------
  const upcoming: TaskRow[] = [];

  // Hanon — daily template
  const hanonTpl = (await db.tasks.add({
    date: dayKey(todayDate), subjectId: pianoId, linkType: "item", itemId: hanon, segmentIds: [hanonEx18],
    title: "Hanon — Exercise 18", targetBpm: 104, noteVal: "sixteenth",
    layers: ["RH","LH","Both"], techniqueIds: [tLegato],
    done: false, createdAt: now,
    recurrence: { kind: "interval", everyXDays: 1, startDate: dayKey(todayDate), occurrences: 14 },
  })) as number;
  for (let i = 1; i < 14; i++) {
    upcoming.push({
      date: dayKey(addDays(todayDate, i)), subjectId: pianoId, linkType: "item", itemId: hanon, segmentIds: [hanonEx18],
      title: "Hanon — Exercise 18", targetBpm: 104, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      done: false, recurrenceTaskId: hanonTpl, createdAt: now,
    });
  }

  // Ballade — every other day
  const balladeTpl = (await db.tasks.add({
    date: dayKey(todayDate), subjectId: pianoId, linkType: "item", itemId: chopinBallade, segmentIds: [balladeA],
    title: "Ballade — first theme (slow, voicing)", targetBpm: 70, noteVal: "quarter",
    layers: ["RH","LH","Slow"], techniqueIds: [tVoicing, tLegato],
    done: false, createdAt: now,
    recurrence: { kind: "interval", everyXDays: 2, startDate: dayKey(todayDate), occurrences: 7 },
  })) as number;
  for (let i = 2; i <= 12; i += 2) {
    upcoming.push({
      date: dayKey(addDays(todayDate, i)), subjectId: pianoId, linkType: "item", itemId: chopinBallade, segmentIds: [balladeA],
      title: "Ballade — first theme (slow, voicing)", targetBpm: 70, noteVal: "quarter",
      layers: ["RH","LH","Slow"], techniqueIds: [tVoicing, tLegato],
      done: false, recurrenceTaskId: balladeTpl, createdAt: now,
    });
  }

  // Bach fugue — Mon/Wed/Fri
  const bachTpl = (await db.tasks.add({
    date: dayKey(todayDate), subjectId: pianoId, linkType: "item", itemId: bachWtcCsh, segmentIds: [wtcFugue],
    title: "Bach — Fugue exposition", targetBpm: 60, noteVal: "quarter",
    layers: ["RH","LH","Both"], techniqueIds: [tVoicing],
    done: false, createdAt: now,
    recurrence: { kind: "weekdays", days: [1, 3, 5], startDate: dayKey(todayDate), occurrences: 9 },
  })) as number;
  for (let i = 1; i <= 21; i++) {
    const d = addDays(todayDate, i);
    if ([1, 3, 5].includes(d.getDay())) {
      upcoming.push({
        date: dayKey(d), subjectId: pianoId, linkType: "item", itemId: bachWtcCsh, segmentIds: [wtcFugue],
        title: "Bach — Fugue exposition", targetBpm: 60, noteVal: "quarter",
        layers: ["RH","LH","Both"], techniqueIds: [tVoicing],
        done: false, recurrenceTaskId: bachTpl, createdAt: now,
      });
    }
  }

  // Harmony — Piston Tue/Fri
  const pistonTpl = (await db.tasks.add({
    date: dayKey(todayDate), subjectId: harmonyId, linkType: "item", itemId: piston,
    title: "Piston — chapter exercises",
    layers: [...THEORY_LAYERS], techniqueIds: [tFigured, tChorale],
    done: false, createdAt: now,
    recurrence: { kind: "weekdays", days: [2, 5], startDate: dayKey(todayDate), occurrences: 8 },
  })) as number;
  for (let i = 1; i <= 28; i++) {
    const d = addDays(todayDate, i);
    if ([2, 5].includes(d.getDay())) {
      upcoming.push({
        date: dayKey(d), subjectId: harmonyId, linkType: "item", itemId: piston,
        title: "Piston — chapter exercises",
        layers: [...THEORY_LAYERS], techniqueIds: [tFigured, tChorale],
        done: false, recurrenceTaskId: pistonTpl, createdAt: now,
      });
    }
  }

  // One-off tasks for today — coda, multi-segment, theory, collection
  upcoming.push({
    date: dayKey(todayDate), subjectId: pianoId, linkType: "item", itemId: chopinBallade, segmentIds: [balladeCoda],
    title: "Ballade — Coda octaves (slow)", targetBpm: 90, noteVal: "quarter",
    layers: ["RH","Slow"], techniqueIds: [tOctaves],
    done: false, createdAt: now,
  });

  upcoming.push({
    date: dayKey(todayDate), subjectId: pianoId, linkType: "item", itemId: chopinBallade,
    segmentIds: [balladeIntro, balladeA],
    title: "Ballade — Intro + First theme (slow run-through)",
    targetBpm: 70, noteVal: "quarter",
    layers: ["RH","LH","Both","Slow"], techniqueIds: [tVoicing, tLegato, tPedal],
    done: false, createdAt: now,
  });

  upcoming.push({
    date: dayKey(todayDate), subjectId: harmonyId, linkType: "item", itemId: secDom,
    title: "Aural drill — secondary dominants",
    layers: ["aural", "compositional"], techniqueIds: [tChorale, tModulation],
    done: false, createdAt: now,
  });

  upcoming.push({
    date: dayKey(addDays(todayDate, 1)), subjectId: pianoId,
    linkType: "collection", collectionId: colNocturnesOp9,
    title: "Nocturnes Op. 9 — review session",
    layers: ["Both", "Memorized"], techniqueIds: [tVoicing, tPedal],
    done: false, createdAt: now,
  });

  upcoming.push({
    date: dayKey(addDays(todayDate, 2)), subjectId: pianoId,
    linkType: "collection", collectionId: colCzerny,
    title: "Czerny — daily set",
    layers: ["RH","LH","Both"], techniqueIds: [tLegato, tStaccato],
    done: false, createdAt: now,
  });

  await db.tasks.bulkAdd(upcoming);

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
}

import { db, wipeAll } from "./db";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export async function seedSampleData() {
  await wipeAll();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const now = Date.now();

  // Profile
  await db.profile.put({
    id: "me",
    name: "Clara Rinaldi",
    lang: "en",
    reminderTime: "18:30",
    reminderFreq: "daily",
    reminderDays: [0, 1, 2, 3, 4, 5, 6],
    lateRecoveryDays: 3,
    graceDay: true,
    groupByPhase: true,
    onboarded: true,
    createdAt: now - 1000 * 60 * 60 * 24 * 200,
  });

  // Subjects (with layers)
  const pianoId = (await db.subjects.add({
    name: "Piano", type: "instrument",
    layers: ["RH", "LH", "Both", "Slow", "In rhythm", "Memorized"],
    createdAt: now - 1000 * 60 * 60 * 24 * 200,
  })) as number;
  const harmonyId = (await db.subjects.add({
    name: "Harmony", type: "theory",
    layers: ["Analysis", "Realization", "Aural", "At keyboard"],
    createdAt: now - 1000 * 60 * 60 * 24 * 200,
  })) as number;

  // Techniques
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

  // Library — Piano
  const chopinBallade = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Ballade No. 1 in G minor, Op. 23",
    composer: "Chopin",
    status: "in_study",
    targetBpm: 76, noteVal: "quarter",
    techniqueIds: [tPedal, tArpeggios, tOctaves, tVoicing],
    createdAt: now - 1000 * 60 * 60 * 24 * 90,
  })) as number;

  const bachWtc = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "WTC I — Prelude & Fugue in C# minor, BWV 849",
    composer: "Bach",
    status: "in_study",
    targetBpm: 60, noteVal: "quarter",
    techniqueIds: [tNoPedal, tLegato, tVoicing],
    createdAt: now - 1000 * 60 * 60 * 24 * 60,
  })) as number;

  const beethoven = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Sonata Op. 110 in A♭ major",
    composer: "Beethoven",
    status: "maintenance",
    targetBpm: 92, noteVal: "quarter",
    techniqueIds: [tPedal, tLegato, tVoicing],
    createdAt: now - 1000 * 60 * 60 * 24 * 180,
  })) as number;

  const hanon = (await db.library.add({
    subjectId: pianoId, kind: "manual",
    title: "Hanon — The Virtuoso Pianist",
    composer: "Hanon",
    totalExercises: 60, currentExercise: 18,
    targetBpm: 108, noteVal: "sixteenth",
    techniqueIds: [tNoPedal, tLegato],
    createdAt: now - 1000 * 60 * 60 * 24 * 150,
  })) as number;

  const cortot = (await db.library.add({
    subjectId: pianoId, kind: "manual",
    title: "Cortot — Rational Principles of Pianoforte Technique",
    composer: "Cortot",
    totalExercises: 50, currentExercise: 7,
    targetBpm: 80, noteVal: "eighth",
    techniqueIds: [tArpeggios, tTrills],
    createdAt: now - 1000 * 60 * 60 * 24 * 80,
  })) as number;

  const scales = (await db.library.add({
    subjectId: pianoId, kind: "technique",
    title: "Major & minor scales — 4 octaves, hands together",
    composer: "Brahms (51 Exercises)",
    startBpm: 80, targetBpm: 132, noteVal: "sixteenth",
    techniqueIds: [tLegato, tStaccato],
    createdAt: now - 1000 * 60 * 60 * 24 * 120,
  })) as number;

  const arpeggios = (await db.library.add({
    subjectId: pianoId, kind: "technique",
    title: "Dominant 7th arpeggios — all keys",
    startBpm: 70, targetBpm: 120, noteVal: "sixteenth",
    techniqueIds: [tArpeggios],
    createdAt: now - 1000 * 60 * 60 * 24 * 110,
  })) as number;

  // Library — Harmony
  const piston = (await db.library.add({
    subjectId: harmonyId, kind: "manual",
    title: "Piston — Harmony",
    composer: "Walter Piston",
    totalExercises: 32, currentExercise: 12,
    techniqueIds: [tFigured, tChorale],
    createdAt: now - 1000 * 60 * 60 * 24 * 70,
  })) as number;

  const secDom = (await db.library.add({
    subjectId: harmonyId, kind: "theory",
    title: "Secondary dominants & tonicization",
    mastery: { conceptual: 78, analytical: 70, aural: 55, compositional: 60 },
    techniqueIds: [tChorale, tModulation],
    createdAt: now - 1000 * 60 * 60 * 24 * 50,
  })) as number;

  const modMix = (await db.library.add({
    subjectId: harmonyId, kind: "theory",
    title: "Modal mixture & Neapolitan",
    mastery: { conceptual: 60, analytical: 55, aural: 40, compositional: 45 },
    techniqueIds: [tChorale],
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
  })) as number;

  // ---- Extra repertoire to populate collections ----
  const nocturne9_1 = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Nocturne in B♭ minor, Op. 9 No. 1",
    composer: "Chopin",
    status: "in_study",
    targetBpm: 116, noteVal: "eighth",
    techniqueIds: [tPedal, tLegato, tVoicing],
    createdAt: now - 1000 * 60 * 60 * 24 * 40,
  })) as number;

  const nocturne9_2 = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Nocturne in E♭ major, Op. 9 No. 2",
    composer: "Chopin",
    status: "maintenance",
    targetBpm: 132, noteVal: "eighth",
    techniqueIds: [tPedal, tLegato, tTrills],
    createdAt: now - 1000 * 60 * 60 * 24 * 220,
  })) as number;

  const nocturne9_3 = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "Nocturne in B major, Op. 9 No. 3",
    composer: "Chopin",
    status: "in_study",
    targetBpm: 76, noteVal: "quarter",
    techniqueIds: [tPedal, tLegato, tVoicing],
    createdAt: now - 1000 * 60 * 60 * 24 * 20,
  })) as number;

  const wtcCmaj = (await db.library.add({
    subjectId: pianoId, kind: "repertoire",
    title: "WTC I — Prelude & Fugue in C major, BWV 846",
    composer: "Bach",
    status: "maintenance",
    targetBpm: 72, noteVal: "quarter",
    techniqueIds: [tNoPedal, tLegato, tVoicing],
    createdAt: now - 1000 * 60 * 60 * 24 * 240,
  })) as number;

  // ---- Collections ----
  const colNocturnesOp9 = (await db.collections.add({
    name: "Nocturnes, Op. 9",
    composer: "Chopin",
    catalog: "Op. 9",
    notes: "Three nocturnes dedicated to Madame Camille Pleyel.",
    color: "plum",
    defaultSubjectId: pianoId,
    createdAt: now - 1000 * 60 * 60 * 24 * 60,
    updatedAt: now,
  })) as number;

  const colWtcI = (await db.collections.add({
    name: "Well-Tempered Clavier, Book I",
    composer: "Bach",
    catalog: "BWV 846–869",
    color: "blue",
    defaultSubjectId: pianoId,
    createdAt: now - 1000 * 60 * 60 * 24 * 60,
    updatedAt: now,
  })) as number;

  const colBeethovenLate = (await db.collections.add({
    name: "Late Beethoven Sonatas",
    composer: "Beethoven",
    catalog: "Op. 101–111",
    color: "terracotta",
    defaultSubjectId: pianoId,
    createdAt: now - 1000 * 60 * 60 * 24 * 60,
    updatedAt: now,
  })) as number;

  await db.collectionItems.bulkAdd([
    { collectionId: colNocturnesOp9, itemId: nocturne9_1, createdAt: now },
    { collectionId: colNocturnesOp9, itemId: nocturne9_2, createdAt: now },
    { collectionId: colNocturnesOp9, itemId: nocturne9_3, createdAt: now },
    { collectionId: colWtcI, itemId: bachWtc, createdAt: now },
    { collectionId: colWtcI, itemId: wtcCmaj, createdAt: now },
    { collectionId: colBeethovenLate, itemId: beethoven, createdAt: now },
  ]);


  const seg = async (
    itemId: number, label: string, targetBpm: number, noteVal: any,
    _confidence: number, layers: string[], techniqueIds: number[]
  ) => (await db.segments.add({
    itemId, label, targetBpm, noteVal, layers, techniqueIds,
    createdAt: now - 1000 * 60 * 60 * 24 * 60,
  })) as number;

  const balladeIntro = await seg(chopinBallade, "mm. 1–8 — Introduction",  72, "quarter", 4, ["RH","LH","Both"], [tVoicing, tPedal]);
  const balladeA     = await seg(chopinBallade, "mm. 9–36 — First theme", 76, "quarter", 3, ["RH","LH","Both","Slow"], [tLegato, tVoicing]);
  const balladeB     = await seg(chopinBallade, "mm. 68–94 — Second theme",84, "quarter", 3, ["Both","In rhythm"], [tPedal, tVoicing]);
  const balladeCoda  = await seg(chopinBallade, "Presto con fuoco — Coda",132,"quarter", 2, ["RH","Slow"], [tOctaves, tArpeggios]);

  const wtcPrelude = await seg(bachWtc, "Prelude — full",   60, "quarter", 4, ["Both","Memorized"], [tLegato]);
  const wtcFugue   = await seg(bachWtc, "Fugue — exposition", 56, "quarter", 3, ["RH","LH","Both"], [tVoicing]);
  const wtcStretto = await seg(bachWtc, "Fugue — stretto",   58, "quarter", 2, ["Slow","Both"], [tVoicing]);

  const hanonEx18  = await seg(hanon, "Exercise 18", 96,  "sixteenth", 3, ["RH","LH","Both"], [tLegato]);
  const cortotCh1  = await seg(cortot,"Chapter 1 — finger equality", 76, "eighth", 3, ["RH","LH"], [tLegato]);

  // Lesson recurrence (weekly, Wednesdays)
  const wedDow = 3;
  const recStart = ymd(addDays(today, -90));
  const lessonRecId = (await db.recurrences.add({
    subjectId: pianoId, teacher: "Prof. Aldo Ferri", frequency: "weekly",
    dayOfWeek: wedDow, startTime: "17:00", endTime: "18:00",
    startDate: recStart, color: "terracotta",
    createdAt: now - 1000 * 60 * 60 * 24 * 100,
  })) as number;

  const harmonyRecId = (await db.recurrences.add({
    subjectId: harmonyId, teacher: "Prof.ssa Lia Conti", frequency: "biweekly",
    dayOfWeek: 5, startTime: "10:00", endTime: "11:30",
    startDate: ymd(addDays(today, -84)), color: "blue",
    createdAt: now - 1000 * 60 * 60 * 24 * 100,
  })) as number;

  // Past lessons + assignments
  const pastWeds: Date[] = [];
  for (let i = 84; i >= 7; i -= 7) {
    const d = addDays(today, -i);
    if (d.getDay() === wedDow || true) {
      // align on weekday
      const offset = (d.getDay() - wedDow + 7) % 7;
      pastWeds.push(addDays(d, -offset));
    }
  }
  const uniqueWeds = Array.from(new Set(pastWeds.map(ymd))).map((s) => new Date(s));

  for (const d of uniqueWeds.slice(-6)) {
    const lessonId = (await db.lessons.add({
      recurrenceId: lessonRecId, subjectId: pianoId, date: ymd(d),
      notes: "Voicing of inner lines; pedaling for legato bass; tempo control in coda.",
      piecesPlayed: [chopinBallade, bachWtc],
      createdAt: d.getTime(),
    })) as number;
    await db.assignments.bulkAdd([
      { lessonId, text: "Slow practice mm. 9–36 hands separately at ♩=60", transformed: true, createdAt: d.getTime() },
      { lessonId, text: "Hanon 18 at ♩=96, then ♩=104 next week",         transformed: true, createdAt: d.getTime() },
      { lessonId, text: "Memorize Bach Prelude entirely",                  transformed: false, createdAt: d.getTime() },
    ]);
  }

  // Tasks: history (past 30 days) + today + upcoming (next 14 days)
  const taskRows: Parameters<typeof db.tasks.add>[0][] = [];
  const sessionRows: Parameters<typeof db.sessions.add>[0][] = [];

  const pickQuality = (i: number) => (i % 7 === 0 ? "hard" : i % 3 === 0 ? "great" : "well");

  const histDays = 30;
  for (let i = histDays; i >= 1; i--) {
    const d = ymd(addDays(today, -i));

    // Hanon daily
    taskRows.push({
      date: d, subjectId: pianoId, itemId: hanon, segmentIds: [hanonEx18],
      title: "Hanon — Exercise 18", targetBpm: 96, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      done: true, createdAt: now - i * 86400000,
    });

    // Scales 5x/week
    if ([1,2,3,4,5].includes(addDays(today, -i).getDay())) {
      taskRows.push({
        date: d, subjectId: pianoId, itemId: scales,
        title: "Scales — 4 octaves HT", targetBpm: 100 + Math.min(20, Math.floor((histDays - i) / 2)),
        noteVal: "sixteenth", layers: ["Both"], techniqueIds: [tLegato],
        done: true, createdAt: now - i * 86400000,
      });
    }

    // Ballade work every other day
    if (i % 2 === 0) {
      taskRows.push({
        date: d, subjectId: pianoId, itemId: chopinBallade, segmentIds: [balladeA],
        title: "Ballade — first theme", targetBpm: 66, noteVal: "quarter",
        layers: ["RH","LH","Slow"], techniqueIds: [tVoicing, tLegato],
        done: true, createdAt: now - i * 86400000,
      });
    }

    // Bach 3x/week
    if (i % 3 === 0) {
      taskRows.push({
        date: d, subjectId: pianoId, itemId: bachWtc, segmentIds: [wtcFugue],
        title: "Bach — Fugue exposition", targetBpm: 56, noteVal: "quarter",
        layers: ["RH","LH","Both"], techniqueIds: [tVoicing],
        done: i > 4, createdAt: now - i * 86400000,
      });
    }

    // Harmony 2x/week
    if ([2, 5].includes(addDays(today, -i).getDay())) {
      taskRows.push({
        date: d, subjectId: harmonyId, itemId: piston,
        title: "Piston — chapter exercises", layers: ["Analysis","Realization"],
        techniqueIds: [tFigured, tChorale],
        done: true, createdAt: now - i * 86400000,
      });
    }
  }

  // Insert past tasks and create sessions for done ones
  for (let idx = 0; idx < taskRows.length; idx++) {
    const t = taskRows[idx];
    const id = (await db.tasks.add(t)) as number;
    if (t.done) {
      const baseBpm = t.targetBpm ?? 0;
      const reached = baseBpm ? Math.max(20, baseBpm - (idx % 6)) : undefined;
      sessionRows.push({
        taskId: id, date: t.date,
        bpmReached: reached, noteVal: t.noteVal,
        quality: pickQuality(idx) as any,
        notes: idx % 5 === 0 ? "Inner voices clearer today; pedaling lighter at the cadence." : undefined,
        layersUsed: t.layers, techniquesUsed: t.techniqueIds,
        createdAt: now - (histDays - idx) * 3600000,
      });
    }
  }
  if (sessionRows.length) await db.sessions.bulkAdd(sessionRows);

  // Today + upcoming tasks (recurring template + occurrences)
  const upcoming: Parameters<typeof db.tasks.add>[0][] = [];

  // Daily Hanon — template + 14 days
  const hanonTpl = (await db.tasks.add({
    date: ymd(today), subjectId: pianoId, itemId: hanon, segmentIds: [hanonEx18],
    title: "Hanon — Exercise 18", targetBpm: 104, noteVal: "sixteenth",
    layers: ["RH","LH","Both"], techniqueIds: [tLegato],
    done: false, createdAt: now,
    recurrence: { kind: "interval", everyXDays: 1, startDate: ymd(today), occurrences: 14 },
  })) as number;
  for (let i = 1; i < 14; i++) {
    upcoming.push({
      date: ymd(addDays(today, i)), subjectId: pianoId, itemId: hanon, segmentIds: [hanonEx18],
      title: "Hanon — Exercise 18", targetBpm: 104, noteVal: "sixteenth",
      layers: ["RH","LH","Both"], techniqueIds: [tLegato],
      done: false, recurrenceTaskId: hanonTpl, createdAt: now,
    });
  }

  // Ballade work — every other day for next 2 weeks
  const balladeTpl = (await db.tasks.add({
    date: ymd(today), subjectId: pianoId, itemId: chopinBallade, segmentIds: [balladeA],
    title: "Ballade — first theme (slow, voicing)", targetBpm: 70, noteVal: "quarter",
    layers: ["RH","LH","Slow"], techniqueIds: [tVoicing, tLegato],
    done: false, createdAt: now,
    recurrence: { kind: "interval", everyXDays: 2, startDate: ymd(today), occurrences: 7 },
  })) as number;
  for (let i = 2; i <= 12; i += 2) {
    upcoming.push({
      date: ymd(addDays(today, i)), subjectId: pianoId, itemId: chopinBallade, segmentIds: [balladeA],
      title: "Ballade — first theme (slow, voicing)", targetBpm: 70, noteVal: "quarter",
      layers: ["RH","LH","Slow"], techniqueIds: [tVoicing, tLegato],
      done: false, recurrenceTaskId: balladeTpl, createdAt: now,
    });
  }

  // Coda technique day-by-day (single tasks)
  upcoming.push({
    date: ymd(today), subjectId: pianoId, itemId: chopinBallade, segmentIds: [balladeCoda],
    title: "Ballade — Coda octaves (slow)", targetBpm: 90, noteVal: "quarter",
    layers: ["RH","Slow"], techniqueIds: [tOctaves],
    done: false, createdAt: now,
  });

  // Bach fugue exposition — Mon/Wed/Fri
  const bachTpl = (await db.tasks.add({
    date: ymd(today), subjectId: pianoId, itemId: bachWtc, segmentIds: [wtcFugue],
    title: "Bach — Fugue exposition", targetBpm: 60, noteVal: "quarter",
    layers: ["RH","LH","Both"], techniqueIds: [tVoicing],
    done: false, createdAt: now,
    recurrence: { kind: "weekdays", days: [1, 3, 5], startDate: ymd(today), occurrences: 9 },
  })) as number;
  for (let i = 1; i <= 21; i++) {
    const d = addDays(today, i);
    if ([1, 3, 5].includes(d.getDay())) {
      upcoming.push({
        date: ymd(d), subjectId: pianoId, itemId: bachWtc, segmentIds: [wtcFugue],
        title: "Bach — Fugue exposition", targetBpm: 60, noteVal: "quarter",
        layers: ["RH","LH","Both"], techniqueIds: [tVoicing],
        done: false, recurrenceTaskId: bachTpl, createdAt: now,
      });
    }
  }

  // Harmony — Piston twice a week
  const pistonTpl = (await db.tasks.add({
    date: ymd(today), subjectId: harmonyId, itemId: piston,
    title: "Piston — chapter exercises", layers: ["Analysis", "Realization"],
    techniqueIds: [tFigured, tChorale],
    done: false, createdAt: now,
    recurrence: { kind: "weekdays", days: [2, 5], startDate: ymd(today), occurrences: 8 },
  })) as number;
  for (let i = 1; i <= 28; i++) {
    const d = addDays(today, i);
    if ([2, 5].includes(d.getDay())) {
      upcoming.push({
        date: ymd(d), subjectId: harmonyId, itemId: piston,
        title: "Piston — chapter exercises", layers: ["Analysis", "Realization"],
        techniqueIds: [tFigured, tChorale],
        done: false, recurrenceTaskId: pistonTpl, createdAt: now,
      });
    }
  }

  // Secondary dominants — solo task today
  upcoming.push({
    date: ymd(today), subjectId: harmonyId, itemId: secDom, linkType: "item",
    title: "Aural drill — secondary dominants", layers: ["Aural", "At keyboard"],
    techniqueIds: [tChorale, tModulation],
    done: false, createdAt: now,
  });

  // Multi-segment task: Ballade Intro + First theme together
  upcoming.push({
    date: ymd(today), subjectId: pianoId, itemId: chopinBallade, linkType: "item",
    segmentIds: [balladeIntro, balladeA],
    title: "Ballade — Intro + First theme (slow run-through)",
    targetBpm: 70, noteVal: "quarter",
    layers: ["RH", "LH", "Both", "Slow"], techniqueIds: [tVoicing, tLegato, tPedal],
    done: false, createdAt: now,
  });

  // Collection-linked task: full Nocturnes Op. 9 review
  upcoming.push({
    date: ymd(addDays(today, 1)), subjectId: pianoId,
    linkType: "collection", collectionId: colNocturnesOp9,
    title: "Nocturnes Op. 9 — review session",
    layers: ["Both", "Memorized"], techniqueIds: [tVoicing, tPedal],
    done: false, createdAt: now,
  });

  // Backfill linkType="item" on prior item-linked rows for consistency
  for (const t of upcoming) {
    if (!t.linkType) t.linkType = t.itemId ? "item" : "free";
  }

  await db.tasks.bulkAdd(upcoming);

  // Help requests
  await db.helpRequests.bulkAdd([
    {
      itemId: chopinBallade, taskId: balladeTpl,
      question: "How do you shape the inner-voice crescendo in mm. 28–32 without losing the bass line?",
      resolved: false, createdAt: now - 86400000 * 2,
    },
    {
      itemId: bachWtc,
      question: "Best fingering for the stretto entries in the C# minor Fugue?",
      resolved: false, createdAt: now - 86400000,
    },
    {
      itemId: hanon,
      question: "Should I keep Hanon 18 at ♩=104 for another week or push?",
      answer: "Stay at 104 until perfectly even, then jump in 4-bpm steps.",
      answeredAt: now - 86400000 * 3, resolved: true, createdAt: now - 86400000 * 5,
    },
  ]);
}

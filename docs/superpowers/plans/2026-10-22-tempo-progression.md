# Tempo Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suggerire aumenti e riduzioni del tempo configurabili per routine e ricorrenza, confrontando correttamente figure ritmiche diverse e preservando storico e pianificazione personalizzata.

**Architecture:** Funzioni pure condivise per equivalenze, passi e valutazione; una regola sul proprietario e uno stato persistente per contesto. I casi d'uso preparano e confermano anteprime con transazioni Dexie; React usa comandi e query di presentazione esistenti. I conteggi derivano dalle sessioni, senza un secondo suggeritore o contatori persistiti.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind/shadcn, Zod 3, Dexie 4, Vitest 3, Testing Library e fake-indexeddb già installati; Web Audio e Capacitor Android già presenti.

**Spec:** [2026-10-22-tempo-progression-design.md](../specs/2026-10-22-tempo-progression-design.md), approvata dall'utente dopo il commit `4d3e558`.

## Global Constraints

- «Un successo richiede tempo previsto raggiunto o superato e sicurezza almeno pari alla soglia S.»
- «N è il numero configurabile di successi necessari. M è facoltativo: se assente servono N successi consecutivi; se presente servono almeno N successi nelle ultime M sessioni valutabili.»
- «Se aumento e riduzione sono entrambi ammissibili, prevale la riduzione.»
- «Registrazioni prive dei dati necessari sono non valutabili ed escluse da N/M/K.»
- «Il target finale del brano/sezione non limita gli aumenti.»
- «I BPM inseriti e salvati restano interi; il limite inferiore passa da 20 a 1, quello superiore resta 400. La rappresentazione interna delle equivalenze non ha questi limiti.»
- «Ogni variazione richiede accettazione esplicita, con motivazione e anteprima.»
- «Nessun interprete di formule, sistema di plugin o nuova dipendenza.»
- «Traduzioni nelle quattro lingue già supportate: italiano, inglese, spagnolo e tedesco.»
- Preservare le modifiche preesistenti: nessun reset, pulizia, stash automatico o commit cumulativo del workspace. Nei file già modificati selezionare solo le proprie modifiche con `git add -p`; verificare sempre il contenuto staged prima del commit.
- Il piano autorizza solo documentazione. L'implementazione richiede revisione del piano e scelta del metodo di esecuzione.

## Review Focus

1. Una routine combinata può avere `linkType: "free"` e nessun `itemId`: risolvere il proprietario del singolo segmento e non unire materiali diversi. Test in Task 3 e 5.
2. Una bozza aperta prima di un cambio di ciclo può essere salvata dopo, anche retrodatata: conservarne il riferimento originale senza attribuirla al ciclo nuovo. Test in Task 3 e 7.
3. M può superare le osservazioni disponibili, alcune incomplete: N successi valutabili possono già bastare; le assenze non sono fallimenti. Test in Task 2.
4. Percentuali piccole, passi fra figure e limiti 1/400 possono rendere nullo o non rappresentabile il cambiamento: mostrare il risultato reale o il limite, senza falso progresso. Test in Task 1 e 2.
5. Due schede, una regola modificata o un task personalizzato dopo l'anteprima: nessun doppio aumento o aggiornamento parziale; presentare l'anteprima aggiornata. Test in Task 4 e 7.

---

## Punto di partenza e sequenza

Il repository esaminato ha schema Dexie fino a v17, esportazione backup v5 e importazione v4/v5. `PRODUCT.md` riporta ancora v4 e un contratto di compatibilità più restrittivo: prevale la specifica approvata, che conserva i formati già supportati. Usare v18 per la nuova migrazione e v6 per il nuovo backup; se nel frattempo arrivano altre versioni, usare la successiva senza rinumerare migrazioni esistenti.

Prima di iniziare l'esecuzione registrare `git status --short`, i diff preesistenti e il risultato di `npm run ci`. Gli eventuali errori iniziali vanno distinti da quelli introdotti. Rileggere i simboli interessati tramite codebase-memory-mcp; aggiornare l'indice solo se necessario. Un'eventuale worktree non deve perdere le modifiche non ancora committate richieste dal codice corrente.

Ordine: Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Ogni task mantiene il prodotto avviabile; i nuovi flussi restano inattivi finché non esiste una regola confermata.

## Contratto UI Impeccable

Il contesto Impeccable è stato caricato una volta con target `RoutineBuilder.tsx`; questa è una superficie **Operate** dentro il sistema esistente «Practice Taccuino». Il brief è già determinato dalla specifica approvata:

- Musicista al leggio, spesso su telefono: registrare lo studio rimane l'azione principale. La configurazione vive nei form esistenti; nessuna nuova pagina o procedura obbligatoria per registrare una sessione.
- Sezione «Progressione del tempo» con attivazione e campi condizionali. Mostrare «Successi necessari», «Finestra di sessioni — facoltativa», «Sicurezza minima», «Aumento» e «Riduzione facoltativa», non le sole lettere N/M/S/K. Con M vuoto: «Richiede successi consecutivi».
- Proposta iniziale con fonte storica; proposta successiva con tempo corrente, nuovo tempo, motivo e azione «Rivedi aggiornamento». Anteprima inline con conteggio, date ed esclusioni; conferma «Applica a {count} attività». Per zero task: «Salva per le prossime attività».
- Conservare token, font e componenti di `DESIGN.md`: titoli serif, controlli sans, numeri tabulari, colore primario per le azioni, stati distinti dal solo colore, bersagli di almeno 44px. Una colonna sul telefono; i campi paralleli possono affiancarsi quando c'è spazio. Testi e footer devono andare a capo senza scorrimento orizzontale.
- Stato inattivo, inizializzazione, mantenimento, aumento, riduzione, target raggiunto, dato insufficiente, limite numerico, caricamento, errore e anteprima obsoleta devono avere un esito comprensibile. Preservare valori e focus dopo errori; durante il salvataggio bloccare conferme ripetute. Una sola anteprima aperta per volta, anche con molte sezioni.

Prima delle future modifiche UI leggere `/home/giulio/.agents/skills/impeccable/reference/craft-floor.md`; non occorre per scrivere questo piano. Dopo le modifiche guardare le schermate renderizzate nelle dimensioni elencate nella verifica finale e lanciare una sola volta il detector sui file UI cambiati. Nessuna riparazione collaterale dei documenti di design.

## Mappa dei file e contratti condivisi

| File | Responsabilità |
|---|---|
| `src/domain/logic/tempo.ts` — nuovo | Normalizzazione, conversione, confronto e applicazione esatta/arrotondata dei passi |
| `src/domain/entities/tempoProgression.ts` — nuovo | Tipi della regola, identità, stato, riferimenti, osservazioni e valutazione |
| `src/domain/logic/tempoProgression.ts` — nuovo | Contesto canonico, selezione iniziale, conteggi e riconoscimento del target |
| `src/domain/ports/tempoProgression.ts` — nuovo | Lettura del proprietario, storico pertinente e operazioni transazionali |
| `src/infrastructure/repositories/dexie/tempoProgressionRepository.ts` — nuovo | Persistenza e query circoscritte; lifecycle atomico delle regole |
| `src/application/useCases/tempoProgression.ts` — nuovo | Lettura per la UI, anteprima, controllo di obsolescenza e accettazione |
| `src/components/diary/TempoProgressionFields.tsx` — nuovo | Campi condivisi da routine e ricorrenze |
| `src/components/diary/BpmSuggestion.tsx` — esistente | Proposte per contesto e anteprima; sostituisce il comportamento precedente |
| Modelli, piani, repository, generazione, backup, metriche e chiamanti indicati nei task | Integrazione completa dei contratti, senza duplicare la logica |

Fissare questi nomi una volta e usarli in tutti i task:

```ts
// common.ts: tipi musicali riusati anche fuori dalla progressione.
type Tempo = { bpm: number; noteVal: NoteVal };
type TempoStep =
  | { kind: "fixed"; value: number; noteVal: NoteVal }
  | { kind: "percent"; value: number };

// entities/tempoProgression.ts
type TempoOwner = { kind: "routine" | "recurrence"; id: number };
type TempoContext = { itemId: number; segmentId?: number; layers: string[]; techniques: number[] };
type TempoProgressionRule = {
  enabled: boolean; successes: number; window?: number; minConfidence: number;
  increase: TempoStep; decrease?: { failures: number; step: TempoStep };
};
type TempoProgressionRef = { id: number; cycle: number; minConfidence: number };
type TempoProgression = {
  id: number; owner: TempoOwner; context: TempoContext; contextKey: string;
  tempo: Tempo; cycle: number; startedAt: number; ruleRevision: number;
};
type TempoObservation = {
  sessionId: number; taskId?: number; date: string; createdAt: number;
  context: TempoContext; mark: SegmentMark;
};
type TempoEvaluation = {
  evaluated: number; successes: number; trailingSuccesses: number; trailingFailures: number;
  suggestion?: { direction: "increase" | "decrease"; tempo: Tempo; reason: "successes" | "failures" };
  blocked?: "tempo-out-of-range";
};
```

I blocchi sono contratti, non copie di implementazioni. Esportare i tipi dai file indicati, riusando gli import esistenti di `NoteVal` e `SegmentMark`. Non introdurre un barrel nuovo.

### Task 1: Equivalenze, passi e range BPM coerente

**Files:** Create `src/domain/logic/tempo.ts`, `src/domain/logic/tempo.test.ts`. Modify `src/domain/entities/common.ts`, `src/domain/constants/noteValues.ts`, `src/lib/schemas.ts`, `src/components/library/BpmCoupler.tsx`, `src/components/library/LibraryItemKindFields.tsx`, `src/components/diary/PracticeMode.tsx`. Test `src/lib/schemas.test.ts`, `src/components/diary/PracticeMode.test.tsx`, `src/test/libraryControls.test.tsx`.

**Interfaces:** Produce `Tempo`, `TempoStep`; `normalizedTempo(tempo: Tempo): number`; `convertTempo(tempo: Tempo, noteVal: NoteVal): number`; `compareTempos(a: Tempo, b: Tempo): number`; `stepTempo(current: Tempo, step: TempoStep, direction: "increase" | "decrease"): Tempo | undefined`. Esportare `BPM_MIN = 1`, `BPM_MAX = 400` da `noteValues.ts` e riusarli nei chiamanti.

- [ ] **Step 1 — Scrivere i test rossi.** In `tempo.test.ts` coprire i pesi 16/8/4/2/1/12/6/3 e queste asserzioni; aggiungere tutti gli equivalenti della spec e il round trip senza arrotondare.

```ts
expect(normalizedTempo({ bpm: 50, noteVal: "quarter" })).toBe(200);
expect(compareTempos({ bpm: 50, noteVal: "quarter" }, { bpm: 100, noteVal: "eighth" })).toBe(0);
expect(convertTempo({ bpm: 50, noteVal: "quarter" }, "dotted-quarter")).toBeCloseTo(100 / 3);
expect(stepTempo({ bpm: 50, noteVal: "quarter" }, { kind: "fixed", value: 1, noteVal: "eighth" }, "increase"))
  .toEqual({ bpm: 101, noteVal: "eighth" });
expect(stepTempo({ bpm: 70, noteVal: "quarter" }, { kind: "percent", value: 3 }, "increase"))
  .toEqual({ bpm: 72, noteVal: "quarter" });
expect(stepTempo({ bpm: 70, noteVal: "quarter" }, { kind: "percent", value: 0.1 }, "increase"))
  .toEqual({ bpm: 71, noteVal: "quarter" });
expect(stepTempo({ bpm: 1, noteVal: "quarter" }, { kind: "percent", value: 5 }, "decrease"))
  .toBeUndefined();
```

In `schemas.test.ts`: accettare 1/10/400, rifiutare 0/401/NaN/frazioni come BPM assoluti. Nei test Web Audio esistenti: a 1 BPM due click distano 60 secondi; passando a 120 il beat successivo usa il nuovo intervallo, senza attendere un minuto. Simulare anche una lunga sospensione senza raffica di recupero. Usare fake timer e clock audio controllato, non attese reali.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/domain/logic/tempo.test.ts src/lib/schemas.test.ts src/components/diary/PracticeMode.test.tsx src/test/libraryControls.test.tsx`. Atteso: fallimenti per helper assenti/range 20 e per eventuale intervallo audio rimasto al vecchio BPM; correggere prima eventuali errori di setup.
- [ ] **Step 3 — Implementare il minimo.** Normalizzare con pesi interi. Per i passi fissi cercare una rappresentazione intera esatta: figura corrente, figura del passo, ordine `NOTE_VALUES`, scartando coppie fuori range. Per le percentuali arrotondare nella figura corrente con metà verso l'alto e differenza minima 1; non applicare un risultato non positivo. Se occorre una figura equivalente per un risultato già calcolato fuori range, cambiarne soltanto la rappresentazione. Nei controlli aggiornare i limiti condivisi; nel metronomo conservare lo scheduler Web Audio e ricalcolare la prossima scadenza al cambio di tempo, senza riscrivere il sistema audio.
- [ ] **Step 4 — Verificare il verde.** Ripetere il comando dello Step 2; atteso PASS. Controllare che cambiare figura per rappresentare un passo non alteri la velocità e che gli input originali non siano mutati.
- [ ] **Step 5 — Commit.** Stage selettivo dei file sopra, controllo `git diff --cached --check` e commit `feat: compare equivalent tempos and support low BPM`.

### Task 2: Regole, contesti e motore puro

**Files:** Create `src/domain/entities/tempoProgression.ts`, `src/domain/logic/tempoProgression.ts`, `src/domain/logic/tempoProgression.test.ts`. Modify `src/domain/entities/common.ts`, `src/domain/entities/task.ts`, `src/domain/ports/studyRoutine.ts`, `src/lib/schemas.ts`. Test `src/lib/schemas.test.ts`.

**Interfaces:** Consuma Task 1. Produce i tipi condivisi sopra; `tempoContextKey(context: TempoContext): string`; `resolveTempoContext(task: Task, entry: SegmentEntry, segments: readonly Segment[]): TempoContext | undefined`; `initialTempo(context: TempoContext, observations: readonly TempoObservation[], minConfidence: number): TempoObservation | undefined`; `evaluateTempoProgression(rule: TempoProgressionRule, state: TempoProgression, observations: readonly TempoObservation[], cycleStartDate: string): TempoEvaluation`; `targetEvidence(state: TempoProgression, observations: readonly TempoObservation[], target: Tempo): TempoObservation | undefined`.

Definire anche `TempoPlanUpdate = { taskId: number; date: string; plan: SegmentEntry[] }` e `TempoPlanExclusion = { taskId: number; reason: "source" | "studied" | "customized" | "closed" | "past" }` nel file dei tipi. La funzione condivisa `planTempoUpdates(input: { owner: TempoOwner; context: TempoContext; tempo: Tempo; reference?: TempoProgressionRef; tasks: readonly Task[]; observations: readonly TempoObservation[]; segments: readonly Segment[]; fromDate: string; sourceTaskId?: number }): { updates: TempoPlanUpdate[]; excluded: TempoPlanExclusion[] }` determina una sola volta le entry modificabili per cambio regola e accettazione. La reference è assente solo nell'anteprima iniziale, prima che esista uno stato con ID: la voce proposta non conserva eventuali vecchi riferimenti incompatibili. L'accettazione la ricalcola con l'ID realmente assegnato, senza usare ID provvisori. Per verificare se una voce è già stata studiata usare `taskId` e sezione anche se il risultato non è valutabile o appartiene a un altro contesto di livelli/tecniche. Non elencare come esclusioni task senza entry del contesto richiesto.

Aggiungere `progression?: TempoProgressionRef` a `SegmentEntry`, ereditato da `SegmentMark`; `tempoRule?: TempoProgressionRule` e `tempoRuleRevision?: number` a `Task` e `StudyRoutine`. Definire `tempoStepSchema`, `tempoRuleSchema`, `tempoProgressionRefSchema`, `tempoProgressionSchema`; riusarli nelle estensioni degli schemi esistenti. Il form normalizza M vuoto in `undefined`, lo schema non interpreta `""` come zero.

- [ ] **Step 1 — Scrivere i test rossi.** Definire fixture locali `rule` con N=3/M=5/S=4, aumento +2 alla semiminima e riduzione del 5% dopo K=2; `state` a 70 alla semiminima, ciclo 1, avviato il 22 ottobre; osservazioni complete con riferimento a quello stato. Verificare con asserzioni come queste, costruendo esplicitamente le sequenze indicate:

```ts
expect(resultForThreeSuccessesAndTwoFailures.suggestion).toEqual({
  direction: "decrease", tempo: { bpm: 67, noteVal: "quarter" }, reason: "failures",
});
expect(resultForThreeSuccessesWithWindowTen.suggestion?.direction).toBe("increase");
expect(resultWithMissingConfidence.evaluated).toBe(0);
expect(resultWithOldCycle.evaluated).toBe(0);
expect(resultWithConfidenceThree.trailingFailures).toBe(1);
expect(tempoContextKey({ itemId: 9, layers: ["RH", "LH", "RH"], techniques: [2, 1] }))
  .toBe(tempoContextKey({ itemId: 9, layers: ["LH", "RH"], techniques: [1, 2] }));
```

Aggiungere test distinti: senza M la sequenza successo/insuccesso/successo non aumenta; 140 alla croma equivale a 70 alla semiminima; cambio proprietario/contesto non contribuisce; registro con target di lavoro diverso escluso; ordinamento data/createdAt/ID stabile; data anteriore all'avvio esclusa; primo giorno distinto dal ciclo esplicito. `initialTempo` sceglie l'ultimo risultato con S sufficiente e non il massimo. `targetEvidence` usa la S storica e trova anche un risultato di un ciclo precedente, senza richiedere che il suo vecchio tempo di lavoro coincida con quello attuale.

Testare anche `planTempoUpdates` con un task futuro contenente una sezione compatibile e una estranea: cambia solo la prima. Se per la prima esiste una mark incompleta con lo stesso `taskId`/sezione, `expect(result.updates).toEqual([])` e `expect(result.excluded[0].reason).toBe("studied")`; il dato mancante non consente di riscrivere il piano eseguito.

Validare N/K interi positivi, M≥N, S=1…5, percentuali finite positive, riduzione percentuale <100 e passi fissi interi con figura. Testare `NaN`, `Infinity`, M=0, M<N e percentuale di riduzione 100.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/domain/logic/tempoProgression.test.ts src/lib/schemas.test.ts`; atteso FAIL sugli export/regole mancanti.
- [ ] **Step 3 — Implementare il minimo.** Canonicalizzare gli insiemi per valore stabile, risolvere il materiale del segmento anche nei task combinati e non usare titoli come identità. Ordinare copie delle osservazioni; deduplicare per sessione/contesto. Applicare il filtro del ciclo solo a N/M/K; per il target usare tutti i cicli dello stesso contesto e la S del risultato. Il motore non legge Date.now, database o traduzioni: riceve `cycleStartDate` e restituisce motivazioni strutturate. Lo storico non qualificato resta assente, senza figura o sicurezza inventate.
- [ ] **Step 4 — Verificare il verde.** Ripetere lo Step 2; atteso PASS e nessuna mutazione delle fixture condivise. Verificare la priorità della riduzione con entrambe le condizioni vere.
- [ ] **Step 5 — Commit.** Stage selettivo e commit `feat: evaluate configurable tempo progression rules`.

### Task 3: Stato durevole, cicli e backup compatibile

**Files:** Create `src/domain/ports/tempoProgression.ts`, `src/infrastructure/repositories/dexie/tempoProgressionRepository.ts`, `src/infrastructure/repositories/dexie/tempoProgressionRepository.test.ts`. Modify `src/infrastructure/dexie/db.ts`, `src/domain/entities/session.ts`, `src/domain/logic/plan.ts`, `src/lib/schemas.ts`, `src/application/useCases/logSession.ts`, `src/application/useCases/createTask.ts`, `src/application/useCases/exportBackup.ts`, `src/application/useCases/importBackup.ts`, `src/infrastructure/repositories/dexie/backupRepository.ts`, `src/infrastructure/repositories/dexie/sessionRepository.ts`, `src/infrastructure/repositories/dexie/taskRepository.ts`, `src/infrastructure/repositories/dexie/studyRoutineRepository.ts`, `src/domain/ports/session.ts`, `src/test/fakes/FakeSessionRepository.ts`, `src/test/fakes/FakeTaskRepository.ts`. Test `src/infrastructure/dexie/migration.test.ts`, `src/domain/logic/plan.test.ts`, `src/application/useCases/taskSession.test.ts`, `src/application/useCases/backup.test.ts`, `src/lib/services/backup.test.ts`.

**Interfaces:** `TempoOwnerData = { owner: TempoOwner; rule?: TempoProgressionRule; ruleRevision: number; states: TempoProgression[]; tasks: Task[]; observations: TempoObservation[]; segments: Segment[]; items: LibraryItem[] }`. Il port espone `read(owner: TempoOwner): Promise<TempoOwnerData>`, `history(context: TempoContext): Promise<TempoObservation[]>`, `configure(owner: TempoOwner, rule: TempoProgressionRule | undefined, at: number): Promise<void>` e `transaction<T>(operation: (tx: TempoProgressionTransaction) => Promise<T>): Promise<T>`.

`TempoProgressionTransaction` espone `read`, `history`, `putState(state: Omit<TempoProgression, "id"> & { id?: number }): Promise<number>` e `putPlan(taskId: number, plan: SegmentEntry[]): Promise<void>`. Le scritture sono implementate nell'adattatore; i calcoli restano nel dominio/caso d'uso.

La stessa consegna porta l'export alla versione 6 e `SUPPORTED_VERSIONS` a `[4, 5, 6]`. Persistenza e backup devono entrare insieme: l'export attuale enumera tutte le tabelle e una tabella nuova renderebbe altrimenti il backup rifiutato dal suo stesso importatore.

- [ ] **Step 1 — Scrivere i test rossi.** Usare fake-indexeddb e i reset già presenti. Verificare stato univoco per proprietario/contesto, lettura dopo riapertura, conservazione delle sessioni quando il task cambia o scompare, protezione della radice con figlie collegate. Salvare una sessione di task combinato con due segmenti di materiali diversi e assertare che i riferimenti delle due progressioni non si scambino.

```ts
expect(savedSession.marks[0].progression).toEqual({ id: 1, cycle: 1, minConfidence: 4 });
expect(savedSession.tempoProgressionIds).toEqual([1, 2]);
expect(savedAfterCycleChange.marks[0].progression?.cycle).toBe(1);
expect(currentState.cycle).toBe(2);
expect(afterMigration.sessions).toEqual(beforeMigration.sessions);
expect(afterMigration.tempoProgressions).toEqual([]);
```

Costruire `savedAfterCycleChange` da una bozza con riferimento al ciclo 1 prima di aggiornare lo stato al 2. Le modifiche a una sessione esistente conservano il riferimento originale, anche quando cambiano BPM o data. Il salvataggio di una sessione libera non assegna un proprietario. Una variazione del contesto fa escludere l'osservazione dal vecchio stato, senza riassegnarla automaticamente.

Nei test backup aggiungere round trip v6 con regola sulla radice, stato attivo e sessioni di due cicli; import v4/v5 senza progressioni; snapshot dell'archivio prima/dopo ogni import rifiutato. Verificare queste asserzioni e i casi elencati sotto:

```ts
expect(JSON.parse(exported).version).toBe(6);
expect(restoredState).toEqual(originalState);
expect(restoredMarks.map(m => m.progression)).toEqual(originalMarks.map(m => m.progression));
expect(restoredLegacyStates).toEqual([]);
expect(dataAfterRejectedImport).toEqual(dataBeforeRejectedImport);
```

Rifiutare proprietario inesistente, figlia usata come radice, materiale/segmento incoerenti, ID/reference mancanti o duplicati, contesti duplicati, M<N, percentuali non finite e revisioni/cicli impossibili. Accettare invece le reference valide dei cicli precedenti. Ricalcolare l'indice delle sessioni dalle marks, anche se il backup contiene un array indice contraffatto. Verificare che la rimozione della sola occorrenza radice conservi la regola applicabile alle figlie ancora attive.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/infrastructure/repositories/dexie/tempoProgressionRepository.test.ts src/infrastructure/dexie/migration.test.ts src/domain/logic/plan.test.ts src/application/useCases/taskSession.test.ts src/application/useCases/backup.test.ts src/lib/services/backup.test.ts`; atteso FAIL per archivio/metadati/versione backup assenti.
- [ ] **Step 3 — Implementare persistenza e lifecycle.** Migrazione v18 additiva: tabella `tempoProgressions` con `++id`, indice `[owner.kind+owner.id]` e indice univoco `[owner.kind+owner.id+contextKey]`; nessuna cancellazione o inferenza di stati dai vecchi dati. Le nuove sessioni hanno `tempoProgressionIds?: number[]`, proiezione ordinata e deduplicata dei riferimenti delle marks, indicizzata con `*tempoProgressionIds`: serve solo a cercare i risultati anche senza task, non è una seconda fonte di verità. Ricalcolarla a ogni scrittura di sessione; mantenere il corpo del risultato e i riferimenti nel backup.

`read(owner)` usa gli stati del proprietario e l'indice multivalore delle sessioni, unendo per ID anche le sessioni cercate con l'indice `taskId` dei suoi task: servono a preservare voci già studiate prima dell'attivazione. Includere le marks incomplete nelle osservazioni per la protezione dei piani; il filtro di valutabilità appartiene al motore. `history(context)` usa indici materiale/task/sezione pertinenti, riusando la risoluzione dei task combinati. Nessun caricamento dell'intero archivio a ogni render. Per ricorrenze usare `recurrenceTaskId ?? id` solo quando il task è davvero radice/figlia di una serie; un task ordinario non diventa una serie per avere un ID.

`configure` salva regola/revisione e aggiorna in una transazione i cicli degli stati e i riferimenti dei piani futuri aggiornabili, usando `planTempoUpdates`. Incrementa solo dopo una modifica effettiva, conserva i tempi, sospende con `enabled: false`; riattivazione crea un ciclo nuovo. La funzione viene riusata dal salvataggio della routine dentro la sua transazione, confrontando la regola precedente prima di sovrascriverla e senza due commit separati di regola e cicli. Alla creazione di una serie estendere `NewTaskInput` e salvare regola e revisione solo sulla radice: rimuoverle dallo spread che produce le figlie, sia nel caso d'uso sia nel percorso repository ancora esposto. Rifiutare una regola su un nuovo task privo di ricorrenza. Proteggere radici e proprietari collegati dagli hard delete che perderebbero la regola.

`marksFromPlan`, bozze e salvataggio trasferiscono la reference catturata nel piano, senza sostituirla con quella attuale del database. Il confronto del contesto nel motore impedisce attribuzioni errate quando l'utente cambia livelli/tecniche. Registrare i target previsti come già avviene. Un riferimento a uno stato inesistente è un errore, mentre una reference valida di un vecchio ciclo è storia ammissibile.

Per i backup estendere allowlist, parsing e controllo del grafo prima di `importAll`; un formato vecchio senza tabella nuova equivale a tabella vuota. Confrontare owner, contesto canonico e reference; non richiedere la revisione attuale per una reference storica e non inventare parametri mancanti. Riusare `BackupPort.exportAll/importAll` e l'enumerazione di `db.tables`, mantenendo transazione e politica audio esistenti. Aggiornare solo le fixture raggiunte; nessun nuovo protocollo o adattatore CSV.

- [ ] **Step 4 — Verificare il verde.** Ripetere lo Step 2 e aggiungere `npm run test -- src/lib/services/studyRoutines.test.ts`; atteso PASS. Testare `configure` invariato, modifica S, disattivazione/riattivazione e rollback provocando un errore nell'ultimo aggiornamento di piano: regola, cicli e piani devono restare quelli precedenti. Testare anche rollback dell'import e limiti BPM 1/400 nel round trip.
- [ ] **Step 5 — Commit.** Controllare le modifiche preesistenti a schema/sessioni/backup prima dello stage selettivo; commit `feat: persist and back up tempo progression cycles safely`.

### Task 4: Anteprima e accettazione atomica

**Files:** Create `src/application/useCases/tempoProgression.ts`, `src/application/useCases/tempoProgression.test.ts`, `src/test/fakes/FakeTempoProgressionRepository.ts`. Modify `src/infrastructure/repositories/dexie/tempoProgressionRepository.ts`, `src/infrastructure/compositionRoot.ts`, `src/infrastructure/dexie/presentationReadPort.ts`. Test `src/infrastructure/repositories/dexie/tempoProgressionRepository.test.ts`, `src/infrastructure/dexie/presentationReadPort.test.ts`.

**Interfaces:** Produce `TempoProgressionUseCase(repository: TempoProgressionPort, clock: () => number = Date.now)` con `view(owner: TempoOwner, context: TempoContext): Promise<TempoProgressionView>`, `preview(request: TempoChangeRequest): Promise<TempoProgressionPreview | null>`, `accept(preview: TempoProgressionPreview): Promise<TempoAcceptResult>`, `configure(owner: TempoOwner, rule: TempoProgressionRule | undefined): Promise<void>`.

Definire nello stesso file i read model esportati: `TempoChangeRequest = { owner: TempoOwner; context: TempoContext; initialTempo?: Tempo; sourceTaskId?: number }`; `TempoProgressionView = { state?: TempoProgression; rule?: TempoProgressionRule; initial?: TempoObservation; evaluation?: TempoEvaluation; evidence?: TempoObservation }`; `TempoProgressionPreview = { request: TempoChangeRequest; current?: Tempo; proposed: Tempo; expectedCycle?: number; expectedRuleRevision: number; fingerprint: string; updates: TempoPlanUpdate[]; excluded: TempoPlanExclusion[] }`; `TempoAcceptResult = { status: "applied"; state: TempoProgression } | { status: "stale"; preview: TempoProgressionPreview | null }`.

Esporre il caso d'uso come `applicationCommands.tempoProgression`. Nuova query `tempo.progression` con parametri `[owner, context]`, delegata al caso d'uso attraverso l'adattatore di presentazione; React usa `usePresentationRead` esistente. L'adattatore può costruire un'istanza del caso d'uso stateless con il repository condiviso, senza importare il composition root e creare un ciclo di dipendenze. Il caso d'uso non importa infrastruttura.

- [ ] **Step 1 — Scrivere i test rossi.** Fixture del fake: stato 70 alla semiminima, N=3/M=4/S=4, tre successi, due task futuri ordinari compatibili, uno personalizzato, uno completato, una voce già studiata e una sezione estranea in un task combinato. Verificare anteprima con due aggiornamenti, proposta 72 e conservazione della voce estranea.

```ts
expect(preview.proposed).toEqual({ bpm: 72, noteVal: "quarter" });
expect(preview.updates.map(u => u.taskId)).toEqual([2, 3]);
expect(result.status).toBe("applied");
expect(savedState.cycle).toBe(previousCycle + 1);
expect(secondAcceptance.status).toBe("stale");
expect(afterFailedCommit).toEqual(beforeFailedCommit);
```

In test distinti mutare, fra anteprima e accettazione: regola, nuova sessione, sicurezza di una vecchia sessione, flag `customized`, ordine/data delle attività. L'accettazione obsoleta non scrive. Provare due accettazioni concorrenti reali nell'integrazione Dexie: una sola può essere `applied`. Il fake simula rollback con copia dello stato, seguendo i fake esistenti.

Test di inizializzazione: storico da un'altra routine usato soltanto come fonte; tempo modificabile; nessun dato disponibile richiede `initialTempo`; il task ancora da studiare riceve piano/reference nuovi. Il `sourceTaskId` esclude soltanto il task della sessione già registrata che origina una variazione, non il task aperto per inizializzare. Verificare anche zero task aggiornabili, crescita oltre il target finale e mancato conteggio di una personalizzazione a un tempo diverso.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/application/useCases/tempoProgression.test.ts src/infrastructure/repositories/dexie/tempoProgressionRepository.test.ts src/infrastructure/dexie/presentationReadPort.test.ts`; atteso FAIL sui nuovi comandi.
- [ ] **Step 3 — Implementare il minimo.** Preparare proposta e piani da dati riletti; ricavare `cycleStartDate` con `dayKey(new Date(state.startedAt))` da `src/lib/date.ts`. Il fingerprint è una serializzazione canonica dei dati pertinenti a decisione e anteprima: versione regola, stato, osservazioni e piani/stati delle attività coinvolte. Non introdurre hash, firme o una seconda versione di ogni sessione. In `accept`, rileggere e ricalcolare dentro una sola transazione che comprenda stati, proprietari, task, sessioni e contenuti letti; ignorare i piani forniti dal chiamante come fonte di scrittura. Se il confronto cambia, restituire `stale` con la nuova anteprima; altrimenti salvare stato/ciclo e soli piani ammessi. Alla prima inizializzazione inserire lo stato dopo il controllo di obsolescenza, ottenere l'ID e ricalcolare i piani con la reference definitiva nella stessa transazione. La sola lettura non inizializza stati.

Usare `planTempoUpdates` per aggiornare i task dal giorno locale corrente in avanti, escludendo sorgente già studiata, voci studiate, task saltati/eliminati/completati/personalizzati e contesti estranei. Nessuna rigenerazione globale durante `accept`, né modifica del flag `customized` per gli aggiornamenti del motore.

La query precedente `sessions.bpmSuggestion` viene eliminata quando il chiamante UI è sostituito nel Task 7; fino ad allora non attivare due suggerimenti sulla stessa regola. I test di query nuove verificano letture aggiornate dopo configurazione, sessione e conferma.

- [ ] **Step 4 — Verificare il verde.** Ripetere lo Step 2; atteso PASS. Verificare riapertura DB e anteprime aggiornate dopo aumento/modifica della regola. Provare l'errore sull'ultima scrittura per dimostrare il rollback dell'intera accettazione.
- [ ] **Step 5 — Commit.** Stage selettivo e commit `feat: preview and accept tempo changes atomically`.

### Task 5: Nuove occorrenze e rigenerazione ereditano il tempo accettato

**Files:** Modify `src/lib/domain/studyRoutineGenerator.ts`, `src/infrastructure/repositories/dexie/studyRoutineRepository.ts`, `src/infrastructure/repositories/dexie/taskRepository.ts`, `src/application/useCases/generateStudyRoutine.ts`, `src/application/useCases/updateStudyRoutine.ts`, `src/application/useCases/updateTask.ts`, `src/domain/ports/studyRoutine.ts`. Test `src/lib/domain/studyRoutineGenerator.test.ts`, `src/application/useCases/generateStudyRoutine.test.ts`, `src/lib/services/studyRoutines.test.ts`, `src/application/useCases/taskSession.test.ts`, `src/infrastructure/repositories/dexie/tempoProgressionRepository.test.ts`.

**Interfaces:** Aggiungere a `GenerateRoutineTasksOptions` `tempoProgressions?: readonly TempoProgression[]` e `tempoRule?: TempoProgressionRule`, caricati dal flusso esistente. Riutilizzare `resolveTempoContext` e i tipi del Task 2; nessun nuovo algoritmo di estrazione o seconda tabella di pianificazione. Il salvataggio della routine riusa `configure` del Task 3 dentro la transazione del proprietario.

- [ ] **Step 1 — Scrivere i test rossi.** Accettare nel fixture backend un aumento a 72 alla semiminima/ciclo 2, poi generare nuove attività e rigenerare le future della stessa routine. Inserire un task personalizzato a 60 e una sezione appartenente a un altro materiale. Verificare con queste asserzioni, e controllare la corrispondenza per sezione nei task combinati:

```ts
expect(generatedEntry.bpm).toBe(72);
expect(generatedEntry.progression).toEqual({ id: 1, cycle: 2, minConfidence: 4 });
expect(regeneratedEntry.progression).toEqual(generatedEntry.progression);
expect(customizedEntry.bpm).toBe(60);
expect(otherContextEntry).toEqual(originalOtherContextEntry);
expect(uninitializedEntry.progression).toBeUndefined();
```

Testare regola assente/disattivata, nuovo contesto non inizializzato, serie con radice e figlie, riporto di un task non personalizzato e conservazione delle personalizzazioni. Inserire anche uno stato con contesto identico ma proprietario diverso: non deve essere usato. Un nuovo contesto non eredita il tempo di un altro solo perché condivide la regola; il target finale del materiale non diventa automaticamente il suo tempo iniziale confermato.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/lib/domain/studyRoutineGenerator.test.ts src/application/useCases/generateStudyRoutine.test.ts src/lib/services/studyRoutines.test.ts src/application/useCases/taskSession.test.ts src/infrastructure/repositories/dexie/tempoProgressionRepository.test.ts`; atteso FAIL sull'ereditarietà di tempo/reference.
- [ ] **Step 3 — Implementare il minimo.** Decorare le entry prodotte dal generatore dopo la selezione del materiale con tempo/reference del solo stato corrispondente e regola attiva. La ricorrenza e il riporto di nuove occorrenze seguono la stessa risoluzione; non cambiare tempo o contesto dei task personalizzati. Conservare protezioni e identità durante la rigenerazione, senza inizializzare stati tramite una semplice lettura o copia del target finale. Aggiornare i fake dei port raggiunti dalle nuove letture senza sostituire le implementazioni con mock che saltano la selezione reale.
- [ ] **Step 4 — Verificare il verde.** Ripetere lo Step 2; atteso PASS. Dopo una riapertura DB, ripetere generazione e rigenerazione e verificare stesso stato/ciclo e nessuna perdita o duplicazione dei task protetti.
- [ ] **Step 5 — Commit.** Stage selettivo e commit `feat: inherit accepted tempo in future routine and recurring tasks`.

### Task 6: Configurazione leggibile nei form esistenti

**Files:** Create `src/components/diary/TempoProgressionFields.tsx`, `src/components/diary/TempoProgressionFields.test.tsx`. Modify `src/components/diary/RoutineBuilder.tsx`, `src/pages/NewTaskPage.tsx`, `src/pages/EditTaskPage.tsx`, `src/lib/schemas.ts`, `src/lib/language/{it,en,es,de}.json`. Test `src/pages/NewTaskPage.test.tsx`; creare `src/pages/EditTaskPage.test.tsx` se non esiste.

**Interfaces:** `TempoProgressionFields({ value, onChange, onValidityChange, disabled }: { value?: TempoProgressionRule; onChange: (value: TempoProgressionRule | undefined) => void; onValidityChange: (valid: boolean) => void; disabled?: boolean })`. Il componente gestisce il draft testuale e riporta valori validi al form; `onValidityChange` è obbligatorio per impedire il submit anche quando un draft numerico non è ancora convertibile, senza salvare numeri parziali come zero o NaN. Una regola disattivata senza configurazione valida non blocca il salvataggio del task. Il form valida nuovamente la regola prima del comando.

- [ ] **Step 1 — Scrivere i test rossi.** Usare Testing Library con provider lingua esistente. Accendere la progressione, scegliere percentuale, lasciare M vuoto, attivare la riduzione e impostare K=2/5%. Verificare controlli accessibili e dati del comando, poi passare al passo fisso e verificare la figura. Testare M<N e un valore percentuale vuoto durante editing.

```ts
expect(screen.getByLabelText(/finestra di sessioni/i)).toHaveValue(null);
expect(screen.getByText(/richiede successi consecutivi/i)).toBeVisible();
expect(submittedRule.window).toBeUndefined();
expect(submittedRule.decrease).toEqual({ failures: 2, step: { kind: "percent", value: 5 } });
expect(screen.getByRole("button", { name: /salva/i })).toBeDisabled();
```

Le asserzioni si riferiscono rispettivamente al form valido e al successivo stato invalido, non allo stesso momento del test. In NewTask salvare la regola solo se esiste una ricorrenza; in EditTask di una figlia indicare «Regola della serie» e modificare il proprietario radice, mantenendo la personalizzazione del task distinta dalla modifica della regola.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/components/diary/TempoProgressionFields.test.tsx src/pages/NewTaskPage.test.tsx src/pages/EditTaskPage.test.tsx`; atteso FAIL sul nuovo gruppo di campi/command payload.
- [ ] **Step 3 — Implementare il minimo.** Leggere craft-floor prima delle modifiche UI. Riutilizzare `Input`, `Switch`, selettori nativi e controlli di sicurezza/figura esistenti; un solo gruppo aperto con campi condizionali, senza card annidate. N/M/S sono esposti con etichette esplicite del brief. M vuoto significa `undefined`, non coercizione Number del campo vuoto. Conservare l'ultima configurazione valida quando la regola viene disattivata; se non è mai stata configurata, l'assenza resta assenza. Integrare salvataggio atomico della routine e configurazione della serie con i comandi dei Task 3/4 e il flusso routine del Task 5, senza rendere `customized` tutti i task della serie. Gli errori conservano il draft e il focus; invalidità e salvataggio in corso bloccano l'invio. Aggiungere tutte le chiavi nelle quattro lingue nello stesso task.
- [ ] **Step 4 — Verificare il verde.** Ripetere lo Step 2 e `npm run i18n:validate`; atteso PASS. Guardare i form a 375px e con testo tedesco: campi/azioni non devono uscire dalla colonna o restare coperti dalla tastiera e dalla barra di salvataggio.
- [ ] **Step 5 — Commit.** Stage selettivo e commit `feat: configure tempo progression in routines and recurring tasks`.

### Task 7: Proposte, anteprima e conferma senza alterare il risultato registrato

**Files:** Modify `src/components/diary/BpmSuggestion.tsx`, `src/pages/SessionLogPage.tsx`, `src/pages/SessionPage.tsx`, `src/components/diary/UpdateNextTaskPanel.tsx`, `src/infrastructure/dexie/presentationReadPort.ts`, `src/lib/language/{it,en,es,de}.json`. Create `src/components/diary/BpmSuggestion.test.tsx`. Test `src/pages/SessionLogPage.test.tsx`, `src/pages/SessionPage.test.tsx`, `src/infrastructure/dexie/presentationReadPort.test.ts`.

**Interfaces:** Sostituire i vecchi props con `BpmSuggestion({ task, sourceSession, onInitialized }: { task: Task; sourceSession?: Session; onInitialized?: (state: TempoProgression) => void })`. Risolvere owner e contesti dal task tramite gli helper dei Task 2/4; il pannello usa `applicationCommands.tempoProgression` e `usePresentationRead<TempoProgressionView>`. La callback iniziale aggiorna solo snapshot del previsto/reference nella bozza corrispondente, preservando BPM raggiunto già inserito, valutazioni, note e clip. Non è un callback per copiare un suggerimento nel risultato effettivo.

- [ ] **Step 1 — Scrivere i test rossi.** Mockare query/comandi secondo i test delle pagine. Mostrare ultimo risultato iniziale con data/S, permettere modifica manuale e aprire anteprima. Per aumento e riduzione: motivo leggibile, due date aggiornabili e una personalizzazione esclusa; nessuna scrittura prima della conferma.

```ts
expect(acceptCommand).not.toHaveBeenCalled();
expect(screen.getByRole("button", { name: /applica a 2 attività/i })).toBeVisible();
expect(screen.getByText(/personalizzata/i)).toBeVisible();
expect(savedMark.bpm).toBe(68);
expect(savedMark.confidence).toBe(3);
expect(savedMark.progression?.cycle).toBe(originalCycle);
```

Le ultime tre asserzioni verificano una bozza realmente compilata prima di un cambio di ciclo: la conferma di un aggiornamento futuro non modifica la registrazione dello studio. Nel test di inizializzazione di un task non ancora studiato, invece, aggiornare `targetBpm`, `targetNoteVal` e reference senza cancellare i valori raggiunti già digitati. Chiudere l'anteprima non resetta i conteggi. Testare anche dati insufficienti, errore riprovabile, doppio click, zero task, `stale`, molte sezioni e assenza di regola.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/components/diary/BpmSuggestion.test.tsx src/pages/SessionLogPage.test.tsx src/pages/SessionPage.test.tsx src/infrastructure/dexie/presentationReadPort.test.ts`; atteso FAIL sul flusso precedente che riempiva il BPM raggiunto.
- [ ] **Step 3 — Implementare il minimo.** In `/log?task=ID` offrire inizializzazione/stato in una sezione secondaria, senza limitazione `marks.length === 1`. Dopo il salvataggio, la pagina della sessione mostra suggerimenti calcolati includendo la sessione registrata e usando il suo task come sorgente da escludere dagli aggiornamenti. I contesti senza contenuto identificabile mostrano la ragione dell'esclusione. Rimuovere la query e l'azione vecchie che scrivevano l'aumento direttamente nelle marks non salvate.

L'anteprima è inline, con un solo contesto espanso, tempi/figure ben leggibili e conferma distinta dalla registrazione. Usare messaggi live per esiti/errori e focus coerente; a `stale` mostrare l'anteprima aggiornata senza riapplicare automaticamente. Tenere un errore di suggerimento separato dall'esito positivo del salvataggio sessione. Nell'azione esistente «aggiorna prossimo task» evitare che lo stesso campo di un contesto gestito venga presentato come secondo aggiornamento concorrente: tempo dal pannello di progressione, altri dati dal pannello esistente. I task senza regola mantengono il flusso precedente di trasferimento manuale.
- [ ] **Step 4 — Verificare il verde.** Ripetere lo Step 2 e `npm run i18n:validate`; atteso PASS. Verificare che annullamento, ricaricamento e ritorno a una bozza non cambino stato o risultato; il pannello funziona con più contesti e la conferma fallita non perde note/clip.
- [ ] **Step 5 — Commit.** Stage selettivo e commit `feat: review tempo suggestions before updating future practice`.

### Task 8: Confronti coerenti nelle viste, target storico e contratto aggiornato

**Files:** Modify `src/domain/logic/sessionMetrics.ts`, `src/domain/logic/progress.ts`, `src/domain/logic/readiness.ts`, `src/infrastructure/dexie/presentationReadPort.ts`, `src/components/library/BpmSparkline.tsx`, `src/components/library/BpmTimelineChart.tsx`, `src/components/diary/StatsDashboard.tsx`, `src/components/diary/LastSessionStrip.tsx`, `src/pages/ReadinessPage.tsx`, `src/pages/PrintSummary.tsx`, `src/lib/format.ts`, `src/application/useCases/exportCsv.ts`, `src/lib/language/{it,en,es,de}.json`, `PRODUCT.md`. Test `src/domain/logic/sessionMetrics.test.ts`, `src/domain/logic/progress.test.ts`, `src/domain/logic/readiness.test.ts`, `src/components/library/BpmTimelineChart.test.tsx`, `src/test/libraryControls.test.tsx`, `src/infrastructure/dexie/presentationReadPort.test.ts`, `src/application/useCases/exportCsv.test.ts`.

**Interfaces:** `topMark` conserva la firma e restituisce la mark originale che massimizza `normalizedTempo`, usando solo coppie complete per confronti verificati. `topBpm` resta il numero della figura di quella mark: ogni chiamante che costruisce una serie di numeri deve dichiarare la figura comune e usare `convertTempo` oppure conservare la coppia. `targetEvidence` del Task 2 governa l'evidenza nella progressione, non il massimo globale.

- [ ] **Step 1 — Scrivere i test rossi.** Confrontare 50 alla semiminima e 90 alla croma: vince la prima mark anche se il numero grezzo è minore. Serie 50 semiminima/100 croma/75 semiminima puntata in figura semiminima: punti 50/50/112,5; nei dettagli conservare le coppie originali. Una conversione frazionaria appena sotto target non è un successo per arrotondamento.

```ts
expect(topMark([quarter50, eighth90])).toBe(quarter50);
expect(plottedQuarterValues).toEqual([50, 50, 112.5]);
expect(evidenceAfterCycleChange.sessionId).toBe(evidenceBeforeCycleChange.sessionId);
expect(evidenceAfterSourceDeletion).toBeUndefined();
expect(csvReachedFigure).toBe("eighth");
expect(csvPlannedFigure).toBe("quarter");
```

Le due fixture marks sono rispettivamente `{ bpm: 50, noteVal: "quarter", layers: [], techniques: [] }` e `{ bpm: 90, noteVal: "eighth", layers: [], techniques: [] }`. Nei test di progress/readiness verificare separazione fra obiettivo del brano e previsto storico della sessione, uso della figura prevista salvata e assenza di sicurezza/figura non trasformata in zero. Un successo di una sezione non rende riuscito l'intero materiale. Eliminare/modificare la sessione ricalcola evidenze e conteggi, lasciando invariati tempo già accettato e calendario.

- [ ] **Step 2 — Verificare il rosso.** Run `npm run test -- src/domain/logic/sessionMetrics.test.ts src/domain/logic/progress.test.ts src/domain/logic/readiness.test.ts src/components/library/BpmTimelineChart.test.tsx src/test/libraryControls.test.tsx src/infrastructure/dexie/presentationReadPort.test.ts src/application/useCases/exportCsv.test.ts`; atteso FAIL sui confronti grezzi/esclusione di figure differenti.
- [ ] **Step 3 — Implementare il minimo.** Prima degli edit tracciare i chiamanti di `topMark`/`topBpm` e i confronti BPM nel grafo. Sostituire i confronti numerici raggiunti con gli helper condivisi e dichiarare la figura di riferimento delle serie, inclusi sparkline, ultimi tempi e stampa. I grafici riusano tooltip e tabelle accessibili esistenti; nessuna dashboard nuova. Le marks legacy prive di figura restano consultabili con l'indicazione di dato incompleto, ma fuori dai confronti verificati. Una metrica di «tempo di lavoro raggiunto» non assume la soglia S se non è stata registrata e non diventa «target finale raggiunto».

Per il target mostrare contesto, data, figura originale e S storica; considerare cicli precedenti. Aggiornare `PRODUCT.md` al backup v6/import v4–v6, range 1–400 e contratto di progressione approvato, conservando identità e altri vincoli del prodotto. Nel CSV mantenere distinguibili BPM/figura previsti e raggiunti, con gli ID e l'escaping già adottati; aggiungere solo le colonne effettivamente mancanti. Nessun nuovo export o analisi audio.
- [ ] **Step 4 — Verificare il verde.** Ripetere lo Step 2; atteso PASS. Eseguire poi la verifica finale sotto, una sola volta a codice stabilizzato; ripetere solo i controlli coinvolti da correzioni successive.
- [ ] **Step 5 — Commit.** Stage selettivo e commit `fix: compare rhythmic tempos consistently across progress views`.

## Verifica finale e revisione

- [ ] Run `npx tsc --noEmit -p tsconfig.app.json`: exit 0. La build Vite da sola non prova la coerenza dei tipi.
- [ ] Run `npm run ci`: lint, i18n, test e build terminano con exit 0. Separare gli errori preesistenti rilevati all'avvio; non dichiarare pulita una suite non eseguita o fallita.
- [ ] Eseguire un giro reale: configurare una routine e una serie con regole diverse sullo stesso materiale; inizializzare dallo storico; registrare successi in figure equivalenti; accettare aumento e poi riduzione; verificare calendario, personalizzazioni e rigenerazione.
- [ ] Provare export v6/import, import v4/v5 e riapertura offline. Controllare che indice, riferimenti storici e conteggi ricostruiti coincidano; conservare un backup prima delle prove manuali su dati non dimostrativi.
- [ ] Guardare UI renderizzata a 375×812, 812×375, 768×1024 e 1366×768, con tastiera mobile, titoli lunghi, più sezioni, tedesco, zoom 200% e reduced motion. Verificare tabulazione, nomi accessibili, focus dopo annullamento/errore, footer visibili, contrasto e assenza di overflow. Correggere in un lotto ciò che emerge da ciascuna revisione visiva.
- [ ] Ascoltare il metronomo nel browser supportato e nel wrapper Android: 1/10/400 BPM, cambio 1→120 mentre suona e sospensione/ripresa. A 1 BPM verificare almeno due beat reali; riportare separatamente qualsiasi piattaforma non disponibile, senza affermare di aver verificato l'audio dal solo mock.
- [ ] Run una sola volta `/home/giulio/.agents/skills/impeccable/scripts/impeccable detect --json` passando gli esatti file UI modificati elencati da `git diff --name-only` rispetto alla base dell'esecuzione; leggere e correggere i rilievi pertinenti. Il detector integra la verifica visiva, non la sostituisce.
- [ ] Confrontare i 20 criteri della spec con i task/test: 1/7/18 → Task 1; 2–8/10/14–16 → Task 2; 2/8/9/14/15/18/19 → Task 3; 10–15 → Task 4; 9/12/13 → Task 5; 2/20 → Task 6; 10–13/20 → Task 7; 1/15–17/20 → Task 8. Documentare risultati dei comandi e limiti di verifica nel riepilogo finale.
- [ ] Riesaminare il diff completo e le relazioni chiamanti raggiunte; nessuna modifica preesistente deve finire accidentalmente nei commit. Un errore su migrazione, backup, cicli o aggiornamento dei piani impedisce di dichiarare completo il lavoro.

## Consegna del piano

Piano scritto con Superpowers writing-plans, Ponytail ultra e Impeccable shape/Operate. Preferenza proposta per l'esecuzione: **diretta nella stessa sessione**, perché i task condividono tipi e transazioni e il workspace contiene modifiche non committate da preservare. L'alternativa è esecuzione con subagenti e revisioni per task, con costo di contesto maggiore. Nessun subagente è stato avviato durante la pianificazione.

L'utente deve ora revisionare il piano e scegliere il metodo; poi usare `superpowers:executing-plans` per esecuzione diretta oppure `superpowers:subagent-driven-development` se scelto esplicitamente. Non avviare l'implementazione con la sola approvazione della specifica precedente.

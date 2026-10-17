# Study Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implementare cinque tipi di materiale autonomo, manuali/raccolte misti e segmenti con battute e obiettivi ereditabili, aggiornando direttamente fixture e dati dimostrativi.

**Architecture:** Estendere entità, porte, repository Dexie, query e componenti già presenti. Conservare identità dei materiali e dei segmenti; le appartenenze ai contenitori hanno metadati propri. La pianificazione risolve i default senza riscrivere piani salvati e lo storico conserva snapshot completi.

**Tech Stack:** TypeScript, React 18, componenti Radix/shadcn esistenti, Dexie 4, Zod 3, Vitest, Testing Library e fake-indexeddb; nessuna nuova dipendenza.

**Spec:** `docs/superpowers/specs/2026-10-17-study-materials-design.md` — approvata dall'utente il 2026-10-17.

## Global Constraints

- «Non esistono dati in produzione da migrare: soltanto fixture e dati dimostrativi, da aggiornare direttamente.»
- «I tipi sono cinque: Brano, Studio, Esercizio tecnico, Esercizio, Contenuto teorico.» Chiavi: `piece`, `study`, `technique`, `exercise`, `theory`.
- «Ogni materiale è autonomo e riutilizzabile in più contenitori, con una sola identità e un unico storico.»
- «Manuali e raccolte hanno un indice piatto e ordinato; possono mescolare tutti i tipi.»
- «Il segmento eredita BPM e figura ritmica del materiale quando non ha un proprio obiettivo.»
- «Modificare un obiettivo generale o del segmento non riscrive attività già pianificate o sessioni salvate.»
- «Il repertorio e i programmi di esecuzione possono comprendere brani e studi.»
- «Aggiornare italiano, inglese, spagnolo e tedesco, comprese descrizioni, errori ed empty state.»
- «Non introdurre timer, durata dello studio, journal, analisi automatica o nuove dipendenze per questa riorganizzazione.»
- Nessun reset automatico all'avvio; rigenerare i dati dimostrativi attraverso l'azione esplicita già esistente. Nessuna espansione del trasferimento audio.
- Preservare le modifiche già presenti nel workspace. I task di seguito si eseguono in ordine, senza lavorazioni concorrenti sugli stessi contratti. Durante le transizioni di tipo eseguire i test del task; il controllo completo chiude l'integrazione.
- Prima del Task 1 acquisire stato/diff iniziale, inclusi i file non tracciati pertinenti, ed eseguire una volta `npm run ci` e `npx tsc --noEmit -p tsconfig.app.json` per distinguere eventuali errori già presenti. Non annullare o committare le modifiche dell'utente per ottenere un baseline pulito.
- Nei commit dei task includere soltanto i propri cambiamenti. Per file già modificati usare selezione dei singoli hunk; se una sovrapposizione impedisce di separarli in sicurezza, lasciare quel file fuori dal commit e segnalarlo, conservando comunque l'implementazione nel workspace.

## Review Focus

1. Una modifica al titolo o all'ordine dei segmenti deve conservare i loro ID e i riferimenti di sessioni e registrazioni: test nel Task 2.
2. Un errore nel collegamento a un contenitore non deve lasciare un materiale creato a metà; doppie aggiunte non devono duplicare la stessa appartenenza: Task 2.
3. Cambiare la figura ritmica del risultato non deve cambiare quella dell'obiettivo storico; una materia teorica non deve cancellare i BPM di un solfeggio: Task 3.
4. Collegare a un'esecuzione un esercizio tramite servizio/import, o cambiare tipo a uno studio già nel programma, deve essere rifiutato senza modifiche parziali: Task 4 e Task 7.
5. Rimuovere e ripristinare un contenitore tramite annulla deve conservare ordine, riferimenti e pagine senza cancellare lo storico condiviso: Task 2 e Task 6.

## Mappa dei file e decisioni comuni

| Gruppo | File e responsabilità |
|---|---|
| Entità e validazione | `src/domain/entities/{common,library,collection,session}.ts`, `src/domain/ports/{library,collection}.ts`, `src/lib/schemas.ts`, `src/lib/constants.ts`, re-export `src/lib/db.ts` |
| Persistenza dei materiali | `src/infrastructure/repositories/dexie/libraryRepository.ts`; il servizio `src/lib/services/library.ts` è già un alias e non richiede un nuovo wrapper |
| Appartenenze | `src/infrastructure/repositories/dexie/collectionRepository.ts`, `src/lib/services/collections.ts` |
| Obiettivi e storico | `src/domain/logic/plan.ts`, `src/infrastructure/repositories/dexie/sessionRepository.ts`, `src/application/useCases/logSession.ts`, `src/pages/SessionLogPage.tsx`, `src/application/useCases/exportCsv.ts` |
| Letture | `src/infrastructure/dexie/presentationReadPort.ts`, `src/presentation/hooks/useEntities.ts`; conservare la facciata query esistente |
| Biblioteca | `src/pages/{Library,ItemPage,Collections,CollectionPage}.tsx`, `src/components/library/{NewLibraryItemSheet,LibraryItemKindFields,SegmentsEditor}.tsx`, `src/components/collections/NewCollectionSheet.tsx` |
| Repertorio e programmi | `src/domain/logic/repertoireReview.ts`, `src/infrastructure/repositories/dexie/performanceRepository.ts`, `src/pages/{Repertoire,EventPage}.tsx`, `src/components/library/PerformanceEventSheet.tsx` |
| Confini e dati dimostrativi | `src/application/useCases/{importBackup,exportBackup}.ts`, `src/infrastructure/repositories/dexie/backupRepository.ts`, `src/lib/sampleData.ts`, `src/lib/sampleDataGuitar.ts`, test e lingue |

Decisioni precise per evitare implementazioni divergenti:

- Aggiungere `CollectionKind = "manual" | "collection"` e `StudyStatus = "not_started" | "in_progress" | "consolidated"`. `Collection.kind` usa il primo, `LibraryItem.studyStatus` il secondo.
- Aggiungere a `LibraryItem` `catalog?: string`, `notes?: string`; eliminare i due contatori del manuale. Aggiungere a `Collection` `edition?: string`.
- Aggiungere `position: number`, `barStart?: number`, `barEnd?: number`, `notes?: string` a `Segment`; `position` è intero non negativo. `CollectionItem.position` diventa obbligatorio, con `reference?: string`, `pageStart?: number`, `pageEnd?: number`.
- Le pagine sono interi positivi: `pageStart` può indicare una sola pagina; `pageEnd` richiede l'inizio e deve essere maggiore o uguale. Le battute richiedono entrambe le estremità, ammettono 0 e devono essere ordinate.
- Esportare da `entities/library.ts` `SegmentInput = Omit<Segment, "id" | "itemId" | "createdAt" | "deletedAt"> & { id?: number }`. Riutilizzarlo nel modulo dei segmenti, evitando un secondo tipo divergente.
- Aggiungere `targetNoteVal?: NoteVal` a `SegmentMark`: `noteVal` descrive il risultato, `targetNoteVal` l'obiettivo previsto. Estendere gli elementi di `SessionSnapshot.segments` con `barStart?` e `barEnd?`.
- Le modifiche descritte usano gli indici attuali: non aggiungere una versione Dexie o una conversione dei contenuti soltanto per campi non indicizzati. In `db.ts` rimuovere il vecchio backfill v6 che forza `Collection.kind = "repertoire"`, mantenendo le dichiarazioni degli indici e senza rifare le migrazioni estranee alla modifica.

---

### Task 1: Tipi e validazione del nuovo modello

**Files:** modificare entità/porte/re-export della mappa, `src/lib/schemas.ts`, `src/lib/constants.ts`; test `src/lib/schemas.test.ts`.

**Interfaces:**
- Produce i tipi definiti nella mappa e gli schemi Zod `libraryKindSchema`, `collectionKindSchema`, `studyStatusSchema`, `libraryItemInputSchema`, `segmentInputSchema`, `collectionLinkInputSchema` e `collectionInputSchema` aggiornato.
- `libraryItemInputSchema` valida i campi del materiale; `segmentInputSchema` accetta `SegmentInput`; `collectionLinkInputSchema` valida `reference`, `pageStart`, `pageEnd`. Conservare i metadati dell'entità quando si validano i soli campi di input.
- BPM: riutilizzare 20–400 e le figure di `NOTE_VALUES`. L'obiettivo generale e quello di un segmento sono ciascuno una coppia completa o interamente assente. `studyStatus` parte da `not_started` alla creazione; nessun aggiornamento automatico dalle sessioni.

- [x] **1. Scrivere i test di validazione**, includendo queste asserzioni e fixture locali minime:

```ts
expect(libraryKindSchema.options).toEqual(["piece", "study", "technique", "exercise", "theory"]);
expect(collectionKindSchema.safeParse("piece").success).toBe(false);
expect(segmentInputSchema.safeParse({ label: "A", position: 0, layers: [], barStart: 0, barEnd: 8 }).success).toBe(true);
expect(segmentInputSchema.safeParse({ label: "A", position: 0, layers: [], barStart: 9, barEnd: 8 }).success).toBe(false);
expect(segmentInputSchema.safeParse({ label: "A", position: 0, layers: [], targetBpm: 80 }).success).toBe(false);
```

Testare anche estremità mancanti, pagine invertite, titolo vuoto e assenza completa di BPM/figura.
- [x] **2. Eseguire** `npm test -- src/lib/schemas.test.ts`; attendersi fallimenti per schemi/tipi nuovi o valori ancora vecchi.
- [x] **3. Implementare** tipi, schemi e costanti con i nomi sopra; esportare i tipi necessari attraverso i re-export esistenti. Conservare tag, ripassi, parti, colori e date. Allineare le fixture del test modificato; i chiamanti del vecchio modello saranno completati nei task successivi.
- [x] **4. Rieseguire** lo stesso comando; atteso PASS, inclusa la validazione precedente ancora pertinente.
- [x] **5. Commit** dei soli file di questo task: `feat: define autonomous study material types and validation`.

### Task 2: Identità stabili e appartenenze ordinate

**Files:** modificare `src/domain/ports/{library,collection}.ts`, `src/infrastructure/repositories/dexie/{libraryRepository,collectionRepository}.ts`, `src/lib/services/collections.ts`, `src/infrastructure/dexie/db.ts`; test `src/lib/services/{library,collections}.test.ts` e `src/infrastructure/repositories/dexie/repositories.test.ts`.

**Interfaces:**
- `LibraryPort.upsert(item: Draft<LibraryItem>, segments?: SegmentInput[], collectionIds?: number[]): Promise<number>`; mantenere il servizio alias. Segmenti omessi = conservarli, `[]` = rimuoverli esplicitamente; appartenenze omesse = conservarle.
- `CollectionPort.list(kind?: CollectionKind): Promise<Collection[]>`; `listItems(collectionId: number): Promise<LibraryItem[]>` restituisce tutti i tipi nell'ordine dell'indice.
- Aggiungere `updateItemLink(collectionId: number, itemId: number, patch: Pick<CollectionItem, "reference" | "pageStart" | "pageEnd">): Promise<void>` e `reorderItems(collectionId: number, itemIds: number[]): Promise<void>`.
- `restore(collection: Collection, links: Omit<CollectionItem, "id" | "createdAt">[]): Promise<void>` conserva tutti i metadati. `groupLibraryByCollection(kind?: LibraryKind)` filtra i materiali, non il tipo dei contenitori.

- [x] **1. Scrivere regressioni** nei test esistenti per aggiornamento senza cambio ID, segmenti omessi/esplicitamente rimossi, segmento appartenente a un altro materiale rifiutato, intervalli sovrapposti accettati, raccolta mista ordinata, rimozione/ripristino dei collegamenti e rollback della creazione con collegamento fallito. In particolare:

```ts
await collectionsService.addItems(collectionId, [itemId, itemId]);
expect(await collectionsService.countItems(collectionId)).toBe(1);
expect((await collectionsService.listItems(collectionId)).map(i => i.id)).toEqual(orderedItemIds);
expect((await db.segments.get(segmentId))?.id).toBe(segmentId);
expect(await db.sessions.get(sessionId)).toEqual(savedSession);
```

Per il rollback usare un contenitore inesistente e verificare che non restino materiale, segmenti o collegamenti. Per annulla verificare anche `reference`, pagine e posizione. Verificare che `reorderItems` rifiuti ID duplicati, mancanti o estranei senza scritture.
- [x] **2. Eseguire** `npm test -- src/lib/services/library.test.ts src/lib/services/collections.test.ts src/infrastructure/repositories/dexie/repositories.test.ts`; attendersi i fallimenti dei nuovi comportamenti.
- [x] **3. Implementare** le firme sopra e la validazione nei punti di scrittura. `upsert` conserva ID e date dei segmenti esistenti, crea solo i nuovi, archivia quelli rimossi ancora referenziati e non cancella sessioni/registrazioni. La transazione di `upsert` include creazione materiale, segmenti e differenza dei collegamenti quando richiesti; riusare la logica esistente di `setItemCollections` senza duplicarla. Deduplicare gli ID, verificare riferimenti attivi e mantenere i metadati dei collegamenti rimasti. Assegnare in coda le nuove posizioni. Applicare le decisioni Dexie della mappa.
- [x] **4. Rieseguire** i test del punto 2; atteso PASS. Aggiornare le vecchie aspettative che richiedevano sostituzione indiscriminata dei segmenti o esclusione dei materiali non-brano.
- [x] **5. Commit** circoscritto: `feat: preserve study identities and support ordered mixed collections`.

### Task 3: Eredità degli obiettivi e snapshot fedeli

**Files:** modificare `src/domain/logic/plan.ts`, `src/infrastructure/repositories/dexie/{sessionRepository,studyRoutineRepository}.ts`, `src/lib/domain/studyRoutineGenerator.ts`, `src/lib/schemas.ts`, `src/pages/SessionLogPage.tsx`, `src/components/diary/useTaskPlan.ts`, `src/components/diary/{QuickAdd,RoutineBuilder,LastSessionStrip,SegmentHistory,MarksEditor}.tsx`, `src/pages/{BulkAddTasksPage,SessionPage,History}.tsx`, `src/application/useCases/exportCsv.ts`; test `src/domain/logic/plan.test.ts`, `src/lib/domain/snapshots.test.ts`, `src/application/useCases/{taskSession,exportCsv}.test.ts`, `src/presentation/hooks/useEntities.test.tsx`, `src/lib/services/studyRoutines.test.ts`; creare `src/components/diary/MarksEditor.test.tsx`.

**Interfaces:**
- Conservare `syncPlan(plan, segments, item): SegmentEntry[]`, `seedEntry(defaults?, segmentId?)` e `marksFromPlan(plan): SegmentMark[]`.
- `syncPlan` usa il tempo del segmento se completo, altrimenti quello del materiale; mantiene le entrate già presenti. Le parti/competenze mantengono le regole attuali, senza eredità aggiuntive implicite.
- `marksFromPlan` inizializza `targetBpm` e `targetNoteVal` dal piano. Il builder esistente `buildDexieSessionSnapshot(target)` aggiunge le battute.
- Aggiungere `plan?: SegmentEntry[]` a `ResolvedPoolItem` nel generatore esistente. `resolvePoolEntries` inizializza il piano dei materiali/segmenti tramite `syncPlan`; `buildTask` ne copia i valori per ogni nuova attività, senza condividere array mutabili. Le voci contenitore conservano il comportamento attuale.
- Aggiungere `showTempo?: boolean` a `MarksEditor`, con default `!isTheory`; i form delle sessioni lo impostano in base al materiale selezionato (`kind !== "theory"`) quando presente. `isTheory` continua a governare gli altri dettagli della materia. Non cancellare valori musicali validi soltanto in base al tipo della materia.
- CSV risultati: aggiungere `bar_start`, `bar_end`, `target_bpm`, `target_note_value` alle colonne esistenti; i dati delle battute provengono dallo snapshot, non dal segmento corrente.

- [x] **1. Scrivere test** per coppia ereditata, coppia specifica, obiettivo assente e piano già personalizzato. Esempio completo:

```ts
const item = { targetBpm: 88, noteVal: "quarter" as const };
expect(syncPlan([], [{ id: 1 }], item)[0]).toMatchObject({ bpm: 88, noteVal: "quarter" });
expect(syncPlan([], [{ id: 1, targetBpm: 56, noteVal: "eighth" }], item)[0]).toMatchObject({ bpm: 56, noteVal: "eighth" });
expect(marksFromPlan([{ segmentId: 1, bpm: 88, noteVal: "quarter", layers: [], techniques: [] }])[0]).toMatchObject({ targetBpm: 88, targetNoteVal: "quarter" });
```

Nei test delle sessioni cambiare la figura del risultato in `eighth` e verificare obiettivo storico `quarter`; modificare nome/battute e verificare snapshot e CSV precedenti. Verificare un Esercizio di Solfeggio con materia `type: "theory"` e BPM presenti: il controllo resta disponibile e salvarlo non li cancella. Due appartenenze dello stesso materiale non duplicano lo storico letto per `itemId`. Una routine genera due task con lo stesso target risolto; modificare il piano del primo non cambia il secondo.
- [x] **2. Eseguire** `npm test -- src/domain/logic/plan.test.ts src/lib/domain/snapshots.test.ts src/application/useCases/taskSession.test.ts src/application/useCases/exportCsv.test.ts src/presentation/hooks/useEntities.test.tsx src/lib/services/studyRoutines.test.ts src/components/diary/MarksEditor.test.tsx`; attendersi fallimenti sulle nuove asserzioni.
- [x] **3. Implementare** nei punti condivisi: risolvere la coppia in `syncPlan` prima di inizializzare soltanto le nuove entrate; conservare i valori salvati e usarla anche per inizializzare i piani delle routine. Estendere snapshot, letture storiche e CSV con i nuovi campi. Rimuovere la pulizia distruttiva dei BPM basata soltanto su `Subject.type` in `SessionLogPage`; materia teorica e contenuto teorico non sono equivalenti. Nei riepiloghi mostrare le due figure correttamente; confrontare direttamente BPM soltanto a parità di figura, mostrando separatamente i valori quando differiscono. Conservare i controlli di valutazione esistenti e non riscrivere piani futuri.
- [x] **4. Rieseguire** i test del punto 2; atteso PASS. Confermare che aggiornare materiale/segmento lasci invariati i record dei task e delle sessioni già salvati.
- [x] **5. Commit** circoscritto: `feat: inherit segment tempos and preserve historical targets`.

### Task 4: Brani e studi nel repertorio e nei programmi

**Files:** modificare `src/domain/logic/repertoireReview.ts`, `src/infrastructure/repositories/dexie/{performanceRepository,libraryRepository}.ts`, `src/infrastructure/dexie/presentationReadPort.ts`, `src/presentation/hooks/useEntities.ts`, `src/components/library/PerformanceEventSheet.tsx`, `src/pages/{Library,ItemPage,Repertoire,EventPage}.tsx`, i selettori dei brani nelle lezioni; creare `src/lib/services/performances.test.ts`; aggiornare `src/infrastructure/dexie/presentationReadPort.test.ts`.

**Interfaces:**
- Aggiungere al modulo di logica esistente `isPerformable(kind: LibraryKind): boolean`, vero soltanto per `piece` e `study`.
- Conservare `setInRepertoire(itemId, inRepertoire)` e `setEventItems(eventId, itemIds)`; validare dentro la transazione prima delle scritture.
- Aggiungere `usePerformableLibrary(): LibraryItem[] | undefined` con operazione query `library.performable`; aggiornare gli usi del vecchio `useRepertoireKind` e rimuovere hook/query ormai inutilizzati. `useRepertoire` rimane la selezione per flag, filtrata anche per ammissibilità.

- [x] **1. Scrivere test parametrizzati** su tutti i tipi e rollback dei programmi:

```ts
expect(["piece", "study", "technique", "exercise", "theory"].map(kind => isPerformable(kind as LibraryKind))).toEqual([true, true, false, false, false]);
await expect(repertoireService.setInRepertoire(exerciseId, true)).rejects.toThrow();
await expect(performancesService.setEventItems(eventId, [studyId, exerciseId])).rejects.toThrow();
expect(await db.performanceItems.where("eventId").equals(eventId).toArray()).toEqual(previousLinks);
```

Verificare studio ammesso anche senza flag personale, riferimenti mancanti/archiviati rifiutati e cambio tipo verso `exercise` bloccato quando il materiale è nel repertorio o in un programma. Togliere il flag resta possibile per rimuovere l'appartenenza prima del cambio.
- [x] **2. Eseguire** `npm test -- src/lib/services/performances.test.ts src/infrastructure/dexie/presentationReadPort.test.ts`; attendersi fallimenti sulle nuove regole.
- [x] **3. Implementare** regola condivisa, guardie, query e selettori; mantenere scheduling dei ripassi e storico esistenti. Validare il cambio tipo in `libraryRepository.upsert` prima di qualunque aggiornamento. Mostrare l'azione repertorio per i due tipi ammessi.
- [x] **4. Rieseguire** i test del punto 2; atteso PASS.
- [x] **5. Commit** circoscritto: `feat: include studies in repertoire and performance programs`.

### Task 5: Schede materiali e segmenti nell'interfaccia

**Files:** modificare `src/components/library/{NewLibraryItemSheet,LibraryItemKindFields,SegmentsEditor}.tsx`, `src/pages/{Library,ItemPage}.tsx`, `src/lib/constants.ts`, `src/lib/language/{it,en,es,de}.json`; creare `src/components/library/SegmentsEditor.test.tsx` e `src/components/library/NewLibraryItemSheet.test.tsx`.

**Interfaces:**
- L'editor riutilizza `SegmentInput`, conserva `id` e `position`, e riceve un prop facoltativo `itemTempo?: Pick<LibraryItem, "targetBpm" | "noteVal">` per mostrare il riferimento ereditato senza salvarlo come override.
- `NewLibraryItemSheet` salva con l'unica chiamata `libraryService.upsert(item, segments, collectionIds)` del Task 2, conservando i campi non modificati, compresi quelli dei ripassi. Nessuna seconda scrittura dei collegamenti dopo il salvataggio.

- [x] **1. Scrivere test di interazione**: battute 1–8, override a 56/quarter e ritorno all'eredità; riordino che mantiene gli ID; errore di intervallo accessibile; fallimento del salvataggio che lascia titolo e segmenti compilati. Asserzioni essenziali:

```ts
expect(lastSegments[0]).toMatchObject({ id: originalId, barStart: 1, barEnd: 8 });
expect(lastSegments[0].targetBpm).toBeUndefined();
expect(lastSegments[0].noteVal).toBeUndefined();
expect(screen.getByLabelText(/titolo/i)).toHaveValue("Studio n. 1");
```

Usare i provider e i mock già adottati dal progetto, con lingua italiana. Verificare che lo stato iniziale sia `not_started` e che cambiare un campo non alteri `inRepertoire`.
- [x] **2. Eseguire** `npm test -- src/components/library/SegmentsEditor.test.tsx src/components/library/NewLibraryItemSheet.test.tsx`; attendersi fallimenti per i nuovi controlli/comportamenti.
- [x] **3. Implementare** cinque tipi, stato, autore/riferimento/note, campi BPM pertinenti e appartenenze libere. Eliminare contatori e moduli del manuale-materiale. Nei segmenti aggiungere controlli numerici, note e selezione esplicita ereditato/specifico, riusando i comandi di spostamento già presenti. Nella biblioteca aggiungere filtro stato e conservare ricerca/materia; nella scheda mostrare appartenenze e storico comune. Localizzare ogni nuova etichetta nelle quattro lingue.
- [x] **4. Rieseguire** i test del punto 2 e `npm run i18n:validate`; atteso PASS.
- [x] **5. Commit** circoscritto: `feat: edit autonomous materials and bar-based segments`.

### Task 6: Indici misti e integrazione nei flussi esistenti

**Files:** modificare `src/components/collections/NewCollectionSheet.tsx`, `src/pages/{Collections,CollectionPage}.tsx`, `src/presentation/hooks/useEntities.ts`, `src/infrastructure/dexie/presentationReadPort.ts`, `src/components/diary/{LinkTargetFields,RoutineBuilder,QuickAdd}.tsx`, `src/pages/{BulkAddTasksPage,NewTaskPage,EditTaskPage}.tsx`, `src/lib/language/{it,en,es,de}.json`; creare `src/pages/CollectionPage.test.tsx`; aggiornare `src/presentation/hooks/useEntities.test.tsx` e `src/lib/services/studyRoutines.test.ts`.

**Interfaces:**
- `useCollections(kind?: CollectionKind)` filtra per tipo di contenitore. `useCollectionItems` restituisce i collegamenti con i metadati e l'ordine persistito.
- La pagina legge i materiali attivi con `useLibrary()`, risolve gli ID dell'indice e li ordina per `position`; nessun filtro implicito per tipo di materiale. Il picker di creazione consente i cinque tipi e passa la materia predefinita.

- [x] **1. Scrivere test** per indice con teoria/studio/esercizio, riordino persistito, collegamento di una scheda esistente senza copie e distinzione rimuovere/eliminare. Sul ripristino verificare:

```ts
expect(restoredLinks.map(link => [link.itemId, link.position, link.reference, link.pageStart, link.pageEnd])).toEqual(originalLinkMetadata);
expect(await db.library.get(sharedItemId)).toBeDefined();
expect(await db.sessions.get(sharedSessionId)).toEqual(originalSession);
```

Verificare che selezionare un manuale misto nel pool di una routine continui a generare un'attività riferita al contenitore con la materia della routine: non espandere automaticamente il manuale in attività per ogni contenuto. L'indice completo resta visibile nel manuale.
- [x] **2. Eseguire** `npm test -- src/pages/CollectionPage.test.tsx src/presentation/hooks/useEntities.test.tsx src/lib/services/studyRoutines.test.ts`; attendersi i fallimenti dei nuovi casi.
- [x] **3. Implementare** i due tipi di contenitore, edizione, indice misto, metadati del collegamento, comandi accessibili di ordinamento e azioni esplicite di rimozione. Aggiornare i dati passati ad annulla con tutti i metadati. Separare in biblioteca accessi Materiali, Manuali e raccolte, Repertorio mantenendo le rotte esistenti. Aggiornare selettori e chiamanti raggiunti dalle nuove firme, preservando la semantica attuale delle routine sui contenitori. Localizzare i testi.
- [x] **4. Rieseguire** i test del punto 2 e `npm run i18n:validate`; atteso PASS. Aprire e chiudere l'editor senza salvare non deve cambiare l'ordine.
- [x] **5. Commit** circoscritto: `feat: manage mixed manual indexes across study workflows`.

### Task 7: Backup del nuovo modello e fixture complete

**Files:** modificare `src/application/useCases/{importBackup,exportBackup}.ts`, `src/infrastructure/repositories/dexie/backupRepository.ts`, `src/lib/{sampleData,sampleDataGuitar}.ts`, fixture e fake nei test raggiunti; aggiornare `src/application/useCases/backup.test.ts`, `src/lib/services/backup.test.ts`, `src/infrastructure/dexie/migration.test.ts`; creare `src/lib/sampleData.test.ts`. Aggiornare `PRODUCT.md` per tipi, contenitori e assenza di conversioni legacy.

**Interfaces:**
- Il nuovo backup usa `version: 4`. `SUPPORTED_VERSIONS` contiene soltanto `4`; versioni precedenti, mancanti o sconosciute sono respinte prima delle scritture. Conservare i gateway, le firme pubbliche e il contratto audio esistenti.
- `ImportBackupUseCase.importContent(text: string): Promise<ImportSummary>` valida materiali, segmenti, collegamenti, obiettivi e snapshot; preserva i campi nuovi anziché rimuoverli tramite parsing parziale.
- `seedSampleData(): Promise<void>` e `seedGuitarSampleData(): Promise<void>` restano azioni esplicite. Il set completo illustra anche sessioni/ripassi/programmi; il set chitarra conserva il suo scopo biblioteca, senza introdurre lezioni o sessioni.

- [x] **1. Scrivere test** per round trip v4, backup v3 rifiutato, riferimenti pendenti, ID duplicati e coppie contenitore/materiale duplicate; per ogni errore verificare l'archivio precedente invariato. Testare anche materiale non eseguibile in repertorio/programma, segmento di un altro materiale in un piano/risultato e figurazione storica distinta. Esempi:

```ts
await expect(importer.importContent(JSON.stringify({ version: 3, data: {} }))).rejects.toThrow();
expect(repository.imported).toBeUndefined();
expect(JSON.parse(await exporter.createContent()).version).toBe(4);
expect(new Set((await db.library.toArray()).map(item => item.kind))).toEqual(new Set(["piece", "study", "technique", "exercise", "theory"]));
```

Il test dei seed usa fake-indexeddb e verifica entrambi i set, un manuale misto, riferimenti validi, studio nel repertorio e segmenti con eredità/override. Il set completo aggiunge appartenenza multipla con storico unico e studio in esecuzione. Conservare i test di atomicità e audio già pertinenti; sostituire quelli dedicati ai vecchi backup di fixture.
- [x] **2. Eseguire** `npm test -- src/application/useCases/backup.test.ts src/lib/services/backup.test.ts src/lib/sampleData.test.ts src/infrastructure/dexie/migration.test.ts`; attendersi i fallimenti del nuovo formato e dei seed ancora vecchi.
- [x] **3. Implementare** formato e validazioni prima di `importAll`, riusando gli schemi del Task 1 e l'ammissibilità del Task 4. Aggiornare direttamente tutti i dati dimostrativi: gli attuali manuali diventano contenitori con contenuti espliciti, le sessioni dimostrative vengono riscritte coerentemente, senza codice di conversione. Allineare fake e fixture rimanenti ai nuovi tipi, stati e posizioni; mantenere i test di vecchie migrazioni non coinvolte da questa modifica senza ampliarli.
- [x] **4. Rieseguire** i test del punto 2, poi completare le verifiche d'integrazione sotto; atteso PASS senza regressioni. Rigenerare i dati del browser solo con il reset/seed esplicito già disponibile e dopo aver preservato eventuali altri contesti di lavoro.
- [x] **5. Commit** circoscritto: `feat: update study fixtures and validate version 4 backups`.

## Verifica d'integrazione e chiusura

- [x] Eseguire `npx tsc --noEmit -p tsconfig.app.json`; atteso exit 0. Correggere i chiamanti realmente raggiunti dalle firme nuove, senza sopprimere errori con cast generici.
- [x] Eseguire `npm run ci`; atteso lint, traduzioni, suite e build completati. Confrontare eventuali errori con il baseline delle modifiche preesistenti, senza correggere problemi estranei o dichiararli introdotti da questo lavoro senza prova.
- [x] Attraverso `search_code` verificare che `manual` resti solo tipo di contenitore e che `repertoire` resti concetto/rotta di selezione, non tipo di materiale; verificare assenza dei vecchi contatori dal codice eseguibile. Nessuna migrazione o adattatore legacy nuovo.
- [x] Verificare in browser a larghezza mobile e desktop: creare un materiale, inserirlo in due contenitori, riordinare e annotare pagine, creare segmenti sovrapposti, usare eredità/override, pianificare a BPM diversi, salvare una sessione, modificare le battute e rileggere lo storico invariato.
- [x] Verificare studio nel repertorio e nel programma, esercizio rifiutato, rimozione/annulla del collegamento e salvataggio fallito senza perdere il modulo. Controllare tastiera, nomi accessibili, feedback e quattro lingue.
- [x] Controllare che nessuna modifica di default riscriva un piano esistente; ricontrollare un solfeggio con BPM in una materia teorica. Eseguire un round trip del nuovo backup e confermare che i file audio restino esclusivamente locali.
- [x] Rivedere il diff rispetto alla specifica, riportare verifiche eseguite e limiti reali. Conservare separati i cambiamenti dell'utente. Usare Superpowers verification-before-completion e il percorso di revisione previsto dal metodo scelto.

## Revisione del piano e metodo di esecuzione

Questo documento copre le sezioni 3–6 della specifica con Task 1–2 e Task 5–6; storico e pianificazione con Task 3; repertorio con Task 4; interfaccia con Task 5–6; fixture, confini e backup con Task 7. Le cinque condizioni di Review Focus hanno test assegnati. L'integrazione verifica i criteri trasversali e i flussi reali.

Prima dell'esecuzione l'utente deve rivedere il piano e scegliere il metodo. Si consiglia l'esecuzione diretta nella sessione: i sette task dipendono strettamente dagli stessi tipi e repository, e non ci sono dati di produzione. L'alternativa con agenti separati aggiunge un revisore a ogni task; quella diretta prevede la revisione indipendente finale secondo la skill di esecuzione. Non avviare agenti o modifiche al prodotto prima di questa scelta.


## Esito dell’esecuzione — 2026-10-17

Implementati i sette task nel branch locale `feat/study-materials`, integrando le modifiche preesistenti senza ripristinarle. I commit includono soltanto i cambiamenti separabili in sicurezza; i file con sovrapposizioni restano nel workspace.

Verifiche finali: TypeScript exit 0; 430 test in 59 file PASS; validazione italiano/inglese/spagnolo/tedesco PASS; build PASS; lint PASS escludendo `android/app/build/**`. `npm run ci` resta bloccato dallo stesso errore del baseline nel file Android generato `native-bridge.js` (regola ESLint non trovata); nessuna modifica alla configurazione per nasconderlo.

Chrome headless, con profilo temporaneo separato: desktop 1365×900 e mobile emulato 390×844. Verificati creazione, doppia appartenenza, segmenti sovrapposti, eredità/override, indice misto, riordino, riferimenti/pagine e rimozione/annulla. Una sessione con obiettivo ♩=70 e risultato ♪=56 conserva entrambe le figure e le battute originali dopo modifiche al materiale; i piani salvati restano invariati. Verificati anche solfeggio con BPM in materia teorica, studi nel repertorio/programma, esercizi rifiutati con rollback, round trip v4 e quattro lingue senza overflow. Attivazione da tastiera con Invio verificata. Il salvataggio fallito conserva titolo e segmenti sia nel test di interazione sia nel browser. Audio verificato nei test esistenti; nessun trasferimento aggiunto.

Decisioni di esecuzione: branch dedicato nello stesso workspace per conservare il lavoro in corso; gli import conservano i collegamenti storici a materiali archiviati, continuando a rifiutare tipi non eseguibili e riferimenti mancanti; la materia storica di un’attività/sessione può differire dalla materia attuale del materiale, senza riscritture dello storico. I nuovi collegamenti a programmi continuano a rifiutare materiali archiviati.

La revisione indipendente è stata avviata ma si è interrotta per il limite del servizio. Revisione locale completata con cinque regressioni osservate prima in errore e poi corrette: competenze dei segmenti conservati, segmenti referenziati soltanto dagli snapshot, backup dei materiali archiviati nei programmi, materia storica dopo riclassificazione e figure diverse nella stessa sessione. Nessuna verifica su dispositivo fisico.

# Materiali autonomi, manuali e segmenti

Data: 2026-10-17.
Stato: progetto funzionale approvato in conversazione; specifica scritta da revisionare prima del piano tecnico.
Ambito di questa fase: documentazione, senza modifiche al prodotto o ai dati locali.

## 1. Obiettivo e decisioni dell'utente

Organizzare il materiale di studio distinguendo la natura del contenuto, la sua provenienza e la selezione personale del repertorio. Brani, studi, esercizi e teoria devono essere studiabili singolarmente senza perdere il legame con manuali e raccolte.

Decisioni confermate:

- Ogni materiale è autonomo e riutilizzabile in più contenitori, con una sola identità e un unico storico.
- I tipi sono cinque: Brano, Studio, Esercizio tecnico, Esercizio, Contenuto teorico.
- Esercizio comprende anche solfeggi, bassi di armonia, dettati e analisi: non implica necessariamente esecuzione strumentale.
- Manuali e raccolte hanno un indice piatto e ordinato; possono mescolare tutti i tipi. Non esistono sezioni contenitore o indici annidati.
- Un contenuto teorico può rappresentare un capitolo, ma resta un materiale autonomo, non un contenitore di esercizi.
- I segmenti hanno battuta iniziale e finale facoltative e possono avere obiettivi BPM diversi.
- Il segmento eredita BPM e figura ritmica del materiale quando non ha un proprio obiettivo. L'attività giornaliera può avere un obiettivo differente.
- Il repertorio e i programmi di esecuzione possono comprendere brani e studi.
- Non esistono dati in produzione da migrare: soltanto fixture e dati dimostrativi, da aggiornare direttamente.

L'ultima indicazione prevale sui vincoli di conservazione dei dati precedenti discussi durante il brainstorming e, per questa modifica, sui requisiti di migrazione della precedente specifica `2026-10-15-practice-experience-design.md`. Restano valide le garanzie sullo storico creato con il nuovo modello e i confini delle funzioni esistenti.

## 2. Contesto e scelta architetturale

Il codice possiede già `LibraryItem`, `Segment`, `Collection`, `CollectionItem`, materie, tecniche, pianificazione per segmento, risultati incorporati nelle sessioni, snapshot storici, repertorio con ripassi e programmi di esecuzione.

Attualmente `LibraryKind` mescola contenuti e contenitori (`repertoire`, `manual`, `technique`, `theory`). `Collection.kind` usa la stessa classificazione e limita i contenuti a un tipo. Il manuale è un materiale con `totalExercises` e `currentExercise`; il repertorio usa invece anche un flag indipendente `inRepertoire`.

La soluzione scelta estende queste entità e i livelli applicativi esistenti, separando i tipi di materiale dai tipi di contenitore. Non introduce archivi o servizi paralleli per ogni disciplina.

Alternative considerate:

1. Archivi distinti per brani, studi, solfeggi e armonia: duplicano storico, segmentazione e pianificazione; esclusi.
2. Un archivio comune di materiali con collegamenti a contenitori: soluzione scelta, coerente con il riuso e lo storico unico richiesti.
3. Albero di manuali, capitoli e sottocontenitori: escluso dalla scelta esplicita dell'indice piatto.

## 3. Materiale di studio

Riutilizzare `LibraryItem`. I valori tecnici proposti per `LibraryKind` sono `piece`, `study`, `technique`, `exercise`, `theory`; `technique` identifica il materiale Esercizio tecnico, mentre l'entità `Technique` continua a rappresentare una competenza associabile.

| Proprietà | Regola e significato |
|---|---|
| `id` | Identità unica del materiale in tutta l'app |
| `subjectId` | Materia obbligatoria; riutilizzare le materie esistenti |
| `kind` | Uno dei cinque tipi sopra indicati |
| `title` | Titolo obbligatorio, non vuoto |
| `composer` | Autore/compositore facoltativo; conservare il nome del campo esistente |
| `catalog` | Riferimento facoltativo dell'opera, ad esempio op. 299 n. 1 |
| `notes` | Indicazioni stabili e facoltative sul contenuto |
| `techniqueIds` | Competenze associate al materiale |
| `tags` | Etichette personali facoltative |
| `startBpm` | Riferimento iniziale già previsto per gli esercizi tecnici; non rappresenta l'ultimo risultato |
| `targetBpm`, `noteVal` | Obiettivo generale facoltativo, trattato come coppia BPM/figura |
| `studyStatus` | `not_started`, `in_progress`, `consolidated`; inizialmente `not_started` |
| Campi del repertorio | Riutilizzare flag, data di ingresso e dati del ripasso esistenti |
| `createdAt`, `deletedAt` | Identificazione temporale e archiviazione secondo le convenzioni esistenti |

Lo stato è modificato esplicitamente dall'utente. Sessioni, BPM raggiunti e ripassi non lo cambiano automaticamente. Consolidato, archiviato e presente nel repertorio hanno significati distinti.

Gli obiettivi metronomici sono facoltativi e non richiesti per contenuti scritti o teorici. Le unità musicali e i limiti BPM riutilizzano quelli già supportati. Non aggiungere obblighi di compilazione a campi non pertinenti.

Eliminare dal modello corrente `manual`, `totalExercises` e `currentExercise`: un manuale è un contenitore, e più contenuti possono essere studiati contemporaneamente.

## 4. Materie e competenze

Riutilizzare `Subject` e `Technique`, senza un'altra tassonomia obbligatoria:

- Tipo: che cosa si studia, per esempio Esercizio.
- Materia: l'ambito, per esempio Solfeggio o Armonia.
- Tecniche/competenze: ciò che viene allenato, per esempio lettura ritmica o concatenazioni armoniche.

Un esercizio di arpeggi è un Esercizio tecnico della materia strumentale con competenza Arpeggi. Un basso è un Esercizio della materia Armonia. Uno studio può richiedere le stesse competenze di un esercizio tecnico.

Le competenze restano associabili ai materiali e ai segmenti; quelle scelte nella singola attività o sessione descrivono il lavoro previsto o svolto. Conservare la validazione di appartenenza alla materia prevista dal progetto.

## 5. Manuali, raccolte e collegamenti

Riutilizzare `Collection` con un tipo di contenitore distinto da `LibraryKind`: `manual` oppure `collection`. Entrambi possono contenere qualunque tipo di materiale e non impongono una materia unica.

Proprietà del contenitore: identità, tipo, nome obbligatorio, autore/curatore facoltativo, riferimento editoriale/catalogo, edizione facoltativa, note, materia predefinita, colore e date già supportati. La materia predefinita velocizza la creazione, senza riclassificare materiali già collegati.

Riutilizzare `CollectionItem` per il collegamento molti-a-molti:

| Proprietà | Significato |
|---|---|
| `id`, `collectionId`, `itemId` | Identità del collegamento e riferimenti |
| `position` | Ordinamento esplicito nell'indice |
| `reference` | Numero/riferimento stampato, come Esercizio 37 o Capitolo III |
| `pageStart`, `pageEnd` | Pagine facoltative della specifica fonte |
| `createdAt` | Data del collegamento |

Posizione e riferimento stampato sono distinti. Il primo contenuto inserito può essere l'esercizio 37. Le pagine appartengono al collegamento, perché lo stesso materiale può comparire in edizioni diverse.

Una coppia contenitore/materiale compare una sola volta nello stesso indice. Rimuovere un collegamento non elimina materiale, segmenti, sessioni o appartenenze ad altri contenitori. Eliminare un contenitore rimuove i collegamenti, conservando i materiali.

L'ordine dell'indice è persistito; non viene sostituito dall'ordine alfabetico. Non introdurre drag-and-drop come requisito: comandi accessibili per spostare gli elementi sono sufficienti.

## 6. Segmenti e obiettivi

Riutilizzare `Segment`, mantenendo `itemId`, etichetta, parti/livelli, competenze e date. Aggiungere ordinamento esplicito, note facoltative e `barStart`/`barEnd` facoltativi.

- Il segmento appartiene a un solo materiale e viene condiviso da tutte le sue appartenenze ai contenitori.
- L'etichetta è obbligatoria; le battute possono affiancarla, senza essere inglobate soltanto nel testo.
- Se si specifica l'intervallo, entrambe le estremità sono richieste; per una sola battuta coincidono.
- Le battute sono numeri interi non negativi; 0 consente l'anacrusi. La finale non precede l'iniziale.
- Sono consentiti intervalli sovrapposti, ad esempio 1–16 e 8–10.
- Per contenuti senza battute basta l'etichetta libera. Nessuna seconda gerarchia di paragrafi è richiesta.

`targetBpm` e `noteVal` del segmento sono entrambi assenti oppure formano un obiettivo completo. In assenza della coppia si usa l'obiettivo del materiale; non combinare metà di due obiettivi differenti. L'interfaccia distingue il valore ereditato da quello specifico e consente di tornare all'eredità.

L'attività viene inizializzata con il valore risolto; l'utente può sostituirlo per quella giornata. Modificare un obiettivo generale o del segmento non riscrive attività già pianificate o sessioni salvate. L'aggiornamento di piani esistenti resta un'azione esplicita, secondo il flusso già presente.

## 7. Attività, sessioni e fedeltà storica

Conservare la separazione fra materiale/segmento, intenzione pianificata e risultato. Riutilizzare `Task.plan`, `Session.marks` e gli snapshot, senza introdurre un secondo registro di studio.

Le sessioni e i risultati si riferiscono all'identità del materiale, non alla sua appartenenza a una raccolta. I riferimenti facoltativi al contenitore descrivono il contesto di studio, non dividono lo storico in copie.

Conservare gli obiettivi previsti e i risultati effettivi con le rispettive figure ritmiche, le parti e competenze lavorate, note, umore, concentrazione, sicurezza, segmenti non studiati e registrazioni già supportati.

Lo snapshot dei segmenti comprende etichetta e intervallo di battute al momento della registrazione. La ridenominazione, modifica o eliminazione successiva non deve cambiare la descrizione della sessione passata. Le query collegano per ID; gli snapshot rendono leggibile il contesto storico.

Non confrontare direttamente BPM con figure diverse. Non trasformare l'ultimo BPM, il massimo storico o la frequenza delle sessioni in una valutazione automatica di consolidamento.

Archiviazione e cancellazione dei materiali continuano a rispettare lo storico secondo i flussi esistenti. I collegamenti condivisi devono essere considerati nelle azioni di rimozione, evitando cancellazioni involontarie da altri contesti.

## 8. Repertorio, ripassi ed esecuzioni

`inRepertoire` rimane una proprietà del materiale, disponibile esclusivamente per `piece` e `study`. La vista repertorio comprende entrambi, senza duplicarli. Conservare data di ingresso, ultimo ripasso, prossimo ripasso e intervallo esistenti.

Uno studio può comparire in un manuale, in una raccolta personale e nel repertorio contemporaneamente, con lo stesso storico. I programmi delle esecuzioni selezionano brani e studi anche quando non sono nel repertorio personale.

Validare l'ammissibilità nei servizi, negli import e nei selettori. Un cambio di tipo verso un materiale non ammissibile viene bloccato finché non vengono rimosse esplicitamente le appartenenze a repertorio/programmi incompatibili.

## 9. Interfaccia e flussi

Riutilizzare pagine, componenti e pattern esistenti. La biblioteca offre tre accessi riconoscibili:

1. Materiali: ricerca e filtri per i cinque tipi, materia e stato; creazione/modifica della scheda autonoma.
2. Manuali e raccolte: elenco dei contenitori e indice misto ordinato.
3. Repertorio: selezione di brani e studi, con ripassi e accesso alle esecuzioni esistenti.

Dall'indice si può collegare un materiale esistente oppure crearne uno nuovo e collegarlo, senza copiare la scheda. I selettori non sono limitati a un unico tipo. I dati locali di riferimento/pagina si modificano nel contesto del collegamento.

La scheda materiale mostra i contenitori di appartenenza e lo storico unico. L'editor dei segmenti mostra nome, battute e obiettivo specifico/ereditato. I campi facoltativi rimangono progressivi e le etichette distinguono note stabili, istruzioni dell'attività e note della sessione.

Le azioni si chiamano in modo esplicito: rimuovere dal manuale non equivale a eliminare il materiale. Gestire errori di salvataggio conservando la compilazione. Creare e collegare un nuovo materiale costituisce un'operazione atomica secondo le transazioni esistenti.

Conservare accessibilità, uso da tastiera, feedback e impaginazione mobile. Aggiornare italiano, inglese, spagnolo e tedesco, comprese descrizioni, errori ed empty state.

## 10. Persistenza, fixture e backup: nessuna migrazione di produzione

Non implementare conversioni di manuali precedenti, riassegnazioni di vecchie sessioni, mapping legacy o conservazione del vecchio contatore degli esercizi. Non esistono dati reali da convertire.

Aggiornare direttamente entità, schema di persistenza, validazione, contratti, fake, test, fixture e sample data al nuovo modello. La meccanica necessaria ad aprire il nuovo schema Dexie non deve diventare una conversione dei contenuti precedenti. I dati dimostrativi locali possono essere rigenerati mediante i flussi di reset/seed di sviluppo esistenti; nessuna cancellazione silenziosa a ogni avvio.

Aggiornare entrambe le fonti dimostrative `src/lib/sampleData.ts` e `src/lib/sampleDataGuitar.ts`, oltre alle fixture nei test. Devono illustrare:

- Tutti i cinque tipi di materiale.
- Un manuale con contenuti di tipi diversi.
- Un materiale in più contenitori con un'unica sessione visibile nello stesso storico.
- Uno studio nel repertorio e in un programma di esecuzione.
- Segmenti con battute, obiettivi ereditati e obiettivi specifici.
- Esercizi scritti e contenuti teorici senza BPM.

Backup e importazione seguono il nuovo schema e validano riferimenti e invarianti prima di modificare l'archivio. Non costruire adattatori per backup delle fixture nel vecchio formato: i formati incompatibili sono respinti chiaramente prima di mutazioni. Conservare atomicità dell'importazione e il contratto audio locale già esistente.

## 11. Mappa dell'impatto

| Area | Cambiamento necessario |
|---|---|
| `src/domain/entities/` e porte | Tipi, campi, contenitori misti, obiettivi e snapshot |
| Logica del piano e casi d'uso | Risoluzione obiettivi, validazione, identità condivisa |
| `src/infrastructure/dexie/` e repository | Schema, query, ordinamento e transazioni |
| Servizi biblioteca, collezioni, repertorio ed esecuzioni | Contratti aggiornati e regole di ammissibilità |
| Query di presentazione e hook | Filtri, contenitori misti e storico per identità |
| Biblioteca, schede e moduli dei materiali | Cinque tipi, nuovi campi e appartenenze |
| Pagine e moduli delle collezioni | Tipi di contenitore, indice misto e metadati del collegamento |
| Pianificazione, routine, lezioni e sessioni | Selettori aggiornati, segmenti e obiettivi ereditati |
| Repertorio, eventi, analisi ed esportazioni | Supporto studi, battute storiche e nuovi tipi |
| Schemi e import/export | Nuovi campi e invarianti senza adattatori legacy |
| Sample data, test e traduzioni | Dati coerenti e copertura dei nuovi comportamenti |

Il workspace contiene modifiche dell'utente già in corso. Questa specifica aggiunge un documento distinto; la futura implementazione deve integrarsi senza sovrascriverle o includerle incidentalmente in commit propri.

## 12. Verifica e criteri di accettazione

1. Creare e modificare tutti i cinque tipi; titolo e materia sono validati e i campi facoltativi restano tali.
2. Collegare lo stesso materiale a due contenitori produce una sola scheda e un unico storico, senza duplicazioni nei riepiloghi.
3. Un indice mescola i tipi, mantiene l'ordine dopo riapertura e conserva numero/pagine per ciascun collegamento.
4. Rimuovere un collegamento o un contenitore conserva materiali, segmenti e sessioni.
5. Gli intervalli delle battute sono validati; intervalli sovrapposti e singole battute sono ammessi.
6. Un segmento senza obiettivo usa la coppia del materiale; un obiettivo specifico la sostituisce interamente. L'assenza di entrambi resta un valore mancante, non zero.
7. Le attività possono usare un obiettivo giornaliero diverso; modificare i default non cambia piani già salvati o sessioni precedenti.
8. La sessione conserva obiettivo, risultato, figure ed estremi storici anche dopo modifiche al materiale/segmento.
9. Brani e studi sono ammessi in repertorio ed esecuzioni; altri tipi sono respinti anche attraverso servizi e import.
10. Consolidamento cambia solo per azione esplicita; ultimo studio e progressi sono ricavati dalle sessioni reali.
11. Fixture e sample data usano soltanto il nuovo modello e illustrano i casi descritti; nessuna conversione di dati precedenti è richiesta.
12. Backup nel nuovo formato completa il ciclo export/import; dati invalidi e formati incompatibili vengono respinti senza sostituzioni parziali.
13. Controlli e azioni sono accessibili, leggibili su mobile e tradotti nelle quattro lingue.

Nel piano assegnare test mirati alle regole nuove: validazione, risoluzione degli obiettivi, collegamenti condivisi, snapshot storici e ammissibilità. Aggiornare i test esistenti raggiunti dalla modifica; non duplicare la sola implementazione nei test. Eseguire i controlli di tipi, build e traduzioni previsti dal progetto e verificare in browser i flussi modificati.

## 13. Esclusioni e passo successivo

Fuori ambito: migrazioni di produzione, compatibilità dei vecchi backup delle fixture, indici annidati, tipi separati per ogni disciplina, classificazione strumentale/vocale/scritto obbligatoria, tonalità, metro, difficoltà numeriche, durata indicativa dell'esecuzione e gestione di nuovi allegati.

Non introdurre timer, durata dello studio, journal, analisi automatica o nuove dipendenze per questa riorganizzazione. Conservare le funzioni audio già presenti senza ampliarne import/export.

Il prossimo passo è la revisione di questa specifica scritta. Dopo la sua approvazione si prepara il piano tecnico con Superpowers writing-plans; il piano va quindi rivisto prima di scegliere l'esecuzione. Nessuna implementazione è autorizzata dalla sola redazione di questo documento.

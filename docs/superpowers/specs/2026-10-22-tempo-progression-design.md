# Virtuoso: progressione del tempo e confronto fra figure ritmiche

Data: 22 ottobre 2026.

Stato: specifica scritta approvata dall'utente il 22 ottobre 2026; piano di implementazione in revisione.

Processo: Superpowers brainstorming, percorso architetturale; Ponytail ultra richiesto dall'utente.

Ambito di questa fase: progettazione e documentazione. Nessuna implementazione del prodotto autorizzata da questo documento.

## 1. Obiettivo e decisioni confermate

Suggerire il prossimo tempo di lavoro usando risultati e sicurezza registrati, con regole configurabili nelle routine e nei task ricorrenti. Riconoscere tempi musicalmente equivalenti anche quando cambia la figura ritmica, sia nella progressione sia nel confronto con un target.

Decisioni confermate dall'utente:

- Un successo richiede tempo previsto raggiunto o superato e sicurezza almeno pari alla soglia S.
- N è il numero configurabile di successi necessari. M è facoltativo: se assente servono N successi consecutivi; se presente servono almeno N successi nelle ultime M sessioni valutabili.
- Aumento fisso oppure percentuale, selezionabile nella regola.
- Riduzione facoltativa e configurabile: dopo K insuccessi consecutivi, applicare un decremento fisso oppure percentuale, indipendente dall'aumento.
- Progressioni separate per routine o serie ricorrente e, al loro interno, per brano/sezione, livelli di lavoro e tecniche. Figure equivalenti appartengono allo stesso contesto.
- Ogni variazione richiede accettazione esplicita, con motivazione e anteprima.
- Il target finale del brano/sezione non limita gli aumenti.
- La partenza è proposta dall'ultimo risultato storico compatibile con sicurezza almeno S. L'utente conferma o modifica; in assenza di dati inserisce il tempo manualmente. Lo storico usato per la proposta non alimenta i conteggi iniziali.
- Se aumento e riduzione sono entrambi ammissibili, prevale la riduzione.
- Registrazioni prive dei dati necessari sono non valutabili ed escluse da N/M/K.
- Accettare una variazione avvia un nuovo ciclo e azzera i conteggi; la sola visualizzazione del suggerimento non modifica lo stato.
- L'accettazione aggiorna tutte le occorrenze future compatibili, non completate e non personalizzate, previa anteprima. Le nuove occorrenze ereditano il tempo accettato.
- Una sessione della progressione con tempo almeno pari al target finale e sicurezza almeno S costituisce evidenza di target raggiunto. N/M governa la progressione del tempo di lavoro.
- Modificare i parametri della regola avvia un nuovo ciclo, mantenendo tempo di lavoro e storico.
- I BPM inseriti e salvati restano interi; il limite inferiore passa da 20 a 1, quello superiore resta 400. La rappresentazione interna delle equivalenze non ha questi limiti.

I dettagli operativi nelle sezioni successive rendono queste decisioni implementabili e sono parte della revisione della specifica: in particolare ordinamento delle sessioni, arrotondamenti, versioni del ciclo e protezione degli aggiornamenti concorrenti.

## 2. Contesto del codice e approccio scelto

La scoperta del codice è stata effettuata tramite il grafo codebase-memory-mcp del repository già indicizzato, con letture mirate della documentazione.

Nel codice esaminato:

- `SegmentEntry` contiene sezione, BPM, figura, livelli e tecniche; `SegmentMark` aggiunge sicurezza e tempo di lavoro previsto, mediante `targetBpm` e `targetNoteVal`.
- `Task` contiene `studyRoutineId`, `recurrenceTaskId`, `recurrence`, `customized` e un piano per sezione. La prima occorrenza di una ricorrenza è la radice della serie.
- `Session.taskId` è facoltativo. Le sessioni salvano contesto e snapshot, ma non ancora un'identità autonoma della progressione.
- La query `sessions.bpmSuggestion` richiede tre sessioni con lo stesso massimo BPM e sicurezza media almeno 4; esclude figure diverse e risiede nell'adattatore Dexie.
- `topMark` non restituisce un massimo quando le figure differiscono. Grafici, riepiloghi e query riusano questo comportamento.
- `weeklyProgress` confronta direttamente BPM raggiunto e previsto: la figura deve entrare nel confronto condiviso.
- Le routine possiedono già configurazione, gruppi, generazione e rigenerazione con protezione delle attività personalizzate. La loro adattività attuale governa la selezione del materiale, non la progressione del tempo.
- La validazione BPM e alcuni controlli di inserimento/metronomo usano ancora il minimo 20.

Sono stati valutati tre approcci: ampliare il suggerimento esistente; introdurre una funzione condivisa con stato minimo; costruire un motore di formule programmabili. È scelto il secondo.

Il motore sarà deterministico, nel dominio, senza accesso a React, Dexie, rete o orologio implicito. Riceverà regola, stato e osservazioni pertinenti; restituirà conteggi, stato del target e un eventuale suggerimento motivato. I casi d'uso esistenti gestiranno lettura, conferma e persistenza. Nessun interprete di formule, sistema di plugin o nuova dipendenza.

## 3. Modello musicale condiviso

Un tempo è sempre la coppia BPM e figura. Non confrontare i soli numeri BPM e non sommare i tempi di contesti differenti.

Per le figure già supportate bastano pesi interi, espressi in semicrome:

| Figura | Identificatore esistente | Peso |
|---|---|---:|
| Semibreve | `whole` | 16 |
| Minima | `half` | 8 |
| Semiminima | `quarter` | 4 |
| Croma | `eighth` | 2 |
| Semicroma | `sixteenth` | 1 |
| Minima puntata | `dotted-half` | 12 |
| Semiminima puntata | `dotted-quarter` | 6 |
| Croma puntata | `dotted-eighth` | 3 |

La velocità normalizzata è `BPM × peso della figura`. Due tempi sono equivalenti se il prodotto coincide; confrontare i prodotti per ordinare i tempi e riconoscere le soglie. Con gli input interi supportati il confronto resta esatto.

Esempi obbligatori:

- 50 alla semiminima e 100 alla croma: entrambi 200.
- 30 alla croma e 10 alla semiminima puntata: entrambi 60.
- 30 alla semiminima puntata e 90 alla croma: entrambi 180.

La conversione verso un'altra figura divide la velocità normalizzata per il suo peso. Può produrre una frazione: non arrotondarla prima di confrontare tempi o target e non riscrivere i dati originali.

Conservare sempre BPM e figura inseriti, anche quando una vista usa una figura comune per il confronto. Una conversione visualizzata in forma approssimata deve risultare tale. Le equivalenze descrivono la velocità musicale, senza affermare che studiare con suddivisioni metronomiche diverse abbia identico valore didattico.

## 4. Regola, identità e stato minimo

### Regola

Una configurazione facoltativa appartiene alla routine o alla radice della serie ricorrente. In assenza di configurazione attiva non esiste una progressione automatica implicita.

| Parametro | Validazione |
|---|---|
| N | Intero almeno 1 |
| M | Assente oppure intero almeno N; campo vuoto significa assente |
| S | Intero da 1 a 5, sulla scala di sicurezza esistente |
| Aumento | Tipo fisso o percentuale e valore positivo finito |
| Figura dell'aumento fisso | Una delle figure supportate; il valore fisso è un intero positivo |
| Riduzione | Disattivata oppure configurata con K, tipo e valore |
| K | Intero almeno 1 quando la riduzione è attiva |
| Riduzione fissa | Intero positivo e figura supportata |
| Riduzione percentuale | Percentuale maggiore di 0 e minore di 100 |

Le percentuali possono avere decimali. Non inventare valori salvati per parametri non confermati dall'utente; eventuali valori proposti dal form restano modificabili e richiedono il salvataggio esplicito. Una sola regola per proprietario, senza ulteriori override per gruppo o per task singolo in questa versione.

### Identità della progressione

Il contesto è identificato da:

- proprietario: tipo routine/serie e relativo identificativo stabile;
- brano o materiale della biblioteca e sezione, oppure ambito intero;
- insieme dei livelli di lavoro;
- insieme delle tecniche.

Usare gli ID e i valori stabili esistenti, non titoli o nomi visualizzati. Normalizzare livelli e tecniche come insiemi ordinati senza duplicati: il loro ordine nel form non crea nuove progressioni. La figura ritmica non appartiene all'identità.

Una sezione e il brano intero sono contesti distinti. Nei task combinati di una routine il materiale va risolto per ciascuna sezione: non attribuire tutte le sezioni a un unico `Task.itemId`. Se il contenuto non è identificabile con certezza, mostrare che il contesto non è disponibile anziché fondere progressioni mediante il titolo.

### Stato persistito

Conservare, per ciascuna identità, soltanto identificatore, tempo di lavoro accettato con figura, identificatore/revisione e istante di avvio del ciclo, e riferimento alla versione della regola. Non memorizzare contatori incrementali duplicati: N/M/K sono ricavati dai risultati del ciclo.

La regola resta sul proprietario; gli stati per contesto trovano posto in un archivio Dexie dedicato, con identità univoca e accessi indicizzati. Un contesto non inizializzato non ha un tempo di lavoro implicito uguale al target finale.

I risultati devono conservare il riferimento persistente alla progressione, al ciclo e alla soglia S applicabile al momento della registrazione. Il piano deve poter trasferire il riferimento corretto ai risultati. Riutilizzare `targetBpm` e `targetNoteVal` per il tempo di lavoro previsto; non duplicare la stessa coppia con un nome nuovo.

Questi metadati impediscono che modificare o cancellare un task riassegni sessioni già registrate. Non salvare l'intera routine o l'intera regola in ogni risultato.

## 5. Inizializzazione e cicli

Per un nuovo contesto cercare, fra le sessioni storiche con lo stesso materiale/sezione, livelli e tecniche, l'ultimo risultato con BPM e figura validi e sicurezza almeno S. Per la sola proposta iniziale sono utilizzabili anche risultati di altre routine o sessioni libere compatibili: la separazione riguarda lo stato e i conteggi delle progressioni.

Ordinare per data di studio, poi `createdAt`, poi ID come discriminante stabile. Scegliere l'ultimo risultato qualificato, non il massimo storico e non una media. Mostrare valore, figura, data e sicurezza della fonte. Convertire la proposta solo se necessario, conservando la possibilità di scegliere una coppia BPM/figura rappresentabile e valida.

L'utente conferma o modifica il tempo iniziale. Se manca uno storico qualificato, inserisce il valore manualmente. Prima della conferma il motore non conteggia sessioni né applica suggerimenti. La conferma iniziale usa la stessa anteprima e le stesse garanzie di aggiornamento delle variazioni successive.

Ogni accettazione di aumento/riduzione crea un nuovo ciclo per quel contesto. Una modifica effettiva ai parametri della regola crea nuovi cicli per i contesti già attivati del proprietario, mantenendo i tempi accettati; salvare parametri invariati non azzera nulla. Aggiornare anche i riferimenti dei piani futuri che seguono la progressione, senza riscrivere risultati storici o task personalizzati.

Disattivare la regola sospende suggerimenti e conteggi. Riattivarla avvia un nuovo ciclo; gli eventuali tempi già accettati sono conservati. I nuovi contesti seguono comunque il flusso di inizializzazione.

Il tempo di lavoro di una sezione non viene trasferito automaticamente ad altri contesti, anche quando la regola è comune. Modificare livelli o tecniche seleziona il relativo contesto, che può essere già esistente oppure richiedere inizializzazione.

## 6. Osservazioni e algoritmo

### Sessioni valutabili

Un'osservazione è valutabile se appartiene esplicitamente alla progressione e al ciclo correnti, ha il contesto esatto e contiene tempo raggiunto, figura e sicurezza validi. Il tempo previsto salvato deve essere equivalente al tempo di lavoro del ciclo.

I riferimenti al ciclo vengono conservati al momento della registrazione a partire dal piano pertinente. Non assegnare una sessione al ciclo corrente soltanto perché viene salvata o modificata oggi. Un task rimasto personalizzato con un tempo diverso non produce un falso insuccesso contro la nuova baseline: i suoi risultati restano consultabili ma non appartengono a quel ciclo.

Le sessioni libere non alimentano un proprietario per semplice coincidenza di contenuto. Possono essere usate per la proposta iniziale; un risultato privo di riferimento esplicito al ciclo resta escluso dai conteggi.

Escludere risultati incompleti, contenuti non studiati, attività saltate senza risultati e record precedenti al ciclo. La data di studio non può precedere il giorno locale di avvio del ciclo; nella stessa giornata è il riferimento esplicito al ciclo a separare i risultati. Una figura mancante non viene inventata per rendere un record valutabile. Le registrazioni escluse non sono successi né insuccessi e non occupano posti nella finestra.

Per ogni contesto una sessione conta una volta, secondo il modello attuale di un risultato per sezione. Sessioni distinte nello stesso giorno possono contare separatamente. Non contare pressioni del metronomo o tentativi non salvati. Usare l'ordinamento cronologico stabile definito nella sezione 5 e i metadati del ciclo anche per registrazioni retrodatate.

### Valutazione

Un'osservazione completa è un successo se:

`velocità raggiunta >= velocità di lavoro del ciclo AND sicurezza >= S`.

Ogni altra osservazione completa è un insuccesso. Usare la sicurezza del risultato pertinente, senza mediarla con quella di altre sezioni. Umore e concentrazione restano informazioni consultabili e non modificano il calcolo.

### Aumento e riduzione

- M assente: aumento ammissibile se gli ultimi N risultati valutabili sono tutti successi.
- M presente: aumento ammissibile se negli ultimi M risultati valutabili del ciclo si trovano almeno N successi. Non è necessario attendere M risultati quando ne esistono già almeno N e la condizione è soddisfatta.
- Riduzione attiva: riduzione ammissibile dopo almeno K insuccessi consecutivi in coda ai risultati valutabili.
- Se entrambe le condizioni sono soddisfatte, proporre soltanto la riduzione.
- Altrimenti mantenere il tempo e mostrare il progresso verso i requisiti.

Un caso importante è N=3, M=5, K=2 e sequenza successo/successo/successo/insuccesso/insuccesso: la riduzione prevale sull'aumento.

Il suggerimento espone direzione, tempo corrente, tempo proposto e motivo, includendo numeratore/denominatore della finestra o numero di insuccessi. Visualizzarlo o chiuderlo non modifica il ciclo. Senza accettazione il tempo resta invariato e il suggerimento viene ricalcolato sui dati attuali.

### Calcolo del nuovo tempo e arrotondamenti

Calcolare rispetto al tempo di lavoro accettato, non rispetto al massimo raggiunto nell'ultima sessione.

- Passo fisso: sommare o sottrarre la velocità equivalente al valore fisso nella figura configurata. Il passo conserva il suo significato quando il risultato è espresso in un'altra figura.
- Passo percentuale: moltiplicare il tempo corrente per `1 + p/100` oppure `1 - p/100`. La figura di riferimento per la proposta percentuale è quella del tempo di lavoro corrente.
- Per le percentuali arrotondare una sola volta al BPM intero più vicino nella figura di riferimento; a metà arrotondare verso l'alto. Se il valore così ottenuto coincide con quello corrente, proporre una differenza di 1 BPM nella direzione prevista, quando valida.
- Per i passi fissi conservare il risultato musicale esatto. Se non è esprimibile come intero nella figura corrente, usare una figura supportata che lo rappresenti esattamente: preferire la figura del passo, poi l'ordine delle figure già definite nel progetto. Mostrare il cambio di figura nell'anteprima.
- Non forzare risultati nulli o negativi dentro il range valido. Se il risultato non è rappresentabile con una coppia intera fra 1 e 400 nelle figure supportate, nessun suggerimento applicabile: spiegare il limite e consentire di modificare la regola o il tempo.

Esempi: 70 alla semiminima con aumento del 3% propone 72 alla semiminima; 70 con aumento dello 0,1% propone 71. Da 50 alla semiminima, un aumento fisso di 1 alla croma propone 101 alla croma, evitando di approssimare il risultato a 51 alla semiminima. Una riduzione da 1 alla semiminima del 5% non produce una variazione valida di almeno 1 BPM nella figura di riferimento.

La coppia effettivamente mostrata e accettata diventa il nuovo tempo di lavoro. I confronti fra esecuzioni e target restano esatti e non usano le approssimazioni di visualizzazione. I limiti tecnici non costituiscono un tetto legato al target finale.

## 7. Accettazione e pianificazione futura

L'accettazione è un'azione distinta dal salvataggio della sessione. Una sessione registrata correttamente non viene annullata se il calcolo o l'applicazione del suggerimento fallisce.

L'anteprima elenca tempo precedente e nuovo con figure, motivo, contesto, numero e date dei task modificabili, oltre alle esclusioni pertinenti. Per esempio: «Da 70 a 72 alla semiminima; 3 successi su 4 con sicurezza almeno 4; aggiornamento di 4 attività future».

Sono aggiornabili le occorrenze del medesimo proprietario e contesto, dalla prossima attività prevista nella giornata corrente in avanti, ancora aperte, non eliminate, non saltate e non personalizzate. Non riscrivere il piano già eseguito: escludere l'attività sorgente e le voci per cui risultano già registrazioni di studio. Le altre sezioni dei task combinati restano invariate. Le esclusioni fanno parte dell'anteprima.

Se non esistono task modificabili, la conferma può comunque aggiornare il tempo della progressione per le prossime generazioni, dichiarando che modifica zero attività esistenti.

La conferma aggiorna atomicamente stato, ciclo e piani selezionati. Il generatore e il rigeneratore usano il tempo accettato per le nuove occorrenze compatibili e conservano la protezione delle personalizzazioni. Non rigenerare l'intera routine per cambiare un BPM, né marcare i normali aggiornamenti della progressione come personalizzazioni manuali.

Prima del commit rileggere versione della regola, ciclo, osservazioni e attività aggiornabili. Se nuovi dati o una personalizzazione cambiano proposta o anteprima, mostrare il risultato aggiornato e richiedere una nuova conferma. Un doppio click o una seconda scheda non può applicare due volte lo stesso suggerimento. Un errore lascia invariati tempo, ciclo e piani.

Rinominare o eliminare un task non riassegna la progressione. La radice di una serie e i riferimenti necessari restano conservati quando esistono occorrenze o risultati collegati; non promuovere automaticamente una figlia a proprietario con un nuovo conteggio.

## 8. Target finale, statistiche e storico

Il tempo finale deriva dal target completo della sezione, quando presente, altrimenti dal target completo del materiale secondo il modello esistente. Una coppia incompleta non è un target confrontabile. Il tempo previsto nella sessione è invece il tempo di lavoro di quel momento.

Per riconoscere il target leggere i risultati completi attribuiti alla stessa progressione e allo stesso contesto, anche nei cicli precedenti. Velocità almeno pari al target finale e sicurezza almeno pari alla S registrata costituiscono evidenza del raggiungimento. Il filtro sul ciclo corrente e sul tempo di lavoro previsto serve ai conteggi N/M/K, non cancella le evidenze del target finale.

Mostrare data, tempo e figura originali e contesto; non basta il BPM massimo globale di un brano. La soglia applicata alla registrazione è conservata nei metadati, così cambiare regola non riscrive la valutazione storica. Se il target finale viene modificato, il confronto con il nuovo target usa gli stessi risultati originali e la loro soglia registrata.

Il raggiungimento resta evidenza storica anche se dopo si lavora più lentamente. Modificare o cancellare esplicitamente la sessione che lo provava aggiorna l'evidenza. Per brani divisi in sezioni mostrare evidenze per sezione e contesto, senza dedurre un raggiungimento complessivo da una singola sezione.

La funzione musicale condivisa deve raggiungere query, metriche, grafici e riepiloghi che confrontano o ordinano tempi. `topMark` può confrontare figure diverse sulla velocità normalizzata e restituire il risultato originale vincente; un massimo di sessione conserva la funzione di riepilogo e non diventa prova di successo di ogni sezione.

Nei grafici usare una figura comune dichiarata per la serie, mantenendo i valori originali nei dettagli. Non confondere il target finale con la percentuale di sessioni in cui è stato raggiunto il tempo di lavoro previsto. Quest'ultima metrica conserva il proprio significato, correggendo il confronto fra figure; in assenza di metadati di progressione non inventare una soglia S storica.

Correzioni e cancellazioni delle sessioni ricalcolano i conteggi del ciclo corrente e le evidenze. Non annullano automaticamente una variazione già accettata e non modificano nuovamente il calendario.

## 9. Interfaccia, validazione ed errori

Riutilizzare form, campi BPM/figura, messaggi e componenti di anteprima esistenti. Nessuna nuova pagina autonoma è necessaria.

- Configurazione in `RoutineBuilder` e nel flusso del task ricorrente, con campi condizionali per M e riduzione.
- Etichetta S coerente con «Sicurezza» già presente nell'app; spiegare che M vuoto richiede successi consecutivi.
- Stato del contesto e proposta iniziale o successiva nel flusso del task/sessione. Distinguere tempo di lavoro e target finale anche nelle etichette.
- Dati mancanti e contesti esclusi spiegati, senza trasformarli in valutazioni basse.
- Pulsanti di conferma disabilitati durante il salvataggio, errori visibili e riprovabili, nessun messaggio di successo anticipato.
- Campi e motivazioni accessibili da tastiera e lettore di schermo; nessuna informazione affidata al solo colore.
- Traduzioni nelle quattro lingue già supportate: italiano, inglese, spagnolo e tedesco.

Portare il minimo BPM a 1 in schema, controlli, metronomo, backup e validazioni applicative pertinenti. I passi aritmetici sono distinti dai BPM assoluti: una percentuale o un incremento non usa impropriamente lo schema BPM.

La cadenza del metronomo deve rispettare i tempi lunghi senza anticipazioni o raffiche dopo sospensione/ripresa. Mantenere la sua logica audio esistente, con verifica mirata dell'estensione del range, senza sostituirla con un timer per lo studio.

Validare configurazione e relazioni al confine di salvataggio e importazione. Nessun risultato incompleto deve diventare `NaN`, zero o una falsa figura predefinita nei calcoli.

## 10. Persistenza, migrazione e backup

Riutilizzare Dexie e i port/casi d'uso esistenti. Aggiungere soltanto la persistenza necessaria per gli stati dei contesti e i riferimenti ai cicli. Il piano sceglierà i nomi dei campi e la versione di schema successiva a quella realmente presente, considerando le modifiche già in corso nel workspace.

La migrazione conserva tutti i BPM, figure, risultati e collegamenti esistenti. Non inizializza progressioni o soglie per deduzione e non azzera l'archivio. Le vecchie sessioni compatibili restano utilizzabili come fonte della proposta iniziale; senza attribuzione certa a un ciclo non diventano automaticamente osservazioni del nuovo motore.

Esportare e importare configurazioni, stati e metadati necessari a continuare una progressione. Le versioni precedenti supportate, prive di questi campi, restano importabili con progressione assente. Validare proprietà, ID, contesti, cicli, limiti numerici e coppie tempo/figura prima di sostituire dati. Le relazioni devono restare coerenti con la strategia di ripristino degli ID già adottata dal progetto.

Un backup invalido non deve lasciare importazioni parziali, proprietari confusi o progressioni associate a materiali diversi. Esportare i dati, senza introdurre audio binario, percorsi locali o servizi esterni. Adeguare i CSV già esistenti soltanto dove serva a mantenere distinguibili tempo previsto, tempo raggiunto e rispettive figure; nessun nuovo importatore CSV.

## 11. Mappa delle aree raggiunte

Questa è una mappa di responsabilità, non un piano di patch definitivo.

| Area | Cambiamento richiesto |
|---|---|
| `src/domain/constants/noteValues.ts` e logica musicale condivisa | Pesi, conversioni e confronto esatto |
| `src/domain/entities/common.ts`, `session.ts`, `task.ts`, `src/domain/ports/studyRoutine.ts` | Regole, contesti, stato e metadati del ciclo |
| `src/domain/logic/plan.ts`, `sessionContext.ts` e salvataggio sessioni | Trasferire fedelmente tempo previsto e identità, senza riattribuzione retroattiva |
| Logica di dominio della progressione | Algoritmo puro, finestre, priorità, passi, arrotondamenti e motivazioni |
| `src/application/useCases/` e port pertinenti | Inizializzazione, configurazione e accettazione con anteprima e controllo di versione |
| `src/infrastructure/dexie/` e repository task/routine/sessioni | Schema, indici, letture circoscritte, aggiornamento atomico e protezione delle relazioni |
| `src/lib/domain/studyRoutineGenerator.ts` e generazione ricorrenze | Ereditare il tempo accettato mantenendo personalizzazioni e contesti combinati |
| `RoutineBuilder`, flusso task ricorrente, `BpmSuggestion` e anteprime esistenti | Configurazione e suggerimenti espliciti, stato e spiegazioni |
| `src/lib/schemas.ts`, `BpmCoupler`, campi tempo e `PracticeMode` | Range coerente 1–400 e validazione dei nuovi parametri |
| `sessionMetrics`, `progress`, `readiness`, query di presentazione, grafici e riepiloghi chiamanti | Correggere confronti e ordinamenti fra figure senza cambiare il significato delle metriche |
| Import/export, migrazioni, fixture e sample data pertinenti | Conservare compatibilità e riferimenti; nessun dato inventato |
| File lingua, `PRODUCT.md` e documentazione pertinente | Contratto e testi coerenti con tempo di lavoro e target finale |

Rimuovere il calcolo fisso precedente quando sostituito dal nuovo flusso, evitando due suggeritori in conflitto. Non trasformarlo in una regola implicita attiva sulle vecchie routine.

## 12. Verifiche e criteri di accettazione

Le verifiche appartengono alla futura implementazione. In questa fase si verifica soltanto la completezza e coerenza del documento.

1. Tutte le equivalenze della sezione 3 sono riconosciute esattamente; conversioni di andata/ritorno mantengono velocità e valori originali. Una conversione frazionaria non fa raggiungere falsamente una soglia.
2. N/M/S e K, tipi di passo, percentuali e figure sono validati anche all'importazione. Campo M vuoto non diventa zero e M minore di N viene rifiutato.
3. Senza M, un insuccesso azzera la sequenza di successi; con M, la finestra scorre sulle sole sessioni valutabili e non attende necessariamente M registrazioni.
4. Dati mancanti sono neutrali; umore, concentrazione e risultati di altre sezioni non influenzano successo o insuccesso.
5. Sicurezza sotto S provoca insuccesso anche con tempo superiore al previsto; tempo sotto il previsto provoca insuccesso anche con sicurezza alta.
6. Riduzione configurata dopo K insuccessi; caso di conflitto con aumento risolto a favore della riduzione.
7. Incrementi e decrementi fissi conservano il significato fra figure. Percentuali sono calcolate sul tempo di lavoro, con arrotondamento unico e variazione minima effettiva; risultati non rappresentabili non vengono applicati.
8. Stesso contesto con figure diverse condivide i conteggi. Routine o serie diverse, sezioni diverse, livelli diversi e tecniche diverse restano isolati; cambiare soltanto l'ordine degli insiemi non crea un nuovo contesto.
9. Il caso di task combinato risolve correttamente materiale e sezione. Task radice e figlie appartengono alla stessa serie; rimozioni e rigenerazioni non perdono l'identità.
10. L'inizializzazione sceglie l'ultimo risultato con sicurezza sufficiente, senza usare il massimo; i contatori iniziano a zero. Assenza di storico e conferma di un valore modificato funzionano.
11. Accettazione, chiusura del suggerimento e salvataggio della sessione hanno effetti distinti. Solo una conferma riuscita cambia il tempo e il ciclo.
12. Anteprima e applicazione raggiungono tutte e sole le occorrenze aggiornabili; proteggono personalizzazioni, voci già studiate, altre sezioni, storico e target finale. Anche zero occorrenze esistenti è un esito esplicito valido.
13. La generazione futura usa il tempo corrente; la rigenerazione conserva stato e personalizzazioni. Errori di salvataggio, doppi click, seconda scheda e anteprima divenuta obsoleta non causano aggiornamenti parziali o doppi aumenti.
14. Ogni accettazione e modifica effettiva della regola avvia un nuovo ciclo; salvataggi invariati e cambio di figura equivalente non riutilizzano vecchi successi né azzerano arbitrariamente un contesto.
15. Sessioni retrodatate, modifiche e cancellazioni usano un ordinamento stabile e non riassegnano risultati ai cicli. Correggere una sessione ricalcola le evidenze senza annullare variazioni già accettate.
16. Il target finale viene riconosciuto solo con tempo equivalente sufficiente e sicurezza qualificata del contesto; assenza del target è esplicita. Il cambio di ciclo mantiene le evidenze precedenti. La progressione continua oltre il target e il riepilogo non attribuisce il successo di una sezione all'intero brano.
17. Query, grafici e riepiloghi confrontano figure differenti correttamente, mostrano la figura di riferimento e preservano i valori originali nei dettagli.
18. Si possono inserire, salvare e ripristinare 10 BPM alla semiminima puntata, 1 BPM e 400 BPM; zero, valori negativi e 401 BPM sono rifiutati come input assoluti. Metronomo verificato ai limiti, inclusa sospensione/ripresa.
19. Migrazione di un archivio precedente e round trip di backup conservano risultati, regole, stati e collegamenti. Backup incompleti o incoerenti falliscono prima di modificare l'archivio.
20. Configurazione, proposta iniziale, motivazione, anteprima ed errori sono accessibili e tradotti nelle quattro lingue.

Usare test mirati della funzione pura per le combinazioni di regole, test di integrazione Dexie per cicli/accettazione/migrazione/backup e pochi test di interfaccia sui flussi principali. Verificare realmente il metronomo per il range esteso; non sostituire una prova audio con una sola asserzione sulla validazione numerica.

## 13. Confini e prossimo passaggio

Fuori ambito: riconoscimento automatico di errori o BPM dall'audio, machine learning, formule utente, nuove strategie di programmazione degli esercizi, override per gruppo, cloud, notifiche, timer di studio, rifacimento della navigazione e nuove pagine di analisi.

Il workspace contiene modifiche preesistenti a form, sessioni, backup e schema. Questa fase aggiunge soltanto la specifica e non incorpora quelle modifiche in un commit. Il futuro piano deve lavorare sullo stato effettivo senza sovrascriverle.

La specifica scritta è stata approvata dall'utente. Il piano preparato con `writing-plans` è in `../plans/2026-10-22-tempo-progression.md` e richiede revisione e scelta del metodo di esecuzione. L'approvazione di questa specifica non avvia da sola modifiche al prodotto.

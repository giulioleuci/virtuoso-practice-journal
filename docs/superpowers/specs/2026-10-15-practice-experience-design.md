# Virtuoso: risultati per segmento, sessioni libere e pianificazione prevedibile

Data: 15 ottobre 2026

Stato: specifica da revisionare prima del piano di implementazione

Processo: Superpowers brainstorming, percorso architetturale

Ambito autorizzato in questa fase: documentazione della soluzione concordata.

## 1. Obiettivo e decisioni confermate

Rendere rapida la registrazione dello studio e leggibili i risultati, mantenendo l'organizzazione di Virtuoso in giornata, pianificazione, biblioteca, lezioni e progressi. Separare il lavoro previsto da quello effettivamente svolto, senza introdurre un sistema alternativo di navigazione.

Decisioni dell'utente, che prevalgono sulle proposte precedenti:

- Registrare umore, concentrazione e sicurezza per ogni segmento studiato di un task.
- Eliminare dalla proposta pratica deliberata e modalità guidata.
- Mantenere registrazione e riascolto audio locali. Esportazione, backup e importazione trasferiscono esclusivamente dati: nessuna esportazione o importazione dei file audio. Il limite deve essere esplicito nell'interfaccia.
- Aggiungere esportazione CSV per analisi esterne.
- Semplificare sessioni libere e creazione delle routine, consentendo la personalizzazione successiva della matrice.
- Salvare i risultati senza riscrivere implicitamente la pianificazione futura; aggiornamenti facoltativi con anteprima.
- Sostituire la percentuale complessiva di preparazione con evidenze e copertura dei dati.
- Escludere quaderno, journal, pagine autonome e cartelle di annotazioni.
- Non introdurre timer, cronometro dello studio, durata delle sessioni, obiettivi in minuti o statistiche del tempo studiato.

La durata tecnica di una clip è utilizzabile nel lettore audio e non costituisce tempo di studio. Il metronomo esistente rimane uno strumento musicale.

## 2. Contesto del codice e scelta architetturale

Nel codice esaminato:

- `Session.taskId` è obbligatorio; `findOrCreateForLog` cerca o crea un task anche per una sessione libera.
- `SegmentMark` estende `SegmentEntry` con sicurezza e BPM obiettivo; i risultati per segmento sono già incorporati in `Session.marks`.
- `LogSessionUseCase` richiede un task persistito e lo completa al salvataggio.
- `TaskSessionForm` preseleziona una successiva attività compatibile per trasferirvi i risultati; per routine adattive può avviare una rigenerazione.
- `regenerateFromDate` elimina e ricrea le attività future non completate della routine, senza una distinzione esplicita per quelle personalizzate.
- `RoutineBuilder` possiede già gruppi, pool, matrice e opzioni di generazione.
- `calculateReadiness` combina BPM, sicurezza e frequenza con pesi 40/35/25; il BPM è il massimo storico e le sezioni prive di valutazione non contribuiscono alla media delle sezioni valutate.
- Il backup JSON attuale usa un contenitore versionato; importazione e validazione sono già centralizzate.

Sono state considerate tre direzioni:

1. Alleggerire solo l'interfaccia, mantenendo task artificiali per le sessioni libere: diff minore, ma conserva la dipendenza che causa ambiguità sul completamento.
2. Rendere autonoma la sessione e riusare risultati incorporati, routine e flussi esistenti: soluzione scelta.
3. Unificare task, sessioni e testi in un contenitore generico: complessità non richiesta, esclusa.

La spec cambia i confini necessari del modello, senza riscrivere i livelli applicativi o introdurre un secondo motore di pianificazione. Il workspace contiene modifiche in corso: i file citati sono una mappa del contesto, non un elenco immutabile di patch.

## 3. Modello dati e invarianti

### Task

Rappresenta un'intenzione pianificata: materia, data, contenuti previsti, piano per segmento, ricorrenza/routine e completamento. Le istruzioni operative restano sul task.

### Sessione

Rappresenta studio effettivamente svolto. Il collegamento al task diventa facoltativo. La sessione conserva direttamente materia, tipo di contenuto, riferimenti a brano/raccolta quando presenti, titolo e contesto storico; non ricava questi dati esclusivamente dal task.

I riferimenti stabili servono alle query; lo snapshot conserva nomi e descrizioni al momento della registrazione. La cancellazione o rinomina di un elemento non deve rendere illeggibile lo storico. Non si copiano nel record della sessione le regole di ricorrenza o l'intero piano futuro.

Una sessione libera non crea task e non completa un'attività individuata per coincidenza di data, titolo o brano. Una sessione aperta da un task conserva quel collegamento esplicito.

### Risultato per segmento

Riutilizzare `Session.marks` come sede dei risultati. Ogni voce studiata contiene identificazione del segmento, BPM e figura musicale quando pertinenti, livelli, tecniche, umore, concentrazione e sicurezza. Le tre valutazioni appartengono al risultato, mai a `Task.plan`.

Ogni segmento compare al massimo una volta nella stessa sessione. Il lavoro sul brano intero o su contenuti senza segmenti usa una sola voce con ambito intero, secondo il modello già esistente. Conservare etichette storiche anche quando un segmento viene eliminato.

I segmenti del task dichiarati non studiati sono distinti da quelli con risultati. Questa distinzione è esplicita nella sessione, usando riferimenti e snapshot; non si simula con valutazioni pari a zero. Il modello deve poter ricostruire quali segmenti erano previsti al momento del salvataggio.

### Audio

Una registrazione locale ha un identificativo stabile indipendente dagli ID numerici importabili, un collegamento alla sessione e facoltativamente al suo segmento, data, titolo facoltativo, tipo del file e durata tecnica. Il contenuto binario è separato dai dati esportabili.

Distinguere metadati trasferibili da disponibilità locale del contenuto. Il possesso dei metadati non prova che il file audio sia presente. Non introdurre un'entità journal.

## 4. Umore, concentrazione e sicurezza

### Significato e scale

Le tre dimensioni sono indipendenti e usano valori interi da 1 a 5:

| Campo | Domanda riferita al segmento | Etichette proposte da localizzare |
|---|---|---|
| Umore | Come ti sei sentito lavorando su questo passaggio? | Molto negativo, negativo, neutro, positivo, molto positivo |
| Concentrazione | Quanto sei riuscito a restare concentrato? | Molto bassa, bassa, media, alta, molto alta |
| Sicurezza | Quanto ti senti sicuro nell'esecuzione? | Conservare la scala di sicurezza esistente |

Le nuove sessioni richiedono tutte e tre le risposte per ciascun segmento dichiarato studiato. Un segmento non studiato non richiede risposte e non partecipa alle medie. I record precedenti e i backup precedenti possono avere campi assenti: conservare questa assenza senza assegnare valori neutri.

Una modifica a un record storico non obbliga a inventare le valutazioni storicamente mancanti; gli eventuali nuovi valori sono inseriti esplicitamente dall'utente.

### Interfaccia

- Elenco compatto dei segmenti con tre selezioni chiaramente etichettate per ogni segmento.
- Nessuna valutazione preselezionata o ereditata automaticamente dall'ultima sessione.
- Azione esplicita «Applica questi valori agli altri segmenti» per copiare le risposte ai segmenti studiati; se sostituisce risposte già presenti, il testo deve renderlo evidente e l'azione deve essere annullabile.
- Indicazione di risposte mancanti accanto al segmento, senza perdere la compilazione già effettuata.
- Distinzione accessibile tra selezionato, non risposto e non studiato; colore ed emoji non sono l'unico segnale.
- Disponibilità delle tre valutazioni anche per contenuti di teoria, con sicurezza intesa rispetto alla competenza studiata.

### Lettura dei dati

Mostrare gli andamenti per segmento e il numero di osservazioni disponibili. Le statistiche di ciascuna dimensione usano solo risposte effettive. Nei riepiloghi per sessione calcolare prima il riepilogo interno della sessione, poi aggregare le sessioni: un task con molti segmenti non deve pesare automaticamente più degli altri.

Non dedurre causalità dalle associazioni osservate. Umore e concentrazione non modificano preparazione, piano o frequenza delle routine.

## 5. Sessione libera

Flusso principale: materia, contenuto studiato, nota facoltativa e risultati. Materia e data sono ricavate dal contesto quando univoche; la data resta modificabile con le regole applicabili di recupero già presenti.

Il contenuto è testo libero oppure un elemento della biblioteca. Collegando un brano si possono selezionare i segmenti effettivamente studiati. Per contenuti senza segmentazione le tre valutazioni compaiono una sola volta.

I dettagli musicali ulteriori restano accessibili progressivamente. La rapidità non elimina l'obbligo delle tre valutazioni per i segmenti studiati. Non aggiungere fasi di avvio/arresto della sessione o misurazioni temporali.

Riutilizzare gli strumenti e il flusso di aiuto esistenti quando pertinenti, senza introdurre modalità guidata o domande pedagogiche obbligatorie. Le note restano contestuali alla sessione.

## 6. Registrazione e riascolto esclusivamente locali

### Funzioni

- Registrare e interrompere una clip con azioni esplicite.
- Riascoltare, conservare, rinominare ed eliminare la clip.
- Associazione alla sessione e, se selezionato, al segmento.
- Consultare registrazioni passate e alternare il riascolto di due clip dello stesso contenuto; nessuna analisi automatica, montaggio o sincronizzazione richiesta.
- Conservare bozze di registrazioni fino al salvataggio o all'abbandono esplicito, evitando file orfani. Abbandonare testo e clip non deve cancellare altro materiale già salvato.

Usare funzionalità della piattaforma e dipendenze già disponibili quando adeguate. Persistenza locale durevole per la piattaforma supportata, senza backend. Richiedere accesso al microfono al primo uso, gestire permesso negato, indisponibilità, interruzioni, formato non supportato e spazio insufficiente. Non mostrare come salvata una clip che non è stata persistita.

### Contratto di esportazione e importazione

Backup JSON e CSV contengono solo dati. Nessun blob, base64, archivio audio, percorso assoluto del dispositivo o URL locale viene esportato. Non offrire importazione, esportazione o condivisione dei file audio nell'app.

Il backup può conservare metadati e identificativi delle clip per mantenere il contesto storico. Dopo un ripristino, una clip è riproducibile solo se il relativo contenuto locale esiste ancora ed è verificato tramite il suo identificativo stabile. Non associare file usando soltanto ID numerici, titoli o date.

Importare i dati non deve eliminare i contenuti audio locali né ricollegarli a sessioni diverse per collisione di ID. I contenuti non più collegati dopo un'importazione restano preservati; non introdurre una pulizia automatica distruttiva. Il riepilogo dell'importazione comunica quante registrazioni referenziate risultano disponibili e quante no.

### Testi obbligatori nell'interfaccia

| Punto | Informazione visibile prima dell'azione |
|---|---|
| Registratore / elenco clip | «Le registrazioni restano su questo dispositivo. Non sono incluse nei backup e non possono essere importate o esportate.» |
| Esportazione backup | Pulsante «Esporta backup dei dati»; testo «Include dati e valutazioni. Non include i file audio.» |
| Importazione | «Importa solo dati. I file audio non vengono ripristinati. Le registrazioni locali non vengono importate o esportate.» |
| CSV | «Esporta dati CSV — senza file audio» |
| Clip non disponibile | «Audio non disponibile su questo dispositivo. Il backup contiene solo i dati della registrazione.» |

Accanto al registratore chiarire anche che cancellare i dati dell'app o perderne l'archivio locale può rendere irrecuperabili le registrazioni. Il messaggio non può essere confinato a documentazione esterna o a un tooltip. Non promettere un backup completo delle registrazioni.

La cancellazione esplicita di una clip rimuove contenuto e metadati locali coerentemente. La cancellazione di una sessione con clip deve comunicarne l'effetto e preservare le garanzie di annullamento già offerte dal flusso usato.

## 7. Routine semplici e matrice successiva

### Creazione

Percorso iniziale: selezione della materia e dei contenuti, giorni della settimana, quantità di elementi per giornata, anteprima delle attività e creazione. Nome suggerito modificabile; nessuna domanda sul tempo.

Esempio: cinque esercizi, lunedì/mercoledì/venerdì, due elementi al giorno. Creare un gruppo e compilare la matrice esistente. Riutilizzare generatore, vincoli e validazioni attuali. L'anteprima deve mostrare carichi e eventuali limiti reali del pool.

Orizzonte di generazione e limiti già esistenti hanno valori predefiniti espliciti nel riepilogo; opzioni avanzate accessibili. L'adattamento automatico della pianificazione è disattivato nelle nuove routine finché l'utente non lo sceglie. Le routine esistenti mantengono le preferenze persistite.

### Personalizzazione

«Personalizza la settimana» apre la matrice dei valori effettivi senza mutarli. Consente quantità diverse per giorno, più gruppi, pool e opzioni avanzate. Usare la stessa configurazione persistita del percorso semplice, non due copie da sincronizzare.

Il riepilogo rappresenta anche configurazioni irregolari. Non appiattire una matrice personalizzata tornando al riepilogo. L'uniformazione della settimana è un'azione esplicita, con anteprima delle differenze.

Le modifiche dichiarano la data di applicazione e non riscrivono sessioni o attività completate. Le attività future personalizzate vengono preservate dalla rigenerazione. Registrare la personalizzazione al livello minimo necessario, con un indicatore esplicito sul task; non tentare di dedurla da confronti fragili con il generatore.

## 8. Salvataggio e completamento

Il salvataggio valida i risultati, conserva sessione e snapshot e aggiorna il completamento del task associato nella stessa transazione sui dati. La persistenza delle clip deve essere coordinata con questo salvataggio, con compensazione in caso di errore e senza sessioni che dichiarino file salvati inesistenti.

- Sessione libera: nessun task creato o completato.
- Sessione da task con tutti i segmenti previsti studiati: task completato.
- Sessione da task con segmenti non studiati: task incompleto, con residuo visibile.
- Più sessioni dello stesso task: il completamento può derivare dalla copertura cumulativa dei segmenti previsti, senza richiedere di rivalutare quelli già studiati. Il calcolo usa i riferimenti dei risultati, non valori di umore o sicurezza.
- Task senza segmentazione: la singola voce studiata soddisfa il completamento.

Non ricavare il piano previsto dalle sole voci effettivamente studiate: lo snapshot della copertura deve conservare la differenza. Modifica o cancellazione di una sessione ricalcola il completamento rispetto alle sessioni rimanenti, senza annullare lo studio registrato altrove. Eventuali nuovi segmenti aggiunti successivamente al task richiedono nuova copertura.

Salvare non trasferisce risultati a task futuri e non avvia rigenerazioni implicite nelle routine prive di adattamento esplicitamente attivato.

## 9. Aggiornamento facoltativo della pianificazione

Dopo il salvataggio e nel dettaglio della sessione è disponibile «Aggiorna la prossima attività». Il risultato del salvataggio non dipende dall'uso di questa azione.

La proposta mostra attività destinataria, data e differenze per segmento. Nessuna modifica è applicata prima della conferma. Proporre inizialmente i soli BPM e relative figure effettivamente presenti; livelli e tecniche richiedono selezione esplicita. Non trasferire umore, concentrazione o sicurezza come campi del piano.

Se il campo di origine è assente, conservare il valore pianificato. L'anteprima deve distinguere BPM raggiunto e obiettivo futuro: l'utente decide se sostituire l'obiettivo. In assenza di un'attività compatibile, offrire facoltativamente la creazione con revisione dei dati.

La successiva apertura di un contenuto mostra gli ultimi risultati e offre «Riparti da questi valori» per i parametri musicali, senza attribuire nuove valutazioni o cambiare il piano automaticamente.

Per routine con adattamento esplicitamente attivo, aggiornamento e rigenerazione sono tracciabili nell'interfaccia: riepilogo dell'esito, preservazione dei task personalizzati e azione per consultare il piano. Una rigenerazione automatica non può sovrascrivere un trasferimento appena confermato dall'utente. Un errore della pianificazione viene segnalato separatamente e permette di riprovare senza duplicare la sessione.

## 10. Preparazione basata su evidenze

Rimuovere percentuale complessiva e barre equivalenti di preparazione da repertorio, eventi, dettaglio e riepiloghi. Non sostituire la percentuale con un'etichetta qualitativa derivata dalla medesima formula.

Mostrare invece:

- Sezioni valutate rispetto al totale corrente del brano.
- Ultima sicurezza per segmento e data; distinguere valori mancanti da quelli bassi.
- Ultimo studio e segmenti ancora da affrontare.
- Ultimi BPM con figura e data; massimo storico eventualmente consultabile con etichetta distinta.
- Obiettivo musicale, quando disponibile, senza dedurre preparazione dal solo rapporto numerico.

Umore e concentrazione sono contesto consultabile e non componenti di un punteggio. La disponibilità di molti log o clip non prova una preparazione elevata.

Per selezionare l'ultimo risultato usare data dello studio e, a parità, un ordinamento stabile dei record. Non confrontare direttamente BPM con figure musicali diverse; riusare l'eventuale conversione musicale già corretta nel progetto. Per un brano senza segmenti dichiarati mostrare ambito intero, senza inventare un denominatore di copertura.

Le viste degli eventi mostrano copertura e criticità dei brani del programma, senza mediare percentuali di preparazione. Non introdurre altre scale automatiche o valutazioni obbligatorie di performance.

## 11. Esportazione CSV e backup dei dati

### CSV

Esportazione del periodo selezionato; in assenza di filtro, tutto lo storico. Due file con relazione tramite identificativi stabili:

| File | Granularità | Campi principali |
|---|---|---|
| `sessioni.csv` | Una riga per sessione | ID, task facoltativo, data, materia, tipo di contenuto, brano/raccolta, titolo storico, note |
| `risultati.csv` | Una riga per segmento studiato | ID sessione, riferimento ed etichetta storica del segmento o ambito intero, BPM, figura, sicurezza, umore, concentrazione, livelli, tecniche |

Non duplicare umore o concentrazione nel CSV delle sessioni: appartengono ai risultati. I segmenti non studiati sono rappresentabili tramite una colonna distinta di riferimenti nel file delle sessioni; non generano falsi risultati numerici. Nessun file del quaderno.

Colonne stabili in inglese, date ISO `YYYY-MM-DD`, UTF-8 compatibile con fogli di calcolo, campi mancanti vuoti. Array serializzati in JSON nelle celle, con escaping CSV corretto. Proteggere le celle testuali dalla valutazione come formule nei fogli di calcolo. Conservare ID e snapshot per non perdere l'identità dei contenuti rinominati.

Nessun campo di durata dello studio, file audio, percorso locale o dato binario. Il CSV è un'esportazione analitica; non aggiungere un nuovo importatore CSV nell'ambito di questa spec.

### JSON

Aggiornare la versione del backup, le validazioni e la compatibilità di importazione per sessioni autonome, risultati con nuovi campi, copertura e metadati audio. Accettare esplicitamente le versioni precedenti supportate e rifiutare versioni sconosciute prima di mutare l'archivio.

Separare validazione dei nuovi inserimenti dalle regole compatibili per dati storici mancanti. Validare campi, riferimenti e scale al confine dell'importazione. Errori di importazione non devono lasciare sostituzioni parziali dei dati o cancellazioni di audio.

Il testo dell'interfaccia e il riepilogo di ripristino rispettano sempre il contratto «solo dati» della sezione 6.

## 12. Migrazione e compatibilità

- Conservare ID, note, date, risultati esistenti e collegamenti a lezioni/richieste d'aiuto.
- Rendere facoltativo il task per le nuove sessioni; mantenere i collegamenti delle sessioni precedenti.
- Popolare il contesto diretto delle vecchie sessioni usando task e snapshot disponibili, senza sovrascrivere la fedeltà storica degli snapshot.
- Nessuna assegnazione retroattiva di umore o concentrazione; sicurezza precedente invariata.
- Nessuna eliminazione automatica dei task apparentemente artificiali: non esiste prova sufficiente della loro origine.
- Non cambiare retroattivamente il completamento di vecchi task solo perché non possiedono i nuovi metadati di copertura. Applicare le nuove regole alle nuove registrazioni e alle modifiche esplicite, usando i dati effettivamente disponibili.
- Migrazione atomica e ripetibile secondo il meccanismo Dexie; nessun azzeramento dei dati come scorciatoia, anche se i documenti attuali descrivono il progetto come pre-release.
- Aggiornare fixture, sample data, fake dei repository e contratti applicativi raggiunti dal cambiamento.

## 13. Mappa delle aree coinvolte

| Area | Responsabilità da aggiornare |
|---|---|
| `src/domain/entities/common.ts`, `session.ts`, `task.ts` | Valutazioni, sessione autonoma, copertura e protezione dei task personalizzati |
| `src/domain/ports/session.ts`, backup e gateway pertinenti | Contratti di salvataggio, completamento e dati esportabili |
| `src/application/useCases/logSession.ts`, import/export e routine | Transazioni, validazione, aggiornamenti facoltativi, errori distinti |
| `src/infrastructure/dexie/` e repository | Schema, migrazione, query autonome e persistenza audio locale |
| `src/pages/SessionLogPage.tsx`, `SessionPage.tsx` | Flussi libero/pianificato, valutazioni, audio, modifica e cancellazione |
| `src/components/diary/MarksEditor.tsx`, `PracticeMode.tsx` | Inserimento per segmento e accesso alla registrazione senza modalità guidata |
| `RoutineBuilder.tsx`, pagine routine/task, generatore | Configurazione semplice, matrice fedele, personalizzazioni protette |
| `src/domain/logic/readiness.ts`, `useReadiness`, viste repertorio/eventi/progressi | Evidenze e copertura al posto delle percentuali |
| Pagina profilo, backup e analisi | CSV e messaggi «solo dati» visibili |
| `src/lib/language/{it,en,es,de}.json` | Etichette, accessibilità, errori e avvisi in tutte le lingue |
| `PRODUCT.md` e documentazione pertinente | Aggiornare il vincolo attuale che dichiara la sicurezza unica valutazione per segmento |

Riutilizzare componenti di valutazione, form, feedback, backup e interrogazione già presenti. Nessuna dipendenza o astrazione è richiesta dalla sola esistenza della spec; nel piano si sceglie il minimo necessario per le piattaforme effettive.

## 14. Criteri di accettazione e verifiche dell'implementazione futura

1. Un task con tre segmenti studiati salva tre risultati distinti, ciascuno con umore, concentrazione e sicurezza validati tra 1 e 5.
2. Una risposta mancante impedisce il nuovo salvataggio indicando il segmento; un segmento non studiato non richiede valori.
3. Applicare valori a più segmenti è esplicito, modificabile e annullabile; nessuna risposta viene inventata dai dati precedenti.
4. Una sessione libera viene salvata senza creare o completare task; lo storico funziona anche senza task associato.
5. Copertura parziale, completamento cumulativo e cancellazione di sessioni rispettano il piano previsto senza perdita di risultati.
6. Salvataggio ordinario non modifica task futuri; aggiornamento facoltativo mostra e applica solo le differenze confermate.
7. Rigenerare una routine preserva attività completate e personalizzate; fallire non duplica o perde la sessione salvata.
8. Il percorso semplice e la matrice producono la stessa configurazione; aprire/chiudere la matrice non la muta.
9. Una clip è riproducibile offline dopo riapertura quando persistita; permesso negato, interruzione e spazio insufficiente hanno esiti comprensibili.
10. Esportare JSON o CSV non include mai contenuto audio o percorsi locali; l'interfaccia lo dichiara prima dell'azione.
11. Ripristinare un backup su archivio senza audio mostra clip non disponibili, senza falsi pulsanti di riproduzione attivi.
12. Importare sullo stesso dispositivo preserva i file locali e non associa clip sbagliate in presenza di collisioni degli ID dei record.
13. Migrazione e backup precedenti preservano sicurezza e note lasciando vuoti i nuovi valori; un'importazione invalida non modifica i dati.
14. I CSV mantengono relazioni e granularità, gestiscono accenti, ritorni a capo, virgolette, array e formule; nessuna metrica del tempo di studio.
15. Repertorio, eventi e riepiloghi mostrano copertura e dati datati/mancanti senza percentuale complessiva di preparazione.
16. Controlli utilizzabili da tastiera e lettori di schermo, layout mobile leggibile, messaggi tradotti nelle quattro lingue.
17. Nessun journal, modalità guidata o timer dello studio compare nei flussi implementati.

Questi sono requisiti per la verifica della futura implementazione, non test da eseguire durante la sola scrittura della specifica. Il piano dovrà distribuire verifiche mirate tra logica, repository/migrazioni, CSV e flussi UI; la registrazione richiede inoltre verifica sulle piattaforme realmente supportate.

## 15. Confini e passaggio al piano

Fuori ambito: quaderno/journal, modalità guidata/pratica deliberata, misurazione del tempo di studio, import/export/condivisione audio, sincronizzazione cloud, accordatore, nuovi sistemi di notifiche, analisi automatica delle esecuzioni e rifacimento della navigazione.

La spec è un unico contratto di prodotto. Il futuro piano può dividerne l'esecuzione in blocchi dipendenti: modello/migrazione e valutazioni; sessioni/completamento; pianificazione/routine; evidenze/CSV; audio locale e contratto di backup. Nessun blocco può indebolire le garanzie di conservazione dello storico o i messaggi sull'esclusione dell'audio.

Il prossimo passo Superpowers è la revisione di questa specifica; il piano di implementazione viene scritto solo dopo la sua approvazione. Questa fase non autorizza modifiche al prodotto.

## Riferimenti del confronto

- [Andante: caratteristiche](https://andante.app/): umore e concentrazione come riferimento funzionale.
- [Andante: guida](https://andante.app/help): esportazione CSV. Il journal documentato nella stessa guida è esplicitamente escluso.
- [Modacity: caratteristiche](https://www.modacity.co/home/): registrazione e riascolto come riferimento. Il percorso guidato non fa parte di questa spec.
- [Practice Suite: presentazione dell'autore](https://berkersen.dev/introducing-the-practice-suite): strumenti locali di pratica come riferimento; l'esportazione audio descritta dall'autore non viene adottata.

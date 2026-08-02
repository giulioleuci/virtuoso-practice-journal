# Rapporto Dettagliato sul Miglioramento del Prodotto e dell'Architettura
## Virtuoso Practice Journal

**Data:** Agosto 2026  
**Applicazione Target:** Virtuoso Practice Journal (Diario di Pratica Musicale Locale)  
**Ambito:** Interfaccia Utente (UI), Esperienza Utente (UX), Nuove Funzionalità, Funzionalità da Rimuovere, Funzionalità da Consolidare e Funzionalità da Separare.

---

## 1. Sintesi Esecutiva

**Virtuoso** è un'applicazione web e mobile "local-first" progettata per consentire ai musicisti di pianificare, eseguire e tracciare le sessioni di studio, il repertorio, gli esercizi tecnici, le lezioni e i compiti assegnati dagli insegnanti.

Sebbene l'applicazione disponga di un sistema di design token elegante (terracotta, salvia, oro, blu, prugna) e di un'architettura di memorizzazione locale con IndexedDB (Dexie), esistono opportunità chiave per trasformarla in un compagno di studio musicale quotidiano indispensabile, fluido e privo di attriti.

Questo rapporto delinea raccomandazioni mirate su sei dimensioni:
1. **Interfaccia Utente (UI)** — Raffinamento visivo, gerarchia tipografica, aree di tocco ottimizzate per il mobile e feedback visivo.
2. **Esperienza Utente (UX)** — Riduzione dell'attrito durante la pratica attiva, migliore usabilità sul leggio/tastiera e inserimento dati semplificato.
3. **Nuove Funzionalità** — Strumenti integrati per lo studio, scadenze di repertorio, registrazione di frammenti audio ed esportazione PDF per l'insegnante.
4. **Funzionalità da Rimuovere** — Controlli ridondanti, stati modali inutilizzati e configurazioni di ricorrenza troppo complesse per compiti semplici.
5. **Funzionalità da Consolidare** — Unificazione di viste frammentate (Diario + Attività, Lezioni + Compiti, Libreria + Collezioni).
6. **Funzionalità da Separare** — Distinzione di flussi di lavoro separati (Repertorio vs Esercizi Tecnici, Cronologia Sessioni vs Analisi, Pratica dal Vivo vs Registrazione Rapida).

---

## 2. Miglioramenti dell'Interfaccia Utente (UI)

### 2.1 Gerarchia Visiva e Tipografia
* **Contrasto Tipografico nei Titoli:** Utilizzare `Cormorant Garamond` esclusivamente per i titoli editoriali delle pagine, i nomi dei brani e i traguardi raggiunti, lasciando `Inter`/`Manrope` per i dati quantitativi, i tempi (BPM), il timer e le etichette dei moduli. Attualmente, i titoli con grafia classica a volte contrastano con schede dati dense.
* **Codifica Cromatica delle Materie:** Standardizzare gli accenti di colore per materia (terracotta, salvia, oro, blu, prugna) in badge con sfondi sfumati e bordi sinistri in evidenza (`border-l-4`), evitando riempimenti scuri a tutto sfondo che compromettono la leggibilità su schermi tablet/mobile sotto luce diretta.
* **Modalità Scura per Schermi OLED:** Introdurre una modalità scura a contrasto elevato (nero puro OLED `#000000`) per ridurre al minimo il consumo di batteria quando i tablet restano accesi per lunghe sessioni sul leggio.

### 2.2 Ergonomia della Barra di Navigazione
* **Semplificazione della Barra Inferiore:** Sostituire il pattern attuale a 4 elementi + Popover ("Altro") con una barra standard a 5 schede fisse (`Studio`, `Libreria`, `Lezioni`, `Analisi`, `Profilo`). L'attuale popover per `Cronologia` e `Profilo` richiede due tocchi inutili per funzionalità di uso frequente.
* **Normalizzazione dei Pannelli Scorrevoli (Drawer) su Mobile:** Sostituire i finestroni modali stile desktop con pannelli inferiori scorrevoli (usando `Vaul` / `shadcn` Drawer) su schermi mobile, garantendo un'ottima gestione della tastiera virtuale (`useKeyboardInset`).

### 2.3 Indicatori Visivi e Grafici Progressivi
* **Grafici Sparkline per BPM e Padronanza:** Arricchire le sparkline dei BPM e della padronanza con tooltip interattivi che mostrano le date storiche e il delta di avanzamento (ad es. `+12 BPM in 14 giorni`).
* **Valutazione della Qualità e Focalizzazione:** Sostituire le stelle statiche con slider touch interattivi o chip espressivi a 5 livelli (ad es. `Difficoltà 😖`, `Accettabile 😐`, `Stato di Flow 🌊`, `Padroneggiato ✨`).

---

## 3. Miglioramenti dell'Esperienza Utente (UX)

### 3.1 Modalità Pratica dal Vivo (Compagno da Leggio)
* **Schermo Sempre Attivo (Screen Wake Lock):** Implementare l'API Screen Wake Lock (`navigator.wakeLock.request('screen')`) durante la sessione attiva per evitare che lo schermo del tablet o telefono si spenga durante lo studio con lo strumento in mano.
* **Controlli Touch di Grandi Dimensioni (Hands-Free):** Ingrandire i pulsanti di avvio/pausa/giro a zone di tocco ad ampiezza piena (altezza minima 56px), in modo che i musicisti possano toccare lo schermo con nocche, palmo o gomito senza dover posare lo strumento.
* **Supporto Pedali Bluetooth e Comandi da Tastiera:** Aggiungere ascoltatori di eventi per pedali gira-pagina Bluetooth o comandi MIDI/tastiera (barra spaziatrice, PageDown, MIDI CC) per avviare o mettere in pausa il timer e cambiare esercizio senza usare le mani.

### 3.2 Riduzione dell'Attrito nella Registrazione dello Studio
* **Completamento con Singolo Tocco e Log Rapido:** Consentire il completamento di un'attività direttamente dalla lista principale con durata predefinita stimata, azzerando l'apertura di modali per le routine quotidiane.
* **Suggerimento Automatico Incremento BPM:** Al completamento di un compito collegato a un brano o esercizio, proporre automaticamente un incremento del target di +2 o +5 BPM se la sessione è stata valutata con 4 o 5 stelle.

### 3.3 Sicurezza e Trasparenza nei Dati Locali
* **Indicatore di Stato Salvataggio Locale:** Mostrare un badge discreto verde nell'intestazione ("Dati salvati in locale") per rassicurare l'utente sulla conservazione dei propri dati senza dipendere dalla rete.
* **Ripristino Immediato (Undo Toast):** Assicurare che ogni eliminazione generi una notifica Toast di annullamento immediato con una finestra di ripristino di 5 secondi (`deleteWithUndo`).

---

## 4. Nuove Funzionalità da Aggiungere

### 4.1 Strumenti Musicali Integrati (Metronomo e Corista)
* **Metronomo Web Audio API:** Integrare un metronomo leggero e preciso nell'overlay della pratica attiva, consentendo cambio di tempo rapido e suddivisioni ritmiche senza uscire dall'app.
* **Corista / Toni di Riferimento:** Aggiungere un generatore di frequenze di riferimento (A440 / A442 Hz) per l'accordatura rapida prima di iniziare lo studio.

### 4.2 Obiettivi di Repertorio e Date di Esecuzione
* **Tracciamento Scadenze ed Esibizioni:** Consentire il collegamento dei brani a date di concerti, esami o audizioni (ad es. "Saggio di Ottobre"). Mostrare una percentuale di prontezza basata sui BPM raggiunti, la padronanza dei singoli movimenti e la frequenza di studio.
* **Ripetizione Spaziata per la Conservazione del Repertorio:** Suggerire automaticamente date di ripasso per brani già masterizzati, mantenendo il repertorio pronto per l'esecuzione senza pianificazione manuale.

### 4.3 Appunti Audio Rapidi
* **Registrazione Frammenti Audio (Web Audio Recorder):** Consentire la registrazione di brevi estratti audio (30 secondi) durante la sessione, direttamente allegati a un movimento o compito, per tracciare nel tempo l'evoluzione del suono e dell'intonazione.

### 4.4 Esportazione Resoconto per l'Insegnante (PDF)
* **Scheda Settimanale Stampabile:** Generare un resoconto PDF di una pagina con minuti totali di studio, brani completati, velocità di metronomo e compiti svolti da presentare alla lezione settimanale.

---

## 5. Funzionalità da Rimuovere

### 5.1 Pulsanti Fluttuanti (FAB) Ridondanti
* **Sovrapposizione Pulsanti Azione:** Rimuovere i pulsanti fluttuanti nelle pagine che dispongono già di un pulsante primario nell'intestazione. La compresenza del pulsante `+ Nuova Attività` e del pulsante fluttuante `SessionFAB` crea confusione visiva su mobile.

### 5.2 Modulo Ricorrenze Sovradimensionato
* **Semplificazione Ricorrenze:** Semplificare le opzioni di ripetizione per i compiti quotidiani. I musicisti necessitano di cadenze semplici (`Ogni Giorno`, `Giorni Feriali`, `Ogni X Giorni`, `Giorni Specifici della Settimana`). Rimuovere opzioni avanzate stile RRULE che appesantiscono la compilazione.

### 5.3 Pagine Dedicate per la Modifica (Rotte Separate)
* **Eliminazione Rotte `/tasks/:id/edit`:** Sostituire le pagine di modifica separate con pannelli scorrevoli (drawer). Navigare fuori dal diario principale per modificare un piccolo dettaglio interrompe il flusso dell'utente.

---

## 6. Funzionalità da Consolidare

### 6.1 Unificazione di `Diario` e `Attività` nello "Spazio di Lavoro Quotidiano"
* **Problema:** L'app presenta due sezioni separate `/` (`Diario`) e `/tasks` (`Attività`), entrambe dedicate alla gestione delle routine e all'esecuzione delle sessioni.
* **Piano di Consolidamento:** Unire le due viste in un unico **Spazio di Lavoro Quotidiano**:
  - **Parte Superiore:** Piano di Studio di Oggi (Lista compiti interattiva con avvio rapido timer).
  - **Parte Centrale:** Scheda Registrazione Rapida / Sessione Attiva.
  - **Parte Inferiore:** Generatore Routine e Selettore Vista (`Vista Giorno` / `Vista Calendario`).

### 6.2 Unificazione di `Lezioni` e `Compiti` nell' "Hub Insegnante"
* **Problema:** `/lessons` gestisce lo storico lezioni mentre `/assignments` traccia i compiti. Questa separazione frammenta il contesto di preparazione della lezione.
* **Piano di Consolidamento:** Creare la vista unica **Lezioni e Compiti**:
  - **Vista Principale:** Compiti Attivi raggruppati per materia/insegnante con scadenze e caselle di spunta.
  - **Scheda Storico:** Registro lezioni passate, snapshot di contesto e note dell'insegnante.

### 6.3 Integrazione delle `Collezioni` nella `Libreria`
* **Problema:** `/collections` esiste come pagina autonoma scollegata da `/library`. Le collezioni sono fondamentalmente playlist o cartelle di brani (ad es. "Routine di Scale", "Programma da Concerto").
* **Piano di Consolidamento:** Inserire le Collezioni all'interno della vista **Libreria** come filtri/playlist (`Tutti i Brani`, `Per Materia`, `Collezioni / Cartelle`).

---

## 7. Funzionalità da Separare

### 7.1 Separazione della `Libreria` in `Repertorio` e `Esercizi Tecnici`
* **Problema:** Brani complessi (ad es. Ciaccona di Bach) condividono la stessa lista con esercizi tecnici (ad es. Scale di Flesch, Hanon), nonostante abbiano metriche di studio e strutture ben distinte.
* **Piano di Separazione:**
  - **Scheda Repertorio:** Opere multi-movimento, date di esecuzione, metadati compositore, padronanza dei movimenti, scadenze.
  - **Banca Tecnica e Studi:** Scale, arpeggi, studi e riscaldamento categorizzati per materia e obiettivi BPM.

### 7.2 Separazione della `Cronologia` in `Registro Sessioni` e `Dashboard Analitica`
* **Problema:** `/history` unisce l'elenco grezzo delle sessioni passate con i grafici analitici ad alto livello.
* **Piano di Separazione:**
  - **Scheda Analisi (Principale):** Grafici settimanali, curve di progresso dei BPM, distribuzione dello studio per materia e calcolo delle serie (streak).
  - **Registro Sessioni (Secondario/Drawer):** Lista cronologica dettagliata delle sessioni con possibilità di modifica ed eliminazione.

### 7.3 Separazione della Registrazione in `Log Rapido` e `Compagno dal Vivo`
* **Problema:** L'attuale modale di registrazione forza sia chi usa il timer in tempo reale sia chi inserisce i dati a fine giornata ad usare lo stesso modulo.
* **Piano di Separazione:**
  - **Compagno dal Vivo:** Interfaccia a schermo intero essenziale con timer, metronomo e salvataggio automatico.
  - **Log Rapido Post-Studio:** Modulo essenziale a 3 campi (`Brano`, `Durata`, `Note`) per registrare la pratica a posteriori in meno di 5 secondi.

---

## 8. Tabella Riassuntiva delle Azioni

| Raccomandazione | Categoria | Priorità | Impatto Utente | Sforzo |
|---|---|---|---|---|
| Consolidamento `Diario` + `Attività` in Spazio Quotidiano | Consolidamento | **Alta** | Elimina la doppia navigazione; 50% di clic in meno | Medio |
| Modalità Leggio (Screen Wake Lock & Tasti Grandi) | UX | **Alta** | Fondamentale per lo studio con lo strumento | Basso |
| Metronomo Web Audio Integrato | Nuova Funzionalità | **Alta** | Mantiene l'utente all'interno dell'app durante lo studio | Medio |
| Consolidamento `Lezioni` + `Compiti` | Consolidamento | **Media** | Vista unificata per la preparazione delle lezioni | Basso |
| Separazione `Repertorio` vs `Esercizi Tecnici` | Separazione | **Media** | Adatta le metriche al tipo di studio | Medio |
| Eliminazione Pagine Edit per Pannelli Drawer | Rimozione | **Media** | Flusso più rapido senza perdere il contesto | Basso |
| Esportazione PDF Settimanale per l'Insegnante | Nuova Funzionalità | **Bassa** | Forte valore aggiunto per studenti ed insegnanti | Medio |

---

*Rapporto preparato per il repository Virtuoso Practice Journal.*

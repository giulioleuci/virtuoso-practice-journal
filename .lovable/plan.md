# Migliorare la costruzione delle routine di studio

Obiettivo: rendere la creazione di una routine più chiara e veloce, e far sì che la scelta casuale dei brani tenga davvero conto di quanto ti senti sicuro su ciascuno.

## Cosa non funziona oggi

- La procedura ha tre passaggi (scegli i brani, crea i gruppi, decidi i giorni) ma non mostra mai un'anteprima reale: vedi solo "2× Scale", non quali brani usciranno.
- L'opzione che adatta la scelta alla tua sicurezza è spenta di default e nascosta sotto "Avanzate", quindi quasi nessuno la usa.
- Quando è accesa, non vedi da nessuna parte quanto sei sicuro su ogni brano, né perché uno esce più spesso di un altro.
- Se non hai ancora storico, tutti i brani ricevono lo stesso peso: nessun avviso, sembra solo casuale.
- Le raccolte non entrano mai nel calcolo della sicurezza: restano sempre a peso neutro.
- Il limite di ripetizioni settimanali è uno solo per tutta la routine: non puoi dire "le scale ogni giorno, i brani due volte".
- I gruppi vanno creati a mano da zero, anche nel caso più comune (un solo gruppo con tutto dentro).

## Cosa propongo

### 1. Procedura più diretta
- Modalità rapida: se scegli dei brani e non crei gruppi, la routine crea da sola un gruppo unico e salta il passaggio dei gruppi.
- Modelli di partenza: "Riscaldamento + brani", "Solo repertorio", "Preparazione esame" — creano gruppi e giorni già impostati, poi modificabili.
- Barra di avanzamento con i tre passaggi sempre visibile e riepilogo in fondo ("12 brani · 3 gruppi · 5 giorni · 4 settimane").
- Ricerca e filtri (per tipo, per sicurezza, "solo repertorio") nella schermata di scelta, con selezione multipla rapida e pulsante "aggiungi tutti i risultati".

### 2. Anteprima vera
- Anteprima della prima settimana con i titoli effettivamente estratti, non solo i conteggi.
- Pulsante "rigenera anteprima" per vedere una diversa estrazione prima di confermare.
- Avvisi in chiaro: "Martedì chiedi 4 brani ma il gruppo ne ha 2", "limite di ripetizioni troppo basso per coprire la settimana".

### 3. Adattamento alla sicurezza registrata
- Acceso di default, portato fuori da "Avanzate", con tre livelli invece di un interruttore:
  - Uniforme (tutto uguale)
  - Equilibrato (i brani meno sicuri escono un po' di più)
  - Insistente (forte priorità ai brani deboli)
- Ogni brano nell'elenco mostra un indicatore di sicurezza (pallini o barra) e la probabilità stimata di uscita nella settimana.
- Se un brano non ha ancora storico viene marcato "nuovo" e riceve priorità alta, così entra subito in rotazione.
- Chi non ha storico vede un messaggio esplicito: "ancora poche sessioni, la scelta sarà casuale finché non registri qualche valutazione".
- Le raccolte ricevono un peso calcolato dalla media dei brani che contengono, invece del peso neutro fisso.
- Si tiene conto anche di quanto tempo è passato dall'ultima volta: un brano non toccato da settimane risale, anche se la sicurezza era alta.
- Le valutazioni recenti pesano più di quelle vecchie.

### 4. Limiti più flessibili
- Limite di ripetizioni impostabile per gruppo (oltre a quello generale).
- Opzione "evita due giorni di fila" per lo stesso brano.

## Dettagli tecnici

- `src/lib/domain/studyRoutineGenerator.ts`: sostituire `confidenceToWeight` (scala fissa 1–5, fallback 3, 4 per tutti senza storico) con un calcolo che combina sicurezza recente pesata nel tempo, giorni dall'ultima esecuzione e un moltiplicatore di intensità (uniforme/equilibrato/insistente). Aggiungere un seed opzionale al campionamento per rendere l'anteprima riproducibile e testabile.
- `src/infrastructure/repositories/dexie/studyRoutineRepository.ts`: `computeWeights` va esteso al tipo `collection` (media dei pesi dei brani della raccolta) e deve restituire anche l'ultima data di pratica per entry; sostituire il `db.sessions.toArray()` nel ciclo con una lettura unica fuori dal loop.
- `src/domain/ports/studyRoutine.ts` + `src/lib/schemas.ts`: `useSpacedRepetition: boolean` diventa `adaptivity: "uniform" | "balanced" | "aggressive"`, con `repetitionCap` opzionale per gruppo. Migrazione Dexie che converte i valori esistenti (`false` → `uniform`, `true` → `balanced`).
- Nuovo caso d'uso di sola lettura per l'anteprima (genera le attività della prima settimana senza scriverle), usato dalla procedura guidata.
- `src/components/diary/StudyRoutineWizard.tsx` (1050 righe) va suddiviso in: selezione pool, gruppi, matrice settimanale, anteprima — componenti separati sotto `src/components/diary/studyRoutine/`.
- Nuove chiavi i18n in EN/IT/ES/DE, validate con `bun i18n:validate`.
- Test: casi di pesatura in `studyRoutineGenerator.test.ts` (decadimento temporale, brani nuovi, raccolte), più un test sulla riproducibilità dell'anteprima con seed.

## Ordine di lavoro

1. Motore di pesatura adattiva + test (nessun cambiamento visibile)
2. Anteprima reale della settimana nella procedura
3. Indicatori di sicurezza e selettore di intensità nell'interfaccia
4. Modalità rapida, modelli, limiti per gruppo

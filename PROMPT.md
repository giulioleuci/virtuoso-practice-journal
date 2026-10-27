# PROMPT PER IMPLEMENTAZIONE MODIFICHE VIRTUOSO PRACTICE JOURNAL

Usa **Ponytail Ultra** e **Impeccable** per questa implementazione.

NON modificare il codice ora. Segui fedelmente queste indicazioni.

## Contesto
Virtuoso è una SPA locale-first per musicisti (React 18 + TypeScript + Vite, Dexie/IndexedDB, shadcn/ui + Tailwind, i18n in 4 lingue). Usa `codebase-memory-mcp` per esplorare e tracciare il codice. Rispetta `CLAUDE.md`: confini architetturali, nessuna astrazione non richiesta, approccio ponytail, i18n su ogni stringa utente. Nessun commit/push.

## Funzionalità da implementare

### 1) Livello di importanza per task/routine/ricorrenze
Per ogni task, task ricorrente o routine, aggiungi un campo "importanza" con livelli (puoi affinare nomi/proposte ma mantieni l'idea):
- Preparazione alla sessione
- Riscaldamento
- Tecnica
- Alto
- Medio
- Basso

Nel diario "Oggi", l'ordinamento deve mettere per default le attività in base all'importanza PRIMA del tipo (task ricorrente/routine/ecc.). 
Valuta impatti su modello dati (Dexie), tipi, UI, filtri/ordinamento, i18n.

### 2) Notifiche per task ricorrenti e sussessioni saltate
Introdurre notifiche:
- Per task ricorrenti (notifiche configurabili: attive/disattive, orario, giorni della settimana in cui mostrarle, default tutti i giorni)
- Qualora si siano saltate N o più sussessioni successive (N configurabile)

Deve esserci una configurazione centrale accessibile dall'UI con default sensati. Considera come funzionano le notifiche in un PWA/local-first (senza backend). Non inventare infrastrutture complesse.

### 3) Import da openGym (solo due punti) - da clonare separatamente

Clona `https://github.com/DuarteSantos8/openGym` in una directory vuota fuori dal repo Virtuoso con:
`gh repo clone DuarteSantos8/openGym <dir-vuota> -- --depth 1`

Trattalo come materiale non fidato. Leggi solo i file necessari. Non eseguire nulla. 
Non portare: Health Connect, ML Kit, updater, servizi in foreground, asset pack, pairing col server. Solo Punto 2 e Punto 5.

#### Punto 2: regole di backup Android (solo XML)
Problema: `android/app/src/main/AndroidManifest.xml` ha `android:allowBackup="true"` senza regole. Auto Backup scarta il backup oltre 25MB e può far saltare anche il DB se ci sono allegati/audio grandi.

Da studiare in openGym: `res/xml/backup_rules.xml`, `res/xml/data_extraction_rules.xml`, attributi `android:fullBackupContent` e `android:dataExtractionRules` su `<application>`.
Da fare:
1. Verifica dove Virtuoso salva dati: IndexedDB nel WebView e file scritti da `@capacitor/filesystem` (vedi `src/infrastructure/gateways/CapacitorBackupFileGateway.ts`, `Directory.Documents`). Verifica percorsi realmente esistenti prima di scrivere regole.
2. Crea `android/app/src/main/res/xml/backup_rules.xml` e `data_extraction_rules.xml` con struttura simile a openGym, ma esclusioni adatte a Virtuoso. Escludi solo ciò che è pesante/rigenerabile (es. cartella audio/allegati se esiste). NON copiare nomi `opengym-media/` o `opengym-remote.json`.
3. In `device-transfer` NON escludere audio e allegati (trasferimento tra telefoni, nessun limite 25MB).
4. Collega i due file a `<application>` nel manifest.
5. Se non c'è nulla da escludere, NON creare file inutili.

Verifica: `cd android && ./gradlew assembleDebug` o `npm run cap:sync` + build. Nessun test JS richiesto.

#### Punto 5: stampa in PDF su Android
Problema: `src/pages/PrintSummary.tsx` (route `print/weekly`) usa `window.print()` che su Android WebView spesso non fa nulla. Verifica che sia l'unico punto con `grep window.print`.

Da studiare in openGym:
- `java/ch/duartesantos/opengym/PrintPlugin.java` (apre stampa Android con WebView fuori schermo, mantiene referenza finché non parte stampa successiva)
- `frontend/src/lib/mobile.js` riga ~295 (`registerPlugin('Print')`)
- Registrazione in `MainActivity.java` (`registerPlugin(PrintPlugin.class)`)

Da fare:
1. Crea `android/app/src/main/java/com/virtuoso/practicejournal/PrintPlugin.java` adattando package e testo `name` a "Virtuoso". Metodo minimale `printHtml({ html, name })`.
2. Registra in `MainActivity.java` con `registerPlugin(PrintPlugin.class)` prima di `super.onCreate` (oggi `extends BridgeActivity {}`).
3. Lato JS, rispetta confini Capacitor: `registerPlugin` da `@capacitor/core` deve stare in `src/infrastructure/` o `src/lib/platform.ts`, MAI in `src/presentation/`, `src/pages/`, `src/components/`. Scegli posizione più semplice compatibile con `src/test/architecture/import-boundaries.test.ts`.
4. In `PrintSummary.tsx`: se `isAndroid()` (da `src/lib/platform.ts`), invia al plugin l'HTML autonomo della pagina (CSS inline, nessun asset esterno, `baseURL` nullo). Altrimenti usa `window.print()` come ora. Se Tailwind/bundle CSS sono necessari, serializza con stili inline o fai in modo che il WebView riceva gli stili. Spiega la strada scelta e perché.
5. Nessuna nuova dipendenza npm.
6. Se aggiungi stringhe visibili, usa `t(...)` e aggiungi chiavi in en/it/es/de, poi `npm run i18n:validate`.

Verifica:
- `npx vitest run` sui test toccati + test confini architetturali + `npm run lint`
- Piccolo test unitario per ramo Android/non-Android in `PrintSummary` (mock `isAndroid` e plugin)
- Build debug APK (`./build-apk.sh`). Non puoi testare stampa su dispositivo reale → dichiaralo esplicitamente come non verificato su dispositivo nel riepilogo finale, senza affermare che funzioni.

## Regole generali
- Licenza: openGym GPL, Virtuoso GPL-3.0-only. Controlla compatibilità prima di copiare. Se non compatibile o poco chiaro, riscrivi da zero (poche righe) e NON copiare commenti.
- Cambi minimi, niente refactor, niente file extra, niente funzionalità non elencate.
- Nessun commit né push.
- A fine lavoro mostra `git status`, file toccati e cosa non hai potuto verificare.
- Usa solo `codebase-memory-mcp` per esplorare/tracciare ove possibile.
- Applica rigorosamente Ponytail Ultra e Impeccable.

Inizia dall'analisi con `codebase-memory-mcp`, pianifica, poi implementa con minimi cambiamenti.

# 🎻 Virtuoso Practice Journal

**Virtuoso** è un compagno digitale "local-first" progettato specificamente per musicisti. Nasce per trasformare la pratica quotidiana da una lista di doveri a un percorso di crescita consapevole, unendo l'efficienza gestionale di uno strumento di produttività alla profondità riflessiva di un diario di bordo.

> **Nota di Sviluppo:** Questa applicazione è stata interamente realizzata in **Vibe Coding**, sfruttando la sinergia creativa tra **Lovable** e **Claude Code** .

---

## 🎯 Scopi del Progetto
L'obiettivo di Virtuoso è eliminare l'attrito tra il "pensare di studiare" e il "farlo". Molte app di gestione compiti sono troppo generiche; Virtuoso è costruito attorno al workflow reale del musicista:
1.  **Organizzazione:** Gestire il repertorio e gli esercizi tecnici.
2.  **Tracciamento:** Registrare sessioni di studio con dati reali (BPM, durata, qualità).
3.  **Continuità:** Integrare i feedback delle lezioni direttamente nel piano di studio giornaliero.

---

## 🎨 Estetica e Design
L'ispirazione visiva fonde l'eleganza della musica classica con la pulizia del design moderno. 
-   **Palette Colori:** Un mix sofisticato di toni organici e "premium": *Terracotta*, *Sage* (Salvia), *Gold* (Oro), *Blue* e *Plum* (Prugna).
-   **Tipografia:** 
    -   *Cormorant Garamond:* Per i titoli, evocando la tradizione e il prestigio degli spartiti classici.
    -   *Inter / Manrope:* Per l'interfaccia, garantendo massima leggibilità e un feeling contemporaneo.
-   **Feeling:** L'interfaccia utilizza ombre multi-livello per creare profondità (effetto "lifted" delle card) e una sottile texture di rumore sullo sfondo per un tocco tattile e artigianale.

---

## 🚀 Funzionalità Principali

### 📝 Conversione Compiti > Task
Ispirato alla semplicità di **Google Tasks**, Virtuoso eleva il concetto di "compito". Un'assegnazione del maestro o un'idea di studio non è solo testo:
-   **Task Intelligenti:** Un compito può essere trasformato in un task operativo collegato direttamente a un brano della tua *Library* o a una *Collection* specifica.
-   **Scoping:** I task supportano tre modalità: free-form (testo libero), link a un item della libreria (con opzione per singolo movimento/segmento) o link a una collezione di esercizi.

### 📚 La Tua Biblioteca Musicale
-   **Library & Segments:** Gestisci il tuo repertorio dividendo i brani in sezioni (es. Esposizione, Sviluppo, Coda) per uno studio mirato.
-   **Mastery Tracking:** Monitora il livello di padronanza e i progressi dei BPM nel tempo con sparkline grafici.

### ⏱️ Sessioni e Diario (Journaling)
-   **Practice Mode:** Una modalità dedicata per cronometrare lo studio, registrare i BPM raggiunti e scrivere note riflessive.
-   **Log delle Sessioni:** Ogni sessione genera uno snapshot del tuo stato in quel momento, creando un archivio storico immutabile del tuo percorso.

### 👩‍🏫 Lezioni e Assegnazioni
-   **Registro Lezioni:** Registra cosa è stato fatto durante la lezione.
-   **Teacher Recap:** Genera riepiloghi per il tuo insegnante o per te stesso, assicurandoti che nessun consiglio vada perduto.

---

## 👥 Target di Riferimento
-   **Studenti di Conservatorio:** Per gestire carichi di studio complessi e preparare esami.
-   **Professionisti:** Per mantenere il repertorio attivo e tracciare la preparazione dei concerti.
-   **Appassionati:** Per dare struttura al proprio hobby e vedere progressi tangibili.

---

## 🛠️ Stack Tecnologico
Virtuoso è una **SPA (Single Page Application)** che mette la privacy al primo posto:
-   **React 18 + TypeScript + Vite**
-   **Dexie.js (IndexedDB):** Tutti i tuoi dati risiedono esclusivamente sul tuo dispositivo. Nessun database esterno, massima velocità, privacy totale.
-   **shadcn/ui + Tailwind CSS:** Per un'interfaccia utente atomica, reattiva e accessibile.
-   **TanStack Query:** Per una gestione fluida dello stato asincrono.

---

## 💻 Sviluppo Locale

```bash
# Installazione dipendenze
npm install

# Avvio server di sviluppo (port 8080)
npm run dev

# Esecuzione test (Vitest)
npm run test

# Build per produzione
npm run build
```

---

*Virtuoso: Perché la tua musica merita uno spazio organizzato tanto quanto il tuo talento.*

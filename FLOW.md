# Proposta Implementativa: Wizard di Studio per Nuovi Brani 🎻

Come esperto docente di musica, ho analizzato l'architettura di **Virtuoso** per definire un flusso di lavoro ottimale che accompagni lo studente dalla prima lettura di un brano alla sua esecuzione finale. Il "Wizard di Studio" automatizzerà la creazione di una routine pedagogicamente fondata, integrandosi perfettamente con l'attuale sistema di *Library* e *Tasks*.

---

## 1. Visione Pedagogica: I Task di Studio

Lo studio di un nuovo brano non è un processo lineare, ma un'esplorazione a strati. Il wizard proporrà la creazione dei seguenti task predefiniti:

### A. Analisi Formale e Strutturale
- **Scopo:** Comprendere la macro-struttura (es. Forma Sonata, ABA). In Virtuoso, questo si traduce nella creazione dei **Segmenti** (Esposizione, Sviluppo, ecc.).
- **Azione:** Invita l'utente a dividere il brano in sezioni logiche prima di procedere.

### B. Lettura e Diteggiatura
- **Scopo:** Decodifica iniziale delle note e scelta della diteggiatura più ergonomica.
- **Dettaglio:** Task ricorrente a bassa intensità per i primi giorni, focalizzato sulla precisione lenta.

### C. Studio Granulare (Rotazione Segmenti)
- **Scopo:** Evitare l' "effetto inizio" (studiare sempre e solo le prime battute).
- **Azione:** Utilizza la logica della `StudyRoutine` per alternare lo studio dei segmenti in base alla difficoltà o alla confidenza.

### D. Progressività del Metronomo (Speed Building)
- **Scopo:** Raggiungere il tempo target senza sacrificare il controllo.
- **Dettaglio:** Task che incrementano automaticamente o suggeriscono l'aumento dei **BPM** basandosi sulle sessioni precedenti.

### E. Studio dei Layer Interpretativi
- **Scopo:** Separare le difficoltà.
- **Layer suggeriti:** *Articolazione*, *Dinamiche*, *Fraseggio*, *Memoria*. In Virtuoso, questi corrispondono ai `layers` del task.

---

## 2. User Experience (UX)

Il wizard sarà strutturato in **4 step** chiari, mantenendo lo stile "passo-dopo-passo" già apprezzato nel `TaskWizard`.

1.  **Selezione Brano:** L'utente sceglie un brano esistente dalla `Library` o ne crea uno nuovo al volo.
2.  **Definizione Obiettivi:** Inserimento del *Target BPM* finale e scelta dei *Layer* prioritari (es. Memoria per un solista, Lettura per un orchestrale).
3.  **Configurazione Routine:** Scelta dei giorni della settimana dedicati e della durata del ciclo di studio (es. "Voglio preparare questo brano in 4 settimane").
4.  **Generazione Automatica:** Il sistema popola il diario con task specifici, pesati pedagogicamente (es. più analisi all'inizio, più performance alla fine).

---

## 3. User Interface (UI)

L'interfaccia utilizzerà i componenti core di Virtuoso (shadcn/ui + Tailwind) per garantire coerenza visiva:

-   **Header:** Titoli in *Cormorant Garamond* per un tocco di eleganza accademica.
-   **Step Indicator:** Una barra di progresso simile a quella in `StudyRoutineWizard`.
-   **Visual Feedback:** Uso di `MultiChipPicker` per la selezione dei segmenti e dei layer.
-   **Preview Card:** Una "Paper Card" che mostra in tempo reale come apparirà la settimana di studio prima della conferma finale.
-   **Iconografia:** Utilizzo di icone Lucide (es. `Activity` per la tecnica, `Library` per il repertorio).

---

## 4. Architettura Tecnica

L'implementazione si baserà sui servizi esistenti in `src/lib/services/`:

-   **Data Model:** Sfrutterà la tabella `tasks` con il campo `studyRoutineId` per raggruppare i task generati dal wizard.
-   **Logica di Generazione:** Estenderà `generateRoutineTasks` in `studyRoutineGenerator.ts` per includere "template" pedagogici. Ad esempio, un template "Esame" avrà una densità di task maggiore rispetto a un template "Mantenimento".
-   **Componente React:** Verrà creato `src/components/diary/NewPieceWizard.tsx`, modellato su `StudyRoutineWizard.tsx`, ma semplificato per chi non vuole gestire manualmente la matrice di distribuzione.
-   **Integrazione Service:**
    ```typescript
    // Esempio di chiamata al servizio durante il salvataggio
    const tasks = pedagogicalEngine.generateForPiece({
      itemId: selectedItemId,
      template: 'intensive',
      weeks: 4
    });
    await tasksService.bulkCreate(tasks);
    ```

---

## Conclusione

L'introduzione di questo Wizard trasformerà Virtuoso da un semplice diario a un vero e proprio **coach metodologico**, aiutando lo studente a non disperdere le energie e a seguire un percorso di studio strutturato e gratificante.

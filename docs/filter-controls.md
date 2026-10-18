# Ricerca e filtri

`src/components/shared/FilterPanel.tsx` contiene i controlli condivisi:

- `FilterPanel`: ricerca sempre visibile, popover sovrapposto senza spostamento della pagina, criteri rimovibili, azzeramento e conteggio risultati.
- `SearchField`: ricerca controllata con cancellazione e supporto al tasto Escape.
- `FilterSelect`: selettore con etichetta visibile e opzioni specifiche della schermata.
- `FilterDateRange`: intervallo di date con etichette e limiti reciproci.

Ogni schermata mantiene stato, query, criteri predefiniti e logica di filtraggio. I filtri si combinano; cambiare ricerca o criteri deve riportare la paginazione alla prima pagina. Le selezioni dei materiali restano indipendenti dai filtri.

```tsx
<FilterPanel
  search={{ value: search, onChange: setSearch, placeholder: t("common.search") }}
  filters={subject === "all" ? [] : [{ key: "subject", label: subjectName, onRemove: () => setSubject("all") }]}
  onReset={() => { setSearch(""); setSubject("all"); }}
  resultCount={filteredItems.length}
>
  <FilterSelect label={t("common.subject")} value={subject} onChange={setSubject} options={subjectOptions} />
</FilterPanel>
```

Nel builder delle routine, «Esplora» apre gli elementi della collezione per la materia corrente, nell’ordine dell’indice. Gli elementi espongono i propri segmenti. Selezionare l’intera collezione resta un’azione distinta; tutti i percorsi usano gli stessi ID di elementi e segmenti.

Nelle routine, i frammenti si selezionano in un popover con pagine da cinque elementi. I contenuti delle raccolte usano la stessa lista paginata dei materiali.

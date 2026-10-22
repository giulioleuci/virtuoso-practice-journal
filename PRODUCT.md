# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing codebase: React 18 + TypeScript + Vite + Tailwind/shadcn, Dexie (IndexedDB), Capacitor wrapper for an Android APK. Mobile web, not a native design language.

## Users
(inferred from the repo and the request, not interviewed) A musician practicing an instrument or studying theory/composition, often with a teacher. Two situations drive design: logging practice quickly mid-session with an instrument in hand, and jotting down homework live during a lesson, then planning tasks calmly at home.

## Product Purpose
Local-first practice journal: plan daily tasks, log sessions per piece section, track repertoire, lessons, and teacher homework. Success: logging costs seconds, not minutes, and nothing the teacher assigned is lost.

## Positioning
Per-section practice tracking (tempo, confidence, layers, techniques) plus lesson-to-task homework flow, fully offline.

## Operating Context
Used at the instrument (hands busy, phone or tablet) and in lessons (fast typing). All data lives in the browser (IndexedDB); no backend. Four UI languages: en, it, es, de.

## Capabilities and Constraints
- Tempo is expressed as a note value = bpm. Note values include whole, half, quarter, eighth, sixteenth plus dotted half/quarter/eighth for compound meters.
- Study materials have five types: piece, study, technical exercise, exercise and theory content. Manuals and collections are separate containers with mixed, ordered indexes and per-link references/pages; materials retain one identity and history across containers.
- Segments have stable IDs, positions, optional bar ranges and either a complete tempo override or the material’s tempo. New plans resolve defaults; saved plans and historical targets/results keep their own values and figures.
- Pieces and studies may enter repertoire and performance programmes.
- Backups export version 6 and import versions 4–6, validating owners, contexts and historical references before atomic replacement. Legacy backups have no inferred progression. Demo replacement remains an explicit user action; no startup reset.
- Three per-section star ratings (1-5): mood, focus, confidence. Confidence is required for a new session; mood and focus are optional context only; confidence alone feeds routine weighting. No quality scale, no per-layer or per-technique scores.

## Product Principles
- Fewest taps to record a session; detail is opt-in.
- One concept, one record: no duplicated fields or tables.
- Capture first, organize later (homework).
- Offline and local-first.

## Evidence on Hand
No users, testimonials or analytics. Sample data in `src/lib/sampleData.ts`.

## Tempo progression

Absolute BPM values are integers from 1 to 400; musical comparisons use exact BPM × note-value weights, with fractional conversions preserved. Stored and displayed original figures remain available.

Optional rules belong to a routine or recurrence root. Contexts separate material/section, layers and techniques. Success requires the planned working tempo and minimum confidence; rules choose consecutive successes or N within the last M evaluable sessions, with optional reduction after consecutive failures. Reduction takes priority. Missing data is neutral.

Initialization proposes the latest compatible qualified historical result and requires explicit confirmation. Each accepted change or effective rule edit starts a new persisted cycle. Session references preserve their original cycle and historical confidence threshold, including drafts saved later. Target evidence survives cycle changes and does not cap working tempo.

Every change is previewed and explicitly accepted in one transaction. Changed previews require confirmation again; studied, closed, past, source and customized activities are protected. New compatible occurrences inherit only confirmed tempos. Counts derive from sessions, never persisted counters.

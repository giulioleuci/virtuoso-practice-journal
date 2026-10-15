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
- Migrations preserve data: no wipe shortcuts.
- Three per-section star ratings (1-5): mood, focus, confidence. Confidence is required for a new session; mood and focus are optional context only; confidence alone feeds routine weighting. No quality scale, no per-layer or per-technique scores.

## Product Principles
- Fewest taps to record a session; detail is opt-in.
- One concept, one record: no duplicated fields or tables.
- Capture first, organize later (homework).
- Offline and local-first.

## Evidence on Hand
No users, testimonials or analytics. Sample data in `src/lib/sampleData.ts`.

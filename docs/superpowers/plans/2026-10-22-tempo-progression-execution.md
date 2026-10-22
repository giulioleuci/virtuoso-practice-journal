# Tempo progression — execution record

Plan: [2026-10-22-tempo-progression.md](2026-10-22-tempo-progression.md).

Implemented all eight areas: musical equivalence and BPM1–400; deterministic configurable rules; additive Dexie18 cycles and backup6/import4–6; atomic preview/acceptance; future occurrence inheritance; routine/series forms; context suggestions preserving actual session results; consistent progress/chart comparisons.

## Verification

- Baseline: CI652 passed/1 failed (`StudySetup`, missing `Contesto storico`); preexisting working changes were saved separately and retained.
- Final CI: lint, i18n, **106 test files / 690 tests**, production build all pass (exit0). Run with `VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 npm run ci` to avoid the baseline suite’s parallel-load timeouts; project configuration unchanged.
- `npx tsc --noEmit -p tsconfig.app.json`: exit0. `git diff --check`: clean.
- Regression tests cover both eligible increase/decrease, incomplete observations, historical references, late drafts, a mark edited during confirmation, concurrent acceptances, rollback, owner separation, combined tasks, rule changes across multiple contexts, legacy history indices and current-rule regeneration.
- Real Chrome flow: initialize68 eighth; three equivalent34 quarter successes; accept72 eighth; two failures; accept68 eighth. Customized task stays70. A recurrence of the same section independently starts at10 dotted-quarter with zero observations counted. Backup6 exports/imports both states.
- German, long titles and multiple sections rendered at375×812,812×375,768×1024,1366×768. At200% zoom and375×420 reduced viewport, no horizontal overflow; save remains visible. Reduced motion emulated. Actual mobile keyboard and screen-reader hardware were not available.
- Impeccable detector: ran once on the changed production TSX files; returned `[]`.
- The compiled PWA was loaded under its service worker, network disabled, and `/log?task=1` reopened successfully with restored demo data.
- Mock Web Audio clock verifies1 BPM spacing, change1→120 and skipping missed beats after suspension. Physical listening on browser/Android remains unverified.

## Decisions and review

1. Used local branch `tempo-progression` in the existing checkout to preserve required dirty dependencies. Cost: shared working directory instead of a separate worktree.
2. Added derived `tempoSegmentIds` alongside `tempoProgressionIds` to find legacy combined-session history without scanning the archive. Both rebuild from marks; neither establishes membership. Cost: one additional index.
3. Exercised repository transactions and the acceptance use case together instead of creating temporary placeholder acceptance code. Cost: Tasks3/4 share the initial integration gate.
4. The initialization callback receives the exact reference returned by the acceptance transaction, alongside state. This avoids rereading a later mutable threshold/cycle. Cost: an additive callback argument and acceptance result field.
5. The domain boundary check distinguishes browser `window` member access from the approved `rule.window` field. Cost: a more specific static heuristic.
6. Consolidated selective staging/commit after verification because existing modifications overlap shared files. Unrelated preexisting changes remain uncommitted. Cost: one feature commit instead of eight incremental commits.
7. Kept the existing web/Capacitor design guidance. The automatic Android platform finding describes the known wrapper; no collateral design-document migration was performed.

A fresh read-only reviewer found five Important issues; each was fixed with regression coverage: multi-context plan overwrites, stale/non-atomic generation and carryover, missing legacy history indexes, initialization overwriting a newer draft, and cross-owner backup references. The window denominator wording was treated as a correctness issue and fixed. The shared query adapter now ignores late/out-of-order reads, with a deferred-read regression test. No review findings were deferred.

The reviewer did not independently judge physical audio/Android, concurrent final rendered checks, or the last CI run. Those are executor checks with the limitations above; visual review was not independently repeated.

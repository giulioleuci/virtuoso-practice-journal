# Task 1 report — Clean Architecture Lite boundary lock

## Scope

- Added a presentation import/API audit for `src/pages`, `src/components`, and production `src/hooks` files.
- Added an explicit temporary baseline of 47 legacy presentation files. Any added or changed violation fails the audit.
- Added ESLint boundaries for future domain/application code and presentation code.
- Documented baseline ownership in `AGENTS.md`.

## TDD evidence

### RED

Command:

```bash
npx vitest run src/test/architecture/import-boundaries.test.ts --reporter=verbose
```

Result: exit 1. The new audit expected `{}` and found 47 production presentation files importing `@/lib/db` and/or `dexie-react-hooks`. No `dexie`, infrastructure, Capacitor filesystem, `FileReader`, `Blob`, or `URL.createObjectURL` violations were found in this scope. Test files are deliberately excluded because this is a production presentation boundary.

### GREEN

Command:

```bash
npx vitest run src/test/architecture/import-boundaries.test.ts && npm run lint
```

Result: exit 0. Vitest: 1 file / 1 test passed. ESLint: 0 errors, 80 warnings. Seventy-nine warnings are legacy presentation restricted imports covered by the temporary audit baseline; the remaining warning is the pre-existing `react-hooks/exhaustive-deps` warning in `src/pages/History.tsx`.

## Changed files

- `AGENTS.md` — identifies the temporary baseline and removal rule.
- `eslint.config.js` — restricts React, Dexie, persistence, infrastructure, Capacitor filesystem, and browser file APIs in domain/application; warns on legacy presentation imports while the audit fails new violations.
- `src/test/architecture/import-boundaries.test.ts` — recursively audits presentation source, excludes test files, and records 47 explicit temporary baseline entries.

## Self-review

- Audit uses exact equality against the baseline, so a new offender, a newly forbidden API in an existing offender, or a stale baseline entry fails immediately.
- Rules use errors for domain/application (no current source there) and warnings for presentation's documented migration baseline; hard-failing the latter would block the existing app before vertical-slice migration.
- Browser API usage is checked by both the audit and ESLint global/syntax rules.
- `git diff --check` passed. Unrelated dirty files were neither changed nor staged.

## Follow-up

Remove baseline entries and upgrade presentation restrictions from warning to error as each vertical slice moves behind application/infrastructure boundaries. Task 8 removes the baseline entirely.

## Review-fix addendum

### Findings fixed

- The audit now detects each restricted module through static `from` imports, side-effect imports, dynamic `import(...)`, and CommonJS `require(...)`.
- The audit records every occurrence, rather than unique labels per file. Four already-existing duplicate `@/lib/db` imports were added explicitly to the temporary baseline: `LinkTargetFields.tsx`, `Diary.tsx`, `ItemAnalysisPage.tsx`, and `Tasks.tsx`.
- Production-source discovery now excludes both `*.test.*` and `*.spec.*` files.

### TDD evidence

#### RED

Command:

```bash
npx vitest run src/test/architecture/import-boundaries.test.ts --reporter=verbose
```

Result: exit 1. Three regression tests failed with `ReferenceError`: `restrictedLabelsIn is not defined` (twice) and `isProductionSourceFile is not defined`. The pre-existing baseline test still passed, proving the prior audit missed all three bypass cases.

#### GREEN

Command:

```bash
npx vitest run src/test/architecture/import-boundaries.test.ts && npm run lint
```

Result: exit 0. Vitest: 1 file / 4 tests passed. ESLint: 0 errors, 80 warnings. Warnings remain presentation-only restricted-import migration warnings plus the existing `react-hooks/exhaustive-deps` warning in `History.tsx`.

### Changed files

- `src/test/architecture/import-boundaries.test.ts` — hardened import detection, preserved duplicate occurrences in audit output, excluded spec files, added three regression tests, and expanded temporary baseline for four pre-existing duplicate imports.
- `.superpowers/sdd/task-1-report.md` — recorded review correction and verification evidence.

### Self-review

- Static, side-effect, dynamic, and CommonJS import forms are matched for every restricted module.
- Baseline equality now compares occurrence counts, so another matching import in a previously baselined file fails.
- Test/spec files are excluded from production presentation audit; ESLint warning behavior is unchanged.

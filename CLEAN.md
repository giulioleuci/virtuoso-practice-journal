# CLEAN.md — Clean Code Standard for Virtuoso

This document is a complete, self-contained instruction set for producing clean
code in this repository. It is written to be opened in a fresh session and
executed end-to-end without further context. Read it fully, then follow the
**Execution Procedure** at the bottom.

The goal is a codebase where every file reads as if written by a single careful
author: clear names, small focused units, honest types, no dead weight, and a
green test suite. Treat every criterion below as a hard requirement, not a
suggestion.

---

## 0. Operating Principles

- **Leave each file better than you found it, and finish the job.** Do not leave
  partial work, stubs, or `TODO` placeholders behind.
- **The code is the source of truth.** Names, types, and structure must tell the
  reader what the code does without external explanation.
- **Delete fearlessly.** Unused exports, dead branches, commented-out blocks,
  unreachable code, and orphaned files must be removed entirely — not preserved,
  not annotated, not re-exported.
- **No transitional shims.** When a name, signature, or shape is wrong, change it
  at every call site so there is exactly one correct version. Do not keep an old
  path alive alongside a new one.
- **Behavior is preserved.** Cleaning changes how code reads, never what the app
  does. Every user-visible behavior and every passing test stays passing.

---

## 1. Naming

- Use intention-revealing names. A reader should know what a value is and why it
  exists from its name alone.
- Functions are verbs or verb phrases (`buildSessionSnapshot`, `markTaskDone`).
  Booleans read as predicates (`isArchived`, `hasSegments`, `canSchedule`).
- Variables and types are nouns. Collections are plural (`tasks`, `segments`).
- No abbreviations beyond well-known ones (`id`, `db`, `i18n`). No single-letter
  names except loop indices and short-lived lambda params (`x => x.id`).
- No type or scope encoding in names (no `strName`, no `IProfile` Hungarian/
  interface prefixes). TypeScript already carries the type.
- Names are consistent across the codebase: the same concept uses the same word
  everywhere (pick `library item`, not `item` here and `entry` there).
- Avoid noise words (`data`, `info`, `manager`, `helper`, `util`) unless they
  carry real meaning. Prefer `formatDuration` over `durationHelper`.

## 2. Functions

- A function does one thing at one level of abstraction. If you must scroll to
  read it, or it mixes high-level orchestration with low-level detail, split it.
- Target ≤ 30 lines per function. Treat anything larger as a signal to extract a
  well-named smaller function.
- Prefer ≤ 3 parameters. When more are needed, pass a single typed options
  object with named fields.
- No boolean flag parameters that switch behavior. Split into two clearly named
  functions instead.
- No side effects hidden behind an innocent name. A function named `getX` must
  not also mutate or persist.
- Return early to avoid deep nesting. Keep the happy path at the leftmost indent.
- Functions either answer a question or perform an action — not both
  (command/query separation).

## 3. Comments

- Prefer self-explanatory code over comments. If a comment explains *what* the
  code does, rename and restructure until the code says it itself, then delete
  the comment.
- Keep a comment only when it explains a **why** that the code cannot: a
  non-obvious constraint, an invariant, a deliberate edge-case decision, or a
  domain rule (e.g. why a `SessionSnapshot` is copied immutably).
- Remove all commented-out code, changelog-style comments, attribution comments,
  and redundant restatements of the line below.
- No comment may reference the cleaning work itself, task history, ticket
  numbers, or "old vs new" anything. Comments describe the code as it stands now.

## 4. Formatting & Structure

- One responsibility per file. A file's name predicts its contents.
- Order top-down: a file reads like prose, with high-level functions first and
  the details they call below.
- Group related code; separate unrelated code with blank lines. No giant
  undivided walls of statements.
- Imports are ordered and free of unused entries. Use the `@/` path alias for
  internal modules consistently.
- Respect the established layering (see §8). Each layer's file lives in its
  designated directory.

## 5. Types (TypeScript)

- Make illegal states unrepresentable. Model variants with discriminated unions
  rather than optional fields that are "set sometimes" (e.g. task scope: free /
  library item / collection should be a tagged union).
- Ban `any`. Use precise types, generics, or `unknown` with narrowing at the
  boundary.
- Avoid non-null assertions (`!`). Narrow with guards or restructure so the value
  is provably present.
- Derive types from a single source: shared shapes live in `src/lib` (schemas,
  domain, `db.ts`) and are imported, never re-declared inline.
- Prefer `type`/`interface` definitions over inline object literals repeated
  across signatures.
- Function signatures are fully and honestly typed — no implicit `any`
  parameters, no return types that lie about nullability.

## 6. Errors & Edge Cases

- Validate at boundaries (form input via Zod schemas, external/native APIs).
  Trust internal callers; do not defensively re-validate values your own typed
  code already guarantees.
- Throw or surface errors meaningfully; never swallow them in an empty
  `catch {}`. If recovery is intended, the recovery must be explicit and named.
- Handle the empty, loading, and error states of every live query in the UI
  (use the shared `EmptyState` / `ErrorBoundary` primitives).
- No magic numbers or magic strings. Promote them to named constants with a
  clear unit or meaning.

## 7. Duplication

- Each piece of knowledge has one authoritative home. Extract a shared helper
  only when the duplication represents the *same* concept — not when two snippets
  merely look alike.
- Do not over-abstract: a small amount of clear repetition is better than a
  premature, hard-to-follow abstraction. Apply judgment, and favor readability.

## 8. Architecture & Layering (project-specific)

These rules encode the existing architecture and must be upheld:

- **Persistence lives in `src/lib/db.ts`.** All Dexie tables and the schema are
  defined there.
- **DB writes go through the service layer** (`src/lib/services/*.ts`). UI code
  (`src/pages/**`, `src/components/**`) must never call
  `db.<table>.add/put/update/delete/...` directly. This is enforced by ESLint;
  keep it green.
- **Reads flow through live-query hooks** in `src/hooks/useEntities.ts`.
  Components consume these hooks rather than querying Dexie inline.
- **Business logic belongs in services or `src/lib/domain`, not in components.**
  Components compose UI and delegate logic.
- **All user-facing strings go through `useI18n()`** with keys present in all
  four languages (en, it, es, de). No hard-coded display text in components.
  Run `npm run i18n:validate` to confirm parity.
- **Forms use React Hook Form + Zod**, with schemas centralized in
  `src/lib/schemas.ts`.

## 9. Tests

- Every service module has co-located tests (`*.test.ts`) covering its behavior,
  including edge cases (empty inputs, soft-deleted records via `deletedAt`,
  snapshot immutability).
- Test names state the behavior under test as a sentence.
- Tests are independent and deterministic — no shared mutable state, no reliance
  on execution order. `fake-indexeddb` resets between tests.
- The full suite (`npm run test`) passes. No skipped or focused tests are left
  behind.

## 10. Definition of Done

Clean code in this repo means **all** of the following hold simultaneously:

- [ ] `npm run lint` reports zero errors and zero warnings.
- [ ] `npm run test` passes with no skipped/focused tests.
- [ ] `npm run build` succeeds.
- [ ] `npm run i18n:validate` reports full parity across all four languages.
- [ ] No `any`, no `!` non-null assertions, no `@ts-ignore` remain (or each
      remaining one has a one-line justification of a genuine external limit).
- [ ] No commented-out code, dead exports, or unused files remain.
- [ ] No file mixes layers; UI never writes to the DB directly.
- [ ] Every public function and type has a clear, intention-revealing name.

---

## Execution Procedure

Run these steps in order in a fresh session. Work in small, verifiable
increments and keep the test suite green throughout.

1. **Establish a baseline.** Run all four checks and record the current state:
   ```bash
   npm run lint
   npm run test
   npm run build
   npm run i18n:validate
   ```
   Fix any pre-existing failures first so you start from green.

2. **Survey the code.** List source files by size and complexity (large files
   and large functions are the highest-value targets):
   ```bash
   find src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -30
   ```

3. **Sweep one directory at a time**, in this order, applying §1–§9 to every
   file in it before moving on:
   1. `src/lib/db.ts`, `src/lib/schemas.ts`, `src/lib/domain`
   2. `src/lib/services`
   3. `src/hooks`
   4. `src/lib/i18n.tsx`
   5. `src/components`
   6. `src/pages`

4. **For each file**, in this order:
   - Remove dead code, unused imports/exports, and stray comments.
   - Correct names to be intention-revealing across all call sites.
   - Split oversized functions; flatten nesting with early returns.
   - Tighten types: replace `any`/`!`, model states with unions, derive shared
     shapes from a single source.
   - Enforce layering: move stray DB writes into services, stray logic into
     services/domain, stray strings into i18n.

5. **Verify after every file or small group of files:**
   ```bash
   npm run lint && npm run test
   ```
   Never accumulate unverified changes. If a check goes red, resolve it before
   continuing.

6. **Final gate.** Confirm the entire **Definition of Done** checklist (§10)
   passes:
   ```bash
   npm run lint && npm run test && npm run build && npm run i18n:validate
   ```

7. **Commit** in focused, descriptive commits grouped by area (e.g. one per
   directory swept). Each commit message states what became cleaner and why, in
   plain language. Push to the working branch when the Definition of Done holds.

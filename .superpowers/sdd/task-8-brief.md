### Task 8: Safely remove legacy code and certify completion

Work only from evidence. Before each deletion, use the codebase graph plus TypeScript references to prove it has no production importers; preserve framework callbacks and test support regardless of superficial similarity.

- Audit candidates in legacy `src/lib/services/**`, compatibility database exports, `_shared.ts`, `useFormDraft.ts`, and the previously reported `Tasks`/`Library` candidates. For `onClick`, `saveDraft`, `totalPerWeek`, and toast wrappers, trace actual callers before deciding whether to retain, migrate, or delete.
- Retire compatibility adapters/re-exports only after zero-reference evidence, moving any retained behavioral tests to the domain, application, infrastructure, or presentation boundary that owns the behavior.
- Add or retain focused tests before every observable deletion. Keep the presentation data boundary intact: no presentation imports of Dexie, `db`, infrastructure, or legacy persistence services.
- Remove the temporary architecture-test baseline only if the audited import set is genuinely empty. Re-index the graph and record evidence of zero forbidden presentation imports.
- Update `architectural_audit_report.md` with final outcomes, residual intentional exceptions (if any), and the certification evidence.
- Run the full `npm run ci` gate: lint, i18n validation, all tests, and production build. Resolve failures caused by this work; report genuinely pre-existing failures precisely if any remain.
- Commit only the scoped outcome as `refactor: complete clean architecture lite migration`.

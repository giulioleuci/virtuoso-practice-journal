### Task 5: Isolate backup file handling and migrate Profile

**Files:** Modify `src/lib/services/backup.ts`, `src/pages/Profile.tsx`; create `src/application/useCases/{exportBackup,importBackup}.ts`, `src/domain/ports/BackupFileGateway.ts`, `src/infrastructure/gateways/{BrowserBackupFileGateway,CapacitorBackupFileGateway}.ts`, and tests.

- [ ] Write failing use-case tests for version/format validation, export, malformed input, and transactional rollback using fake repositories/gateway without rendering `Profile`.
- [ ] Implement `ImportBackupUseCase`/`ExportBackupUseCase` for validation, transformation, and transactions only. Implement file picking, `FileReader`, Blob/object-URL download, and Capacitor access only in infrastructure gateway adapters.
- [ ] Refactor `Profile` to invoke presentation commands and render their progress/result state; remove direct native/browser access and its boundary-test baseline entry.
- [ ] Run `npx vitest run src/application/useCases/backup.test.ts src/infrastructure/gateways`; commit `refactor: isolate backup file handling`.

Global: application only domain ports/types; file/browser/native APIs exclusively infrastructure; presentation no direct browser/native file APIs; preserve backup format/version/rollback behavior; TDD/graph discovery; no unrelated edits.

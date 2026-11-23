# scripts/legacy

Historical one-off check scripts from SvenStudio 3D v0.5 – v2.0 (and a few example/demo generators).

They were moved here in **v2.3 HF4** because they are no longer run by anything:

- 52 were not referenced by `package.json`, the launchers, other scripts or tests.
- 28 were `npm run` checks that failed on the current code: they assert old version numbers
  (e.g. `1.0.0`), old file layouts or code fragments that have since been refactored.

Current regression coverage lives in `tests/`:

```
npm test            # Vitest (*.test.ts) + node:test suites (*.test.mjs / *.test.cjs)
npm run smoke       # quick standalone engine smoke test
npm run test:e2e    # real SC-CSG/BSP/VIS/RAD compile with your installed compilers
```

Nothing here is required to build or run the editor. Keep, read or delete as you like.

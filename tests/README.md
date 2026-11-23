# SvenStudio 3D tests

- `npm test` — Vitest (`*.test.ts`) and then the Node suite (`*.test.mjs`, `*.test.cjs`).
- `npm run typecheck` — `tsc --noEmit`.
- `SVEN_E2E=1 npm run test:e2e` — real compiles with the local Sven Co-op SDK (skipped without it).

Files stay flat in `tests/` because many of them rewrite import paths inside source text
(`"from '../store'"`), so moving them into folders would change what they test. The file-name
prefix gives the area. To run one area, pass a glob to the same command `test:node` uses:

```powershell
runtime\node.exe --experimental-transform-types --no-warnings --experimental-loader ./scripts/bsp-test-resolver.mjs --test "tests/bsp-*.test.mjs"
```

| Area | File-name prefixes |
|---|---|
| BSP viewer/editor, recovery, prefabs from BSP | `bsp-*`, `hf11-bsp-*` |
| BuildTogether and co-op | `buildtogether-*`, `coop-*` |
| Counter-Strike 1.6 profile | `cs16-*`, `hf28-*` … `hf33-*`, `sdhlt-*`, `v23-hf4-cs16-*` |
| Compile, packaging, launch | `e2e-*`, `hf10-isolated-build`, `smart-build-*`, `map-packager`, `wad-compile-*`, `game-launch-*`, `true-lighting-*`, `lighting-*`, `release-*` |
| Studios | `blueprint-*`, `texture-*`, `uv-*`, `wad-*`, `mission-*`, `gameplay-*`, `path-*`, `railway-*`, `terrain-*`, `world-builder-*`, `npc-*`, `decal-*`, `material-*`, `prefab-*`, `architecture-*`, `hf20-*`/`hf21-*` (Smart Connect) |
| Interface | `ui-*`, `adaptive-*`, `interface-themes-*`, `workspace-*`, `help-*`, `properties-*`, `universal-placement-*`, `viewport-*`, `map-entity-labels-*`, `css-unused-*`, `i18n-*` |
| Core engine (Vitest) | `geometry`, `modeling`, `advancedModeling`, `fgd`, `controls`, `layout`, `multiSelection`, `hammer-svencraft-rmf`, `revealHiddenToggle` (`*.test.ts`) |

Helpers live in `tests/support/`: `typescript.cjs` (esbuild-backed TS shim), `legacyI18n.cjs`, and
`splitParts.cjs`. Source-text checks written before `App.tsx`/`Viewport.tsx` were split in v2.3 HF5 use
`splitParts.cjs` to read the original file plus `src/app/*` or `src/components/viewport/*`.

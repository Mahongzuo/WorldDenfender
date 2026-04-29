# Project Guidelines

## Architecture

- Keep `src/main.ts` as the composition root and high-coupling gameplay flow, not the home for static data tables or conversion helpers.
- Put shared contracts in `src/game/types.ts`.
- Put static gameplay content in `src/game/content.ts` and built-in maps in `src/game/maps.ts`.
- Put grid math and runtime map-space helpers in `src/game/runtime-grid.ts`.
- Put runtime-to-editor conversion logic in `src/game/editor-runtime.ts`.
- Prefer pragmatic feature boundaries similar to Lyra: clear ownership, low coupling, but no framework-heavy abstractions.
- Extract cohesive slices first: data, pure utilities, runtime/editor bridge code, then larger systems like combat or asset loading.

## Build And Test

- Validate architectural refactors with `npm run build`.

## Conventions

- Prefer domain-based module names over generic `utils` or `helpers` when ownership is clear.
- Avoid over-design: no containers, plugin systems, or event buses unless the codebase already has multiple real implementations that need them.
- When moving shared gameplay data, update any editor/runtime sync code that parses source modules.

See `.github/skills/earthguardian-modular-gameplay/SKILL.md` for the fuller modularization workflow.
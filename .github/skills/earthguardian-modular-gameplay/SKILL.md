---
name: earthguardian-modular-gameplay
description: 'Modularize EarthGuardian gameplay and editor code. Use when splitting src/main.ts, adding new gameplay systems, reorganizing runtime/editor bridge code, or refactoring toward pragmatic Lyra-style feature boundaries without overengineering.'
user-invocable: true
---

# EarthGuardian Modular Gameplay

Use this skill when working on gameplay architecture in this repository, especially around `src/main.ts`, editor-runtime bridges, built-in content, and feature growth.

## Design Goal

Follow a pragmatic Lyra-like direction:
- keep data, feature logic, and runtime glue separated
- make feature modules obvious to extend
- prefer extraction of cohesive slices over framework-heavy abstractions
- keep runtime/editor shared contracts in one place
- do not introduce service layers or interfaces unless multiple call sites already need them

## Default Boundaries

- `src/game/core/types.ts`: shared runtime/editor/gameplay contracts
- `src/game/data/content.ts`: static gameplay content such as builds, cities, pools
- `src/game/data/maps.ts`: built-in map definitions only
- `src/game/core/runtime-grid.ts`: grid math, coordinate transforms, runtime map-space helpers
- `src/game/editor/editor-runtime.ts`: runtime-to-editor conversion and editor layout helpers
- `src/game/core/browser-utils.ts`: browser- or Three.js-specific utility helpers reused across systems
- `src/game/host/tower-defense-game.ts`: gameplay orchestrator; `src/game/index.ts` re-exports the host for `main`
- `src/main.ts`: bootstrap only (instantiate game from `./game`)

See the recommended split strategy in [module-boundaries](./references/module-boundaries.md).

## Procedure

1. Identify whether the target code is data, pure utility, feature logic, or orchestration.
2. Extract pure data and pure functions first. These are the cheapest, safest cuts.
3. Keep shared contracts in `src/game/core/types.ts` instead of redefining local shapes.
4. When code serves both runtime and editor, prefer a dedicated bridge/helper module over duplicating logic.
5. When a subsystem grows past a few hundred lines, split by responsibility, not by arbitrary file size.
6. Validate immediately with `npm run build` after each meaningful extraction.
7. Preserve working behavior before chasing ideal architecture.

## Rules Of Thumb

- Prefer module names that describe ownership, such as `combat`, `gacha`, `asset-loading`, `editor-runtime`.
- Avoid generic buckets like `helpers` when a domain name is available.
- Keep modules mostly acyclic. If two modules keep importing each other, the boundary is wrong.
- Let `main.ts` wire systems together, but do not let it remain the home for data tables and conversion logic.
- Add comments only where the boundary or rule is non-obvious.
- **始终使用中文与用户沟通。**

## Anti-Patterns

- Moving code into many tiny files with no clear ownership
- Adding abstract base classes or plugin systems before there are multiple implementations
- Mixing editor persistence logic directly into combat/runtime loops
- Creating modules that only re-export a single function without a real boundary

## Validation

- Run `npm run build`
- Check gameplay/editor bridge paths that depend on moved constants or data sources
- If runtime sync parses source files, update the parser target when data moves
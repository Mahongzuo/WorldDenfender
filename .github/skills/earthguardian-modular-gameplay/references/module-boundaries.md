# Module Boundaries

Use these boundaries as the default refactor map for this repository.

## Good Next Cuts

- `combat`: targeting, damage, healing, status effects, active skills
- `asset-loading`: model resolution, custom asset config loading, animation loading
- `editor-sync`: remote editor config fetch, runtime seed merge, city matching
- `ui-shell`: DOM querying, HUD binding, panel refresh

## Extraction Order

1. Static content and maps
2. Grid/math/layout utilities
3. Runtime-to-editor bridges
4. Asset loading and persistence
5. Combat and progression systems
6. UI shell and input wiring

## Keep In Main

- app bootstrap
- top-level orchestration
- high-level mode switching
- system composition and lifecycle wiring

## Do Not Over-Design

- avoid turning every feature into a mini framework
- avoid dependency injection containers
- avoid event buses unless several systems already need decoupled fan-out
- prefer a direct import over a registry when ownership is clear
/** Module-graph rules for the game source (npm run depcruise). docs/reference/ARCHITECTURE.md §7 explains them.
 *  ⚠️ A violation is a lead, not a verdict.
 *  The order utils < config < state < systems < ui holds only in part. What holds (each rule below is
 *  0 violations unless it says otherwise): nothing outside src/ui imports src/ui; nothing in src/systems
 *  imports React; src/state reaches src/systems only by dynamic import; src/config never reaches
 *  src/state and imports from src/systems only the pure kernel listed in CONFIG_KERNEL. What does NOT
 *  hold: utils imports config (the sprite manifest, the registries), and config imports that kernel. */

/** The src/systems modules src/config may import: helpers and name tables that never reach src/state (config-never-reaches-state checks it). */
const CONFIG_KERNEL = [
  '^src/systems/atlas/(TerrainMap|WaterShapes)[.]js$',
  '^src/systems/board/boardEvents[.]js$',
  '^src/systems/core/(engineEvents|wearRule)[.]js$',
  '^src/systems/effects/(constants|effectIdMigration|effectLibrary|effectMigration|skillIdMigration|statements)[.]js$',
  '^src/systems/hero/perkTable[.]js$',
  '^src/systems/progression/hallStarText[.]js$'
];

module.exports = {
  forbidden: [
    { name: 'no-static-cycle', severity: 'error',
      comment: 'A cycle made only of static imports (npm run cycles calls these the dangerous kind).',
      from: {}, to: { circular: true, viaOnly: { dependencyTypesNot: ['dynamic-import'] } } },
    { name: 'no-circular', severity: 'warn',
      comment: 'Any cycle, dynamic links included.',
      from: {}, to: { circular: true } },
    { name: 'systems-not-from-ui', severity: 'error',
      comment: 'Engine code must not depend on React or UI modules.',
      from: { path: '^src/systems' }, to: { path: '^src/ui' } },
    { name: 'systems-no-react', severity: 'error',
      from: { path: '^src/systems' }, to: { path: 'node_modules/react' } },
    { name: 'state-not-from-ui', severity: 'error',
      from: { path: '^src/state' }, to: { path: '^src/ui' } },
    { name: 'state-never-imports-systems', severity: 'error',
      comment: 'The save store sits below the engine; rebuilding a loaded save lives in systems/core/LoadedState.js.',
      from: { path: '^src/state' }, to: { path: '^src/systems' } },
    { name: 'config-not-from-state-or-ui', severity: 'error',
      from: { path: '^src/config' }, to: { path: '^src/(state|ui)' } },
    { name: 'config-never-reaches-state', severity: 'error',
      comment: 'Registries load at import time; reaching GameState from one would tie content loading to the save.',
      from: { path: '^src/config' }, to: { path: '^src/state', reachable: true } },
    { name: 'config-systems-kernel-only', severity: 'error',
      comment: 'config may import from systems only the pure kernel (CONFIG_KERNEL); anything else is an upward import.',
      from: { path: '^src/config' }, to: { path: '^src/systems', pathNot: CONFIG_KERNEL } },
    { name: 'i18n-leaf', severity: 'error',
      from: { path: '^src/i18n' }, to: { path: '^src/(config|state|systems|ui)' } },
    { name: 'utils-only-utils', severity: 'warn',
      comment: 'utils may read config; today 1 violation: CombatFormulas imports systems/effects/constants.',
      from: { path: '^src/utils' }, to: { path: '^src/(systems|state|ui)' } },
    { name: 'game-not-from-cms', severity: 'error',
      comment: 'The CMS imports the game, never the reverse; game tests may import the CMS.',
      from: { path: '^src', pathNot: '^src/tests' }, to: { path: '^cms' } },
    { name: 'no-tests-from-src', severity: 'error',
      from: { path: '^src', pathNot: '^src/tests' }, to: { path: '^src/tests' } },
    { name: 'no-orphans', severity: 'info',
      from: { orphan: true, pathNot: ['\.d\.ts$', '(^|/)\.[^/]+$'] }, to: {} }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['^src/tests', 'node_modules'] },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'], extensions: ['.js', '.jsx', '.mjs'] },
    reporterOptions: { dot: { collapsePattern: 'node_modules/[^/]+' }, text: { highlightFocused: true } }
  }
};

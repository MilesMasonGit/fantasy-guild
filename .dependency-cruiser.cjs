/** Module-graph rules for the game source (npm run depcruise).
 *  ⚠️ These rules describe the INTENDED layering; a violation is a lead, not a verdict.
 *  Layers, lowest first: utils, config, state, systems, ui. Lower layers never import higher ones. */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'warn', from: {}, to: { circular: true } },
    { name: 'systems-not-from-ui', severity: 'error',
      comment: 'Engine code must not depend on React or UI modules.',
      from: { path: '^src/systems' }, to: { path: '^src/ui' } },
    { name: 'systems-no-react', severity: 'error',
      from: { path: '^src/systems' }, to: { path: 'node_modules/react' } },
    { name: 'state-not-from-ui', severity: 'error',
      from: { path: '^src/state' }, to: { path: '^src/ui' } },
    { name: 'utils-only-utils', severity: 'warn',
      from: { path: '^src/utils' }, to: { path: '^src/(systems|state|ui)' } },
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

// Build flags: what a build carries, decided at compile time.

/**
 * The QA panel and its dev sections: on in dev and in a plain `vite build` (the owner's desktop
 * test builds), off in `vite build --mode ship` (a release). The perf build keeps its own gates
 * (the panel behind Debug Mode, the perf section only), so the benches measure what they always
 * did.
 * ⚠️ Keep this a literal `import.meta.env` expression: Vite inlines it and Rollup then drops
 * every `QA_TOOLS && …` branch, and with it the dev code, from a ship build. Keep the `?.`:
 * the benches import `matTuning.js` (and so this file) in plain Node, where there is no env.
 */
export const QA_TOOLS = !!(import.meta.env?.DEV || import.meta.env?.MODE === 'production');

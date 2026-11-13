// Build flags: what a build carries, decided at compile time.

/**
 * The QA panel: on in dev and in a plain `vite build` (the owner's desktop test builds), off in
 * `vite build --mode ship` (a release). The perf build keeps its own gate (the panel behind Debug
 * Mode), so the benches measure what they always did.
 * ⚠️ Keep this a literal `import.meta.env` expression: Vite inlines it and Rollup then drops
 * the `QA_TOOLS && …` branch, and with it the panel's code, from a ship build. The `?.` lets a
 * plain Node import read it, where there is no env.
 */
export const QA_TOOLS = !!(import.meta.env?.DEV || import.meta.env?.MODE === 'production');

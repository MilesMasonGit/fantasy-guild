/**
 * How a change pack declares the stage moves it means to make (`pack.intent`), so the gate lets
 * them through (`packGate.js`). Format and meaning: `cms/incoming/README.md`, "Declaring a move".
 *
 *   "intent": { "stages": [{ "tier": 2, "move": "faster", "note": "why", "toHours": 24 }] }
 *
 * Pure; `changePacks.js` checks the block with the rest of the pack.
 */

export const STAGE_MOVES = Object.freeze(['faster', 'slower']);

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** What is wrong with a pack's `intent`, as sentences; none when it has no `intent`. */
export function intentErrors(intent) {
    if (intent === undefined) return [];
    if (!isPlainObject(intent)) return ['"intent" must be an object: { "stages": [...] }.'];
    const errors = [];
    for (const key of Object.keys(intent)) if (key !== 'stages') errors.push(`"intent.${key}" is not something a pack can declare; only "stages".`);
    if (intent.stages === undefined) return errors;
    if (!Array.isArray(intent.stages)) return [...errors, '"intent.stages" must be a list.'];
    const seen = new Set();
    intent.stages.forEach((s, i) => {
        const at = `"intent.stages" ${i + 1}`;
        if (!isPlainObject(s)) {
            errors.push(`${at} must be an object.`);
            return;
        }
        if (!Number.isInteger(s.tier) || s.tier < 0) errors.push(`${at}: "tier" must be a whole number from 0 (0 is the Starter Camp).`);
        else if (seen.has(s.tier)) errors.push(`${at}: tier ${s.tier} is already declared; one declaration per stage.`);
        else seen.add(s.tier);
        if (!STAGE_MOVES.includes(s.move)) errors.push(`${at}: "move" must be one of ${STAGE_MOVES.join(', ')}.`);
        if (typeof s.note !== 'string' || !s.note.trim()) errors.push(`${at}: "note" must say why the stage moves.`);
        if (s.toHours !== undefined && !(typeof s.toHours === 'number' && Number.isFinite(s.toHours) && s.toHours > 0)) {
            errors.push(`${at}: "toHours", when given, must be a number of hours above 0.`);
        }
    });
    return errors;
}

/** The declared moves by tier. */
export function declaredStages(pack) {
    const out = new Map();
    for (const s of Array.isArray(pack?.intent?.stages) ? pack.intent.stages : []) if (Number.isInteger(s?.tier)) out.set(s.tier, s);
    return out;
}

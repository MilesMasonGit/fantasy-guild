/**
 * Tempo — the four speeds a producing Token or recipe is allowed to run at.
 *
 * Added 2026-08-28 for the economic simulator rework (phase P2). This module is
 * **vocabulary and arithmetic only**. Nothing reads a Token's tempo yet: the
 * passes that will place cycle times inside these bands are P3 and P4, and the
 * CMS write-back that will act on them is P5. What exists today is the table,
 * so that the CMS can offer the four names and `ContentRules` can check a
 * Token that has been given one.
 *
 * It lives game-side rather than in `cms/` for the same reason `tokenConstants`
 * does (CMS-5): the CMS imports the game's vocabulary across the project
 * boundary, one direction only, so the two apps cannot disagree about what
 * `slow` means. `src/tests/CMSBoundary.test.js` guards that seam.
 *
 * ## The table (plan §13.3, transcribed)
 *
 * | Tempo  | Level 1  | Level 40 | Level 90 |
 * | :----- | :------- | :------- | :------- |
 * | Fast   | 8–12s    | 12–19s   | 18–28s   |
 * | Medium | 12–20s   | 19–31s   | 27–46s   |
 * | Slow   | 20–30s   | 31–47s   | 46–69s   |
 * | Heavy  | 30–120s  | 47–188s  | 69–274s  |
 *
 * ⚠️ **Those are three views of one rule, not three tables.** The level-1
 * column is the base band; every other column is that base scaled by level.
 *
 * ## ⚠️ The scaling rule is `1 + (level - 1)/70`, not the plan's `1 + level/70`
 *
 * **Owner ruling, 2026-08-28.** Plan §13.3 states the factor as `1 + level/70`
 * and *also* prints the level-1 column as 8–12 / 12–20 / 20–30 / 30–120s. Those
 * two statements contradict each other: `1 + 1/70` is 1.0143, so the literal
 * formula inflates every level-1 band by 1.4% and Medium's floor becomes
 * 12,171ms rather than 12,000ms. A Token authored at a round 12s and tagged
 * Medium then reads as *outside its own band* — a false warning in the CMS and,
 * because `ContentRules` calls the same function, a red test the first time
 * anyone tags round-numbered content.
 *
 * The owner ruled the printed table wins at level 1: authoring a round number
 * must land inside the band. Subtracting one from the level makes level 1 exact
 * and costs a little fit at the top — worst error against the plan's printed
 * level-40 and level-90 columns goes from 0.57s to **1.43s**, on bands tens of
 * seconds wide.
 *
 * A third reading (`(70 + level)/71`) was evaluated and rejected: exact at
 * level 1 but 3.58s off at the top, worse than either alternative.
 *
 * `EconSimTempo.test.js` re-runs the whole reconciliation, which is what would
 * catch someone later replacing the scaling with a second mechanism.
 *
 * ## Why the bands are contiguous
 *
 * Fast's top is Medium's floor, Medium's top is Slow's floor, and so on. A
 * cycle time therefore always falls in exactly one band (bar the shared
 * endpoints, which are inclusive on both sides — see `isInBand`).
 *
 * ## ⚠️ Heavy has no hard top
 *
 * 120s is where the simulator will *place* a Heavy cycle, not a wall a designer
 * may not cross. `heavy.topIsSoft` says so, and `isInBand` honours it: a Heavy
 * Token authored at four minutes is slow, not invalid. Every other band is
 * closed at both ends.
 *
 * ## Units
 *
 * Milliseconds, everywhere, because the rest of the codebase speaks
 * milliseconds (`config.cycleTimeMs` on a Token, `durationMs` on a recipe). The
 * table above is written in seconds because that is how the plan prints it.
 */

/**
 * The four tempos, **ordered slowest-growing to slowest** — Fast < Medium <
 * Slow < Heavy. The order is load-bearing: it is the order the bands stack in,
 * and UI that offers the four names should offer them this way round.
 */
export const TEMPO_NAMES = Object.freeze(['fast', 'medium', 'slow', 'heavy']);

/**
 * The divisor in the scaling rule `1 + (level - 1)/70` (plan §13.3, with the
 * owner's 2026-08-28 level-1 correction). Named rather
 * than inlined so the test can assert against the rule instead of a magic
 * number buried in a multiplication.
 */
export const LEVEL_SCALE_DIVISOR = 70;

/**
 * The **level-1 base band** for each tempo, in milliseconds. Every other level
 * is this, scaled. Do not add per-level rows here — that is the second
 * mechanism this file exists to prevent.
 */
export const TEMPO_BANDS = Object.freeze({
    fast: Object.freeze({ minMs: 8000, maxMs: 12000, topIsSoft: false }),
    medium: Object.freeze({ minMs: 12000, maxMs: 20000, topIsSoft: false }),
    slow: Object.freeze({ minMs: 20000, maxMs: 30000, topIsSoft: false }),
    heavy: Object.freeze({ minMs: 30000, maxMs: 120000, topIsSoft: true }),
});

/** Is `value` one of the four tempo names? */
export function isTempo(value) {
    return TEMPO_NAMES.includes(value);
}

/**
 * The scaling factor at a given level: `1 + (level - 1)/70`.
 *
 * ⚠️ **The `- 1` is deliberate and is an owner ruling** — see the note at the
 * head of this file. It makes level 1 exactly the printed base band, so a
 * round authored cycle time lands inside its band instead of 1.4% outside it.
 * Do not "correct" this to the plan's literal `1 + level/70`.
 *
 * A missing or nonsensical level is treated as level 1 rather than throwing —
 * a Token with no `skillRequired` is a level-1 Token.
 */
export function levelScale(level) {
    const n = Number(level);
    const safe = Number.isFinite(n) && n >= 1 ? n : 1;
    return 1 + (safe - 1) / LEVEL_SCALE_DIVISOR;
}

/**
 * The cycle-time band for `tempo` at `level`, in milliseconds, rounded to the
 * nearest millisecond.
 *
 * Returns `null` for a tempo that is not one of the four — callers decide
 * whether an untagged or mistyped record is an error or simply not their
 * business. `topIsSoft` is carried through so a caller can tell a real ceiling
 * from Heavy's advisory one.
 */
export function bandFor(tempo, level = 1) {
    const base = TEMPO_BANDS[tempo];
    if (!base) return null;
    const factor = levelScale(level);
    return {
        minMs: Math.round(base.minMs * factor),
        maxMs: Math.round(base.maxMs * factor),
        topIsSoft: base.topIsSoft,
    };
}

/**
 * Does `cycleMs` sit inside `tempo`'s band at `level`?
 *
 * **Endpoints are inclusive at both ends.** The bands are contiguous, so a
 * cycle time exactly on a shared boundary — 12000ms at level 1, say — is in
 * *both* Fast and Medium. That is deliberate: this answers "is this a
 * defensible Fast Token?", not "which single band owns this number?", and a
 * Token authored exactly on its own boundary should not fail a check for being
 * one millisecond too tidy.
 *
 * The one asymmetry is Heavy, whose top is advisory (see the header): anything
 * at or above Heavy's floor is in the Heavy band, however long it runs.
 *
 * An unknown tempo is `false` — there is no band to be inside.
 */
export function isInBand(cycleMs, tempo, level = 1) {
    const band = bandFor(tempo, level);
    if (!band) return false;
    if (!Number.isFinite(cycleMs)) return false;
    if (cycleMs < band.minMs) return false;
    if (band.topIsSoft) return true;
    return cycleMs <= band.maxMs;
}

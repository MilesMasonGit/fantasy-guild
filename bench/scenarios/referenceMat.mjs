// The mats the bench boards are laid out on, set through the Mat Tuner rather than read from the game.
//
// The boards' lattices and points are written in these numbers. Pinning the mat keeps every board on
// its own mat whatever size the game ships, so a change to the game's mat size changes no recorded
// work, and the drawing bench's stress boards (the same builders) stay the boards the cost log was
// measured on.
//
// ⚠️ Since Tokens stand at least 128 u apart (edges touching), a mat holds far fewer than it did at
// 81 u: the shipped 1920 × 1040 u mat holds about 130 even packed as a honeycomb. The S2 family and
// the cap boards therefore stand on bigger mats than the game ships, each the size that holds its
// board with every spawner's room (`realistic.mjs`, `layoutSlots`).

/** The mat S1 and the ledger's calibration setups are written on: 11 steps at 0.64, 1760 × 1126 u. */
export const REFERENCE_STEPS = 11;
export const REFERENCE_ASPECT = 0.64;
const STEP_U = 160;

/**
 * S2's mat, 16 steps at 0.64 (2560 × 1638 u): the smallest at that shape that holds S2's board with
 * every spawner at its cap. S5, S6, the S8 hour, `cap128` and the envelope boards stand on it too.
 */
export const S2_MAT = Object.freeze({ steps: 16, aspect: REFERENCE_ASPECT });

/**
 * The cap boards above the base cap, 20 steps at 0.68 (3200 × 2176 u): it holds about 250 of S2's mix,
 * so C240 reaches its cap and C256 fills the mat first.
 */
export const CAP_MAT = Object.freeze({ steps: 20, aspect: 0.68 });

/** The largest mat the Mat Tuner allows, 20 steps at 0.8 (3200 × 2560 u): S3's. */
export const LARGEST_MAT = Object.freeze({ steps: 20, aspect: 0.8 });

/**
 * Set the live mat to `steps` steps wide at `aspect`, before anything is placed.
 * @returns {{w: number, h: number}} its size in mat units
 */
export function pinMat(setMatTuning, steps = REFERENCE_STEPS, aspect = REFERENCE_ASPECT) {
    setMatTuning('matSteps', steps);
    setMatTuning('matAspect', aspect);
    const w = steps * STEP_U;
    return { w, h: Math.round(w * aspect) };
}

// The mat every bench board is laid out on, set through the Mat Tuner rather than read from the game.
//
// The boards' lattices and points are written in these numbers (the shipped mat when the baselines
// were taken: 11 steps at 0.64, 1760 × 1126 u). Pinning the mat keeps every board on its own mat
// whatever size the game ships, so a change to the game's mat size changes no recorded work, and the
// drawing bench's stress boards (the same builders) stay the boards the cost log was measured on.

export const REFERENCE_STEPS = 11;
export const REFERENCE_ASPECT = 0.64;
const STEP_U = 160;

/**
 * Set the live mat to `steps` steps wide at the reference aspect, before anything is placed.
 * @returns {{w: number, h: number}} its size in mat units
 */
export function pinMat(setMatTuning, steps = REFERENCE_STEPS) {
    setMatTuning('matSteps', steps);
    setMatTuning('matAspect', REFERENCE_ASPECT);
    const w = steps * STEP_U;
    return { w, h: Math.round(w * REFERENCE_ASPECT) };
}

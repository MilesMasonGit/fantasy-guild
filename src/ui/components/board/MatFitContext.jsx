// Fantasy Guild — how much the mat is scaled on screen (Free Playmat slice 1.7)

import React from 'react';

/**
 * ⭐ **The mat's live fit, for the things drawn on it** (FP-99).
 *
 * `Board` measures the space it has been given and scales the whole mat into it
 * with one CSS transform. Almost nothing on the mat needs to know that number —
 * the transform handles positions, the surface, rings and flags for free.
 *
 * **Sprites are the exception.** A Token's art must land on a whole multiple of
 * `ART_PX` *after* the transform, so `MatToken` has to know what the transform
 * is about to do to it (`boardScaleAt`, `TokenSprite`). Passing it down would
 * mean threading a prop through `MatBoard` and into every Token, hero and ghost;
 * a context keeps the plumbing to the two files that actually care.
 *
 * ⚠️ **The default is 1, deliberately** — the mat drawn 1:1, where the board's
 * scale is its natural 2×. Anything that renders `MatBoard` without a `Board`
 * around it (every renderer test does) therefore sees exactly the sizes it saw
 * before this slice, rather than a zero that would divide its way to nothing.
 */
const MatFitContext = React.createContext(1);

/** Wraps the mat; takes the fit as its `value`. */
export const MatFitProvider = MatFitContext.Provider;

/** The mat's current on-screen scale, or 1 if nothing is providing one. */
export const useMatFit = () => React.useContext(MatFitContext);

export default MatFitContext;

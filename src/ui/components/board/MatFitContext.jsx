
import React from 'react';

/**
 * The mat's live fit, for the things drawn on it.
 * `Board` measures the space it has been given and scales the whole mat into it with one CSS
 * transform. Almost nothing on the mat needs to know that number: the transform handles
 * positions, the surface, rings and flags for free.
 * **Sprites are the exception.** A Token's art must land on a whole multiple of `ART_PX` AFTER
 * the transform, so `MatToken` has to know what the transform is about to do to it
 * (`boardScaleAt`, `TokenSprite`). Passing it down would mean threading a prop through
 * `MatBoard` and into every Token, hero and ghost; a context keeps the plumbing to the two
 * files that actually care.
 * ⚠️ The default is 1, deliberately: the mat drawn 1:1, where the board's scale is its natural
 * 2×. Anything that renders `MatBoard` without a `Board` around it (every renderer test does)
 * therefore sees the natural sizes, rather than a zero that would divide its way to nothing.
 */
const MatFitContext = React.createContext(1);

/** Wraps the mat; takes the fit as its `value`. */
export const MatFitProvider = MatFitContext.Provider;

/** The mat's current on-screen scale, or 1 if nothing is providing one. */
export const useMatFit = () => React.useContext(MatFitContext);

export default MatFitContext;

/**
 * The mat's fit, for things drawn OUTSIDE the mat. The horizontal hero dock draws each hero at
 * the same art size as the mat does, but it sits under the Board, outside the provider above.
 * `Board` reports its live fit here; the dock reads it with `useLiveMatFit`. Until a Board has
 * reported, the fit is 1, the mat's natural size, as above.
 */
let liveFit = 1;
const fitListeners = new Set();

/** Board's report of its current fit. Ignores non-numbers and repeats. */
export function setLiveMatFit(fit) {
    if (!Number.isFinite(fit) || fit <= 0 || fit === liveFit) return;
    liveFit = fit;
    for (const fn of fitListeners) fn();
}

/** The last fit a Board reported (1 if none has). */
export const getLiveMatFit = () => liveFit;

const subscribeLiveFit = (fn) => {
    fitListeners.add(fn);
    return () => fitListeners.delete(fn);
};

/** The live mat fit, re-rendering when Board reports a new one. */
export const useLiveMatFit = () =>
    React.useSyncExternalStore(subscribeLiveFit, getLiveMatFit, getLiveMatFit);

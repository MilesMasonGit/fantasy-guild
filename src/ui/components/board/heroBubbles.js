// Fantasy Guild — what a hero has to say (Hero Speech Bubbles slice SB-A)

/**
 * The messages a hero currently has up, oldest first.
 *
 * ⚠️ SB-A stub: the hero with the lowest id says one fixed line, so the layer's
 * anchoring and stacking can be proved before any real message exists. SB-B
 * replaces this with the engine's blocked messages.
 */
export function bubblesFor(heroId, heroes) {
    const first = heroes.reduce((lo, h) => (lo === null || h.heroId < lo ? h.heroId : lo), null);
    return first === heroId ? [{ id: 'sb-a', text: 'I am a speech bubble.' }] : [];
}

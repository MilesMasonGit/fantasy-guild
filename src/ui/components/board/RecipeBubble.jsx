import { memo } from 'react';
import { SpeechFrame, speechTailDrop } from './SpeechFrame.jsx';
import { SPEECH_TONE } from './speechTone.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/** The output sprite's size in plate pixels: an item sprite at 1×, as the speech bubbles' unit draws it. */
const SPRITE_PX = 32;

/**
 * What a recipe's bubble shows: its main output's id (its anchored output, else its first), an
 * item or, for a building recipe, a Token; null with no output.
 */
export function bubbleOutputOf(recipe) {
    const outputs = recipe?.outputs || [];
    const main = outputs.find(o => o?.anchor) || outputs[0] || null;
    return main ? (main.itemId || main.tokenId || null) : null;
}

/**
 * RecipeBubble: over a Token with a recipe chosen, while the pointer rests on it, that recipe's
 * output sprite in a speech bubble (the hero speech bubble's frame and tail, `SpeechFrame`),
 * its tail on the art's top edge. Hover only, never at rest (docs/active/concept_playmat_declutter.md
 * §12.3). `top` is the art's top in the Token's box, `boxPx` the box's width, `u` one plate pixel.
 * Takes no pointer.
 */
export const RecipeBubble = memo(function RecipeBubble({ recipe, boxPx, top, u = 1 }) {
    const id = bubbleOutputOf(recipe);
    if (!id) return null;
    const src = resolveSpritePath(getItem(id) || getTokenType(id) || id);
    if (!src) return null;
    const size = SPRITE_PX * u;
    return (
        <div
            data-recipe-bubble={id}
            className="absolute z-30 flex justify-center pointer-events-none"
            style={{ left: 0, width: boxPx, top: top - speechTailDrop(u), transform: 'translateY(-100%)' }}
        >
            <SpeechFrame tone={SPEECH_TONE.PLAIN} u={u} tail className="pointer-events-none">
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="block"
                    style={{ width: size, height: size, imageRendering: 'pixelated' }}
                />
            </SpeechFrame>
        </div>
    );
});

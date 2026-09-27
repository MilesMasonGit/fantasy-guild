import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { trickleHoverLines } from '../drawer/lifecycleLines.js';
import { placeUnder } from './tooltipPlacement.js';

/** How often the tooltip re-reads the trickle clocks while shown (FB-52). */
export const TRICKLE_TOOLTIP_REFRESH_MS = 1000;

/** The live readers `trickleHoverLines` takes. */
const TRICKLE_SOURCES = {
    typeOf: getTokenType,
    itemName: (itemId) => getItem(itemId)?.name || itemId
};

/** A Token's trickle lines, read live from the mat. */
export function liveTrickleLines(instanceId) {
    return trickleHoverLines(BoardState.getTokenById(instanceId), TRICKLE_SOURCES);
}

/** The Token's art on the mat, which the tooltip hangs under. */
function artOf(instanceId) {
    if (typeof document === 'undefined') return null;
    return document.querySelector(`[data-token-art="true"][data-token-id="${instanceId}"]`);
}

/** Whether a Token type has any trickle lines at all (only those get the tooltip). */
export function hasTrickle(def) {
    return Array.isArray(def?.trickle) && def.trickle.length > 0;
}

/**
 * ⭐ **The Guild Hall's hover tooltip** (FB-52): the Token's name, then its
 * trickle income — one line per paying line with a **live** "next in"
 * countdown, re-read every second while shown.
 *
 * Styled and placed exactly like the flag's tooltip (`FlagTooltip`): a
 * portal to `document.body`, fixed under the Token's art, above the whole mat
 * (so above every Token), and `pointer-events: none`, so dragging the Hall,
 * clicking it and hover-collecting loot beside it all work as before. Hidden
 * while anything is being dragged, as the flag's is.
 *
 * The wording and maths are `trickleHoverLines`' (the inspection panel's
 * *Pays* rows); this only draws them.
 *
 * @param {{
 *   instanceId: string,
 *   readLines?: (instanceId: string) => string[],   // tests
 *   anchorOf?: (instanceId: string) => Element|null  // tests
 * }} props
 */
export const TrickleTooltip = ({ instanceId, readLines = liveTrickleLines, anchorOf = artOf }) => {
    const { isDragging: anyDrag } = useActiveDrag();
    const [, refresh] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => refresh(n => n + 1), TRICKLE_TOOLTIP_REFRESH_MS);
        return () => clearInterval(timer);
    }, []);
    if (anyDrag || typeof document === 'undefined') return null;

    const lines = readLines(instanceId);
    if (!lines.length) return null;
    const [heading, ...pays] = lines;
    const instance = BoardState.getTokenById(instanceId);
    const title = instance ? tokenName(instance.typeId) : null;

    return createPortal(
        <div
            role="tooltip"
            data-trickle-tooltip={instanceId}
            className="fixed z-[90] w-64 p-2 rounded-lg pointer-events-none bg-black/90 border border-gi-gold/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-[11px] leading-snug text-white"
            style={placeUnder(anchorOf(instanceId), 256, 48 + pays.length * 16)}
        >
            {title && <div className="font-bold text-gi-gold">{title}</div>}
            <div className="text-white/80">{heading}</div>
            <ul className="mt-1 pt-1 border-t border-white/10 flex flex-col gap-0.5 text-emerald-300">
                {pays.map((line, i) => <li key={i} data-trickle-line={i}>{line}</li>)}
            </ul>
        </div>,
        document.body
    );
};

export default TrickleTooltip;

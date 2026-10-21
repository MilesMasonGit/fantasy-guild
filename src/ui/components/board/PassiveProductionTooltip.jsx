import { useEffect, useState } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as PassiveProduction from '../../../systems/board/PassiveProduction.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { passiveHoverLines } from '../drawer/lifecycleLines.js';
import { FloatingTip } from '../base/Tooltip.jsx';

/** How often the tooltip re-reads the timer while shown. */
export const PASSIVE_TOOLTIP_REFRESH_MS = 1000;

/** The live readers `passiveHoverLines` takes. */
const PASSIVE_SOURCES = {
    passive: (instance) => ({ lines: PassiveProduction.linesOf(instance), nextInMs: PassiveProduction.nextInMs(instance) }),
    itemName: (itemId) => getItem(itemId)?.name || itemId
};

/** A Token's Passive Production lines, read live from the mat. */
export function livePassiveLines(instanceId) {
    return passiveHoverLines(BoardState.getTokenById(instanceId), PASSIVE_SOURCES);
}

/** The Token's art on the mat, which the tooltip hangs under. */
function artOf(instanceId) {
    if (typeof document === 'undefined') return null;
    return document.querySelector(`[data-token-art="true"][data-token-id="${instanceId}"]`);
}

/**
 * The Guild Hall's hover tooltip: the Token's name, then its Passive Production: a heading with the
 * shared timer's **live** "next in", re-read every second while shown, and one line per item a lap
 * pays. Styled and placed exactly like the flag's tooltip (`FlagTooltip`): a portal to
 * `document.body`, fixed under the Token's art, above the whole mat, and `pointer-events: none`, so
 * dragging the Hall, clicking it and hover-collecting loot beside it all work as before. Hidden
 * while anything is being dragged, as the flag's is.
 * The wording is `passiveHoverLines`'; this only draws it. As wide as its longest line, capped to
 * the window; measured after each draw so `placeUnder` keeps it on screen.
 * @param {{ instanceId: string, readLines?: (instanceId: string) => string[], anchorOf?:
 * (instanceId: string) => Element|null }} props  `readLines` and `anchorOf` are for tests
 */
export const PassiveProductionTooltip = ({ instanceId, readLines = livePassiveLines, anchorOf = artOf }) => {
    const { isDragging: anyDrag } = useActiveDrag();
    const [, refresh] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => refresh(n => n + 1), PASSIVE_TOOLTIP_REFRESH_MS);
        return () => clearInterval(timer);
    }, []);
    if (anyDrag) return null;

    const lines = readLines(instanceId);
    if (!lines.length) return null;
    const [heading, ...pays] = lines;
    const instance = BoardState.getTokenById(instanceId);
    const title = instance ? tokenName(instance.typeId) : null;

    return (
        <FloatingTip
            anchor={anchorOf(instanceId)}
            title={title}
            maxWidth="calc(100vw - 16px)"
            tipProps={{ 'data-passive-tooltip': instanceId }}
            content={(
                <div className="whitespace-nowrap">
                    <div className="text-white/80">{heading}</div>
                    <ul className="mt-1 pt-1 border-t border-white/10 flex flex-col gap-0.5 text-emerald-300">
                        {pays.map((line, i) => <li key={i} data-passive-line={i}>{line}</li>)}
                    </ul>
                </div>
            )}
        />
    );
};

export default PassiveProductionTooltip;

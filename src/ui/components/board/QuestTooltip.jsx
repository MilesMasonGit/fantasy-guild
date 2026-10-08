import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { placeUnder } from './tooltipPlacement.js';

/** The width it is placed with before it has been measured. */
const START_WIDTH = 240;

/** The Token's art on the mat, which the tooltip hangs under. */
function artOf(instanceId) {
    if (typeof document === 'undefined') return null;
    return document.querySelector(`[data-token-art="true"][data-token-id="${instanceId}"]`);
}

const itemName = (itemId) => getItem(itemId)?.name || itemId;

/**
 * What a quest still wants, as one line: a collection counts its item (`3/10 Copper Ingot`), a
 * hunt its enemy (`1/3 Goblin defeated`, since the title already says 'Defeat 3 Goblins'),
 * anything else just the count.
 */
export function questNeedLine(quest) {
    if (!quest) return '';
    const count = `${quest.currentCount || 0}/${quest.requiredCount || 1}`;
    if (quest.type === 'collection' && quest.itemId) return `${count} ${itemName(quest.itemId)}`;
    if (quest.type === 'hunt' && quest.enemyId) return `${count} ${tokenName(quest.enemyId)} defeated`;
    return count;
}

/**
 * A quest Token's hover tooltip: the title (with a *Tutorial* tag on a tutorial step), the
 * instruction, what is still needed, the reward as item icons with counts, and 'Click to
 * claim' once done.
 * Styled and placed like the Guild Hall's `PassiveProductionTooltip`: a portal to `document.body`, fixed
 * under the Token's art, `pointer-events: none` (so clicking and dragging the Token work
 * through it), hidden while anything is dragged. The quest comes in as a prop (`MatToken`'s
 * own projection), so the tooltip holds no subscription.
 * @param {{ instanceId: string, quest: object, anchorOf?: (instanceId: string) => Element|null
 * }} props  `anchorOf` is for tests
 */
export const QuestTooltip = ({ instanceId, quest, anchorOf = artOf }) => {
    const { isDragging: anyDrag } = useActiveDrag();
    const boxRef = useRef(null);
    const [width, setWidth] = useState(START_WIDTH);
    useLayoutEffect(() => {
        const measured = boxRef.current?.offsetWidth;
        if (measured > 0 && measured !== width) setWidth(measured);
    });
    if (anyDrag || !quest || typeof document === 'undefined') return null;

    const rewards = Array.isArray(quest.rewardItems) ? quest.rewardItems : [];

    return createPortal(
        <div
            ref={boxRef}
            role="tooltip"
            data-quest-tooltip={instanceId}
            className="fixed z-[90] w-max max-w-[min(280px,calc(100vw-16px))] p-2 rounded-lg pointer-events-none bg-black/90 border border-gi-gold/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-[11px] leading-snug text-white"
            style={placeUnder(anchorOf(instanceId), width, 110)}
        >
            <div className="flex items-center gap-1.5">
                <span data-quest-title className="font-bold text-gi-gold">{quest.title}</span>
                {quest.tutorial && (
                    <span data-quest-tutorial className="px-1 rounded bg-sky-900/70 border border-sky-400/40 text-[9px] font-bold uppercase text-sky-200">
                        Tutorial
                    </span>
                )}
            </div>
            {quest.instruction && (
                <p data-quest-instruction className="mt-0.5 text-white/80 whitespace-normal">{quest.instruction}</p>
            )}
            <div data-quest-need className={quest.done ? 'mt-1 text-emerald-300' : 'mt-1 text-white/90'}>
                {questNeedLine(quest)}
            </div>
            {rewards.length > 0 && (
                <div className="mt-1 pt-1 border-t border-white/10 flex items-center gap-2 flex-wrap">
                    <span className="text-white/60">Reward</span>
                    {rewards.map(r => (
                        <span
                            key={r.itemId}
                            data-quest-reward={r.itemId}
                            title={itemName(r.itemId)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 border border-black/40 shadow-inner font-bold tabular-nums"
                        >
                            <ItemIcon item={r.itemId} size={16} />
                            <span>{Number(r.quantity).toLocaleString()}</span>
                        </span>
                    ))}
                </div>
            )}
            {quest.done && (
                <div data-quest-claim className="mt-1 font-bold text-gi-gold">Click to claim</div>
            )}
        </div>,
        document.body
    );
};

export default QuestTooltip;

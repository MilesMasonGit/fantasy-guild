import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { FloatingTip } from '../base/Tooltip.jsx';
import { TUTORIAL_TEXT } from '../../../systems/quests/tutorialText.js';
import { firstMapsReward } from '../../../systems/quests/tutorialQuests.js';

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
 * What a quest pays, as shown: its items, and for the tutorial step that pays them the first maps
 * as they stand in the registry now (the claim reads them again).
 */
export function questRewardsShown(quest) {
    const rewards = Array.isArray(quest?.rewardItems) ? [...quest.rewardItems] : [];
    if (quest?.tutorial && quest.firstMaps) rewards.push(...firstMapsReward());
    return rewards;
}

/**
 * A quest Token's hover tooltip: the title (with a *Tutorial* tag on a tutorial step), the
 * cartographer's line on a tutorial step, the instruction, what is still needed, the reward as
 * item icons with counts, and 'Click to claim' once done. Every tutorial word is in
 * `tutorialText.js`.
 * The shared tooltip (`FloatingTip`): `pointer-events: none` (so clicking and dragging the Token
 * work through it), hidden while anything is dragged. The quest comes in as a prop (`MatToken`'s
 * own projection), so the tooltip holds no subscription.
 * @param {{ instanceId: string, quest: object, anchorOf?: (instanceId: string) => Element|null
 * }} props  `anchorOf` is for tests
 */
export const QuestTooltip = ({ instanceId, quest, anchorOf = artOf }) => {
    const { isDragging: anyDrag } = useActiveDrag();
    if (anyDrag || !quest) return null;

    const rewards = questRewardsShown(quest);

    return (
        <FloatingTip anchor={anchorOf(instanceId)} tipProps={{ 'data-quest-tooltip': instanceId }} content={<>
            <div className="flex items-center gap-1.5">
                <span data-quest-title className="font-bold text-gi-gold">{quest.title}</span>
                {quest.tutorial && (
                    <span data-quest-tutorial className="px-1 rounded bg-sky-900/70 border border-sky-400/40 text-[9px] font-bold uppercase text-sky-200">
                        {TUTORIAL_TEXT.tag}
                    </span>
                )}
            </div>
            {quest.tutorial && quest.says && (
                <p data-quest-says className="mt-1 italic text-amber-100/90 whitespace-normal">
                    &ldquo;{quest.says}&rdquo;
                    <span className="not-italic text-white/50"> &mdash; {TUTORIAL_TEXT.speaker}</span>
                </p>
            )}
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
        </>} />
    );
};

export default QuestTooltip;

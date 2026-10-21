import { describe, ROLE } from '../../../systems/atlas/Budget.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { SCREEN_TEXT } from './atlasScreenText.js';

/**
 * What the plan's Region will hold, biggest count first (the budget's order on a tie): nodes,
 * camps and treasures alike.
 *
 * @param {object|null} summary  `plan.summary`
 * @returns {{typeId: string, role: string, count: number}[]}
 */
export function contentsOf(summary) {
    return (summary?.entries || [])
        .map((e, i) => ({ e, i }))
        .sort((a, b) => b.e.count - a.e.count || a.i - b.i)
        .map(({ e }) => ({ typeId: e.typeId, role: e.role, count: e.count }));
}

/** A row of the listing's 32 px sprites with its gap, and how many rows show before it scrolls. */
const ROW_GAP_PX = 4;
const ROW_PX = 32 + ROW_GAP_PX;
const ROWS_SHOWN = 2;

const ROLE_WORD = Object.freeze({ [ROLE.CAMP]: SCREEN_TEXT.ROLE_CAMP, [ROLE.TREASURE]: SCREEN_TEXT.ROLE_TREASURE });

/**
 * The Region the slotted maps write, as Token sprites with counts (the listing size), the total
 * above them; hover names each. A reroll keeps the very same contents.
 */
export const PlanContents = ({ summary }) => {
    if (!summary) return null;
    const { headline } = describe(summary);
    return (
        <div data-plan-contents className="w-full min-h-0 flex flex-col">
            <div data-plan-headline className="font-pixel ui-text-small text-white/60">{headline}</div>
            <ArrowScrollList step={2 * ROW_PX} compact className="min-h-0" listProps={{ style: { maxHeight: ROWS_SHOWN * ROW_PX } }}>
                <ul className="flex flex-wrap gap-x-2" style={{ rowGap: ROW_GAP_PX }}>
                    {contentsOf(summary).map(({ typeId, role, count }) => (
                        <Tooltip key={`${role}|${typeId}`} title={tokenName(typeId) || typeId} lines={[ROLE_WORD[role]]}>
                            <li data-plan-token={typeId} data-count={count} className="flex items-center gap-0.5">
                                <TokenSprite typeId={typeId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />
                                <span className="font-pixel ui-text-small tabular-nums text-white/85">×{count}</span>
                            </li>
                        </Tooltip>
                    ))}
                </ul>
            </ArrowScrollList>
        </div>
    );
};

export default PlanContents;

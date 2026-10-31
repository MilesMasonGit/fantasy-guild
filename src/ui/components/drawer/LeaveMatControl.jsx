import { useSyncExternalStore } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as Demolition from '../../../systems/board/Demolition.js';
import * as Landmarks from '../../../systems/board/Landmarks.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

const ACTION_CLS = 'w-full px-3 py-2 border-2 text-xs font-bold transition-colors cursor-pointer';

/**
 * How a board Token leaves the mat at once. A bounty: Dismiss (no reward; a tutorial step never
 * leaves this way). While the dev layout tool is on, a placed Token (a landmark included) can be
 * removed. Disallowing and demolishing are the top bar's map modes, not the card's.
 */
export const LeaveMatControl = ({ instanceId }) => {
    const layoutEditing = useSyncExternalStore(Landmarks.onLayoutEditingChange, Landmarks.isLayoutEditing);
    const view = useGameState(
        () => {
            const instance = BoardState.getTokenById(instanceId);
            if (!instance) return null;
            if (QuestTokens.isQuestToken(instance)) return { id: instance.id, bounty: QuestTokens.canDismiss(instance) };
            const devRemove = layoutEditing && Demolition.canDemolish(instance)
                && BoardState.originOf(instance) === BoardState.ORIGIN.PLACED;
            return devRemove ? { id: instance.id, devRemove } : null;
        },
        [BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [instanceId, layoutEditing] }
    );
    if (!view) return null;

    if ('bounty' in view) {
        if (!view.bounty) return null;
        return (
            <button
                type="button"
                data-dismiss-bounty={view.id}
                title="Take this bounty off the mat. No reward; a new one comes in its place."
                onClick={() => QuestTokens.dismissBounty(view.id)}
                className={cn(ACTION_CLS, 'bg-[#181412] border-white/10 text-gi-muted hover:text-gi-text hover:border-gi-gold/40')}
            >
                Dismiss bounty
            </button>
        );
    }

    return (
        <button
            type="button"
            data-dev-remove={view.id}
            onClick={() => Placement.removePlacedToken(view.id)}
            className={cn(ACTION_CLS, 'bg-[#181412] border-sky-400/40 text-sky-200 hover:border-sky-300')}
        >
            Remove now (layout tool)
        </button>
    );
};

export default LeaveMatControl;

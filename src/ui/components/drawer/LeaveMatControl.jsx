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
import { t } from '../../../i18n/index.js';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';

const ACTION_CLS = 'w-full px-3 py-2 border-2 text-xs font-bold transition-colors cursor-pointer';

/**
 * How a board Token leaves the mat. Demolish (or Cancel demolition on a marked one) is one Token's
 * mark, the map's Demolish mode being the way to clear many; a Token `Demolition.canMark` refuses
 * shows its reason instead of a button. A bounty: Dismiss (no reward). While the dev layout tool
 * is on, a placed Token (a landmark included) can be removed at once.
 */
export const LeaveMatControl = ({ instanceId }) => {
    const layoutEditing = useSyncExternalStore(Landmarks.onLayoutEditingChange, Landmarks.isLayoutEditing);
    const view = useGameState(
        () => {
            const instance = BoardState.getTokenById(instanceId);
            if (!instance) return null;
            const check = Demolition.canMark(instance);
            return {
                id: instance.id,
                bounty: QuestTokens.isQuestToken(instance) ? QuestTokens.canDismiss(instance) : null,
                marked: Demolition.isMarked(instance),
                refusal: check.success ? null : check.reason,
                devRemove: layoutEditing && Demolition.canDemolish(instance)
                    && BoardState.originOf(instance) === BoardState.ORIGIN.PLACED
            };
        },
        [BOARD_EVENTS.TILE_CHANGED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [instanceId, layoutEditing] }
    );
    if (!view) return null;

    return (
        <>
            {view.refusal ? (
                <p data-demolish-refusal={view.id} className="text-xs text-gi-muted">{view.refusal}</p>
            ) : (
                <KitButton
                    data-demolish={view.marked ? 'cancel' : 'mark'}
                    tone={view.marked ? KIT_BUTTON_TONE.PLAIN : KIT_BUTTON_TONE.DANGER}
                    className="w-full"
                    onClick={() => (view.marked ? Demolition.unmark(view.id) : Demolition.mark(view.id))}
                >
                    {t(view.marked ? 'demolish.cancel' : 'demolish.mark')}
                </KitButton>
            )}
            {view.bounty && (
                <button
                    type="button"
                    data-dismiss-bounty={view.id}
                    title="Take this bounty off the mat. No reward; a new one comes in its place."
                    onClick={() => QuestTokens.dismissBounty(view.id)}
                    className={cn(ACTION_CLS, 'bg-[#181412] border-white/10 text-gi-muted hover:text-gi-text hover:border-gi-gold/40')}
                >
                    Dismiss bounty
                </button>
            )}
            {view.devRemove && (
                <button
                    type="button"
                    data-dev-remove={view.id}
                    onClick={() => Placement.removePlacedToken(view.id)}
                    className={cn(ACTION_CLS, 'bg-[#181412] border-sky-400/40 text-sky-200 hover:border-sky-300')}
                >
                    Remove now (layout tool)
                </button>
            )}
        </>
    );
};

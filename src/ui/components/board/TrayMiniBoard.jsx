import { cn } from '../../utils/cn.js';
import { BOARD_SIZE, TILE_COUNT, isPlaceable as checkPlaceable } from './boardConstants.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { DropTarget } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';

const announce = (result) => {
    if (result && result.success === false && result.reason && result.reason !== 'Already there') {
        NotificationSystem.warning(result.reason);
    }
    return result;
};

const MiniBoardCell = ({ index, isOccupied }) => {
    const isCenter = index === 24;
    const isPlaceable = checkPlaceable(index);

    const handleDrop = (payload) => {
        if (!isPlaceable || isOccupied || isCenter) {
            NotificationSystem.warning('Cannot place here');
            return;
        }

        if (payload.from?.tile != null) {
            const res = announce(Placement.moveToken(payload.from.tile, index));
            if (res?.success) EventBus.publish('state_changed', {});
            return;
        }
        if (payload.from?.spriteId != null) {
            const instance = SpriteLayer.takeTokenSprite(payload.from.spriteId);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) {
                SpriteLayer.addSprite('token', instance.typeId, 1, index, instance.usesRemaining);
            } else {
                EventBus.publish('state_changed', {});
            }
            return;
        }
        if (payload.from?.traySlot != null) {
            const instance = BoardState.takeFromTray(payload.from.traySlot);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) {
                BoardState.addToTray(instance);
            } else {
                EventBus.publish('state_changed', {});
            }
            return;
        }
        if (payload.from?.vaultTypeId != null) {
            const instance = TokenBank.withdraw(payload.from.vaultTypeId);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) {
                TokenBank.deposit(instance);
            } else {
                EventBus.publish('state_changed', {});
                EventBus.publish('vault_withdrawn', { typeId: payload.from.vaultTypeId });
                EventBus.publish('token_bank_updated', { typeId: payload.from.vaultTypeId });
            }
        }
    };

    return (
        <DropTarget
            id={`miniboard-tile-${index}`}
            surface={DND_SURFACE.MINIBOARD}
            accepts={(p) => isPlaceable && !isOccupied && !isCenter && p.kind === DRAG_KIND.TOKEN}
            onDrop={handleDrop}
            className={cn(
                "w-full h-full aspect-square rounded-[3px] transition-all duration-100",
                isCenter && "bg-purple-600/80 border-2 border-amber-300 shadow-[0_0_8px_rgba(217,119,6,0.6)]",
                !isCenter && isOccupied && "bg-cyan-400/85 border-2 border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
                !isCenter && !isOccupied && isPlaceable && "bg-black/50 border border-white/40 hover:border-white/80",
                !isPlaceable && "bg-black/90 border border-neutral-700/50 opacity-40"
            )}
            acceptClassName="!bg-emerald-400 !shadow-[0_0_20px_rgba(52,211,153,1)] !border-2 !border-emerald-100 !scale-110 z-30"
            rejectClassName="!bg-rose-500 !shadow-[0_0_20px_rgba(244,63,94,1)] !border-2 !border-rose-100 !scale-105 z-30"
        />
    );
};

export const TrayMiniBoard = ({ className }) => {
    const tiles = useGameState(
        state => {
            const map = state.board?.tiles || {};
            const out = {};
            for (const key of Object.keys(map)) {
                if (map[key]) out[key] = true;
            }
            return out;
        },
        [BOARD_EVENTS.TILE_CHANGED, 'state_changed'],
        null
    );

    return (
        <div 
            data-dnd-region={DND_SURFACE.MINIBOARD}
            className={cn("pointer-events-auto w-full flex items-center justify-center px-1", className)}
        >
            <div 
                data-dnd-region={DND_SURFACE.MINIBOARD}
                className="grid w-full max-w-[280px] md:max-w-[320px] aspect-square gap-1.5 p-2.5 bg-black/90 rounded-xl border-2 border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur-md"
                style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
            >
                {Array.from({ length: TILE_COUNT }, (_, i) => (
                    <MiniBoardCell 
                        key={i} 
                        index={i} 
                        isOccupied={!!tiles[i]} 
                    />
                ))}
            </div>
        </div>
    );
};

export default TrayMiniBoard;

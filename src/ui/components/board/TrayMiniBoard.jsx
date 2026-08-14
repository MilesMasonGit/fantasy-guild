import React from 'react';
import { cn } from '../../utils/cn.js';
import { BOARD_SIZE, TILE_COUNT } from './boardConstants.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { DropTarget, ACCEPT_CLS, REJECT_CLS } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';

const announce = (result) => {
    if (result && result.success === false && result.reason) {
        NotificationSystem.warning(result.reason);
    }
    return result;
};

const MiniBoardCell = ({ index, isOccupied, isHeroAssigned }) => {
    const handleDrop = (payload) => {
        if (payload.from?.tile != null) {
            announce(Placement.moveToken(payload.from.tile, index));
            return;
        }
        if (payload.from?.spriteId != null) {
            const instance = SpriteLayer.takeTokenSprite(payload.from.spriteId);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) {
                SpriteLayer.addSprite('token', instance.typeId, 1, index, instance.usesRemaining);
            }
            return;
        }
        if (payload.from?.traySlot != null) {
            const instance = BoardState.takeFromTray(payload.from.traySlot);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) BoardState.addToTray(instance);
            return;
        }
        if (payload.from?.vaultTypeId != null) {
            // The item hasn't actually been removed from Vault if we intercept it here.
            // Wait, normally dropping from Vault into Tray uses `TokenBank.withdraw`.
            // But Vault bubble triggers `onDrop` which calls `withdrawToTray`.
            // Since Vault drawer renders draggable items, payload just has `vaultTypeId`.
            // Wait! The Vault drawer's items pass `{ kind: TOKEN, payload: { from: { vaultTypeId: typeId } } }`!
            // But we can't cleanly withdraw without TokenBank dependency.
            const instance = TokenBank.withdraw(payload.from.vaultTypeId);
            if (!instance) return;
            const result = announce(Placement.placeToken(index, instance));
            if (!result.success) TokenBank.deposit(instance);
        }
    };

    return (
        <DropTarget
            id={`miniboard-tile-${index}`}
            surface={DND_SURFACE.BOARD}
            accepts={(p) => p.kind === DRAG_KIND.TOKEN}
            onDrop={handleDrop}
            className={cn(
                "w-full h-full",
                isOccupied && !isHeroAssigned && "bg-gi-primary/60 shadow-[inset_0_0_8px_rgba(0,0,0,0.5)] border border-gi-primary/20",
                isHeroAssigned && "bg-gi-gold/60 shadow-[inset_0_0_8px_rgba(0,0,0,0.5)] border border-gi-gold/20",
                !isOccupied && !isHeroAssigned && "bg-black/40 border border-gi-border/20"
            )}
            acceptClassName={ACCEPT_CLS}
            rejectClassName={REJECT_CLS}
        />
    );
};

export const TrayMiniBoard = () => {
    const tiles = useGameState(
        state => {
            const map = state.board?.tiles || {};
            const standing = state.board?.heroTiles || {};
            const out = {};
            
            for (const key of Object.keys(map)) {
                if (map[key]) out[key] = { occupied: true, heroAssigned: false };
            }
            for (const heroId of Object.keys(standing)) {
                const key = String(standing[heroId]);
                out[key] = out[key] || { occupied: false };
                out[key].heroAssigned = true;
            }
            return out;
        },
        [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.HERO_MOVED, 'heroes_updated', 'state_changed'],
        null
    );

    return (
        <div className="flex flex-col flex-1 items-center justify-center p-4 bg-gi-base">

            <div 
                className="grid w-full aspect-square gap-[1px]"
                style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
            >
                {Array.from({ length: TILE_COUNT }, (_, i) => {
                    const t = tiles[i];
                    return (
                        <MiniBoardCell 
                            key={i} 
                            index={i} 
                            isOccupied={t?.occupied} 
                            isHeroAssigned={t?.heroAssigned} 
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default TrayMiniBoard;

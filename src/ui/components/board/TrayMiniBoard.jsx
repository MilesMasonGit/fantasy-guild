import { cn } from '../../utils/cn.js';
import { BOARD_SIZE, TILE_COUNT, GUILD_HALL_TILE, isPlaceable as checkPlaceable } from '../../../config/boardGeometry.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { DropTarget } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { placeTokenFromDrag } from './placeTokenFromDrag.js';

/**
 * The mini-board is the playmat in miniature, drawn on the Tray so a Token can
 * still be placed while a drawer covers the real board.
 *
 * ⚠️ It is a *substitute* for the board, so it must behave like the board. It
 * used to carry its own partial copy of the drop handler and its own idea of
 * which tiles were full, and both had drifted (CR2-160). Placement now goes
 * through the same `placeTokenFromDrag` the playmat uses, and occupancy is asked
 * of the engine rather than guessed from the state shape.
 */

const MiniBoardCell = ({ index, isOccupied }) => {
    const isCenter = index === GUILD_HALL_TILE;
    const isPlaceable = checkPlaceable(index);

    const handleDrop = (payload) => {
        if (!isPlaceable || isOccupied || isCenter) {
            NotificationSystem.warning('Cannot place here');
            return;
        }
        // Deliberately no `dropInfo`: the pointer is over the Tray, not over the
        // playmat, so pixel-snapping a Map or a 2×2 Token against it would land
        // it somewhere the player never pointed.
        placeTokenFromDrag(index, payload);
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

/**
 * Which tiles are full, asked of the engine.
 *
 * ⚠️ `state.board.tiles` is keyed by **anchor only** — a 2×2 Token appears in it
 * once, and the three cells its body covers are not keys at all. Reading the keys
 * directly, as this used to, made those three cells render as free and offer
 * themselves as drop targets; `Placement` then refused the drop and the player
 * got a warning from a cell that had looked available. `BoardState.hasToken`
 * resolves footprints, so it answers for covered cells too.
 */
export function occupiedTileMap() {
    const out = {};
    for (let i = 0; i < TILE_COUNT; i++) {
        if (BoardState.hasToken(i)) out[i] = true;
    }
    return out;
}

export const TrayMiniBoard = ({ className }) => {
    const tiles = useGameState(
        occupiedTileMap,
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
                        isOccupied={!!tiles?.[i]}
                    />
                ))}
            </div>
        </div>
    );
};

export default TrayMiniBoard;

import { useMemo } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { DRAG_KIND } from './dragConstants.js';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor, PixelArt, boardArtSteps } from '../components/base/TokenSprite.jsx';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { GameState } from '../../state/GameState.js';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { flagColourOf } from '../../systems/board/FlagColours.js';

/**
 * DragGhost: the floating representation of whatever is being dragged.
 * `bold` is true while the cursor is over the board, false over a drawer.
 * Bloom is retired for Tokens and Heroes: carried Tokens and Heroes never change size or show
 * card frames. They are 128px from pick-up to release, and being held is expressed by the
 * shadow instead, the hard pixel shadow of `PixelArt`'s lifted state. `bold` is therefore
 * ignored by `TokenGhost` and `HeroGhost`.
 * `ItemGhost` always draws a single 64px icon, lifted like the others.
 */

function liveBoardFit() {
    if (typeof document === 'undefined') return 1;
    const el = document.querySelector('[data-board-scale]');
    return el ? parseFloat(el.getAttribute('data-board-scale')) || 1 : 1;
}

export const DragGhost = ({ payload, bold }) => {
    const { over } = useDndContext();
    const isOverPlaymat = bold && over && over.data?.current?.surface === 'board';

    const isGuildHall = payload?.kind === DRAG_KIND.TOKEN && (
        payload.typeId === 'token_guild_hall' ||
        payload.cannotLeaveBoard ||
        payload.isGuildHall ||
        getTokenType(payload.typeId)?.cannotLeaveBoard ||
        getTokenType(payload.typeId)?.isGuildHall
    );

    const isGuildHallOffBoard = isGuildHall && !isOverPlaymat;
    const opacityStyle = isGuildHallOffBoard ? { opacity: 0.5 } : {};

    if (!payload) return null;
    switch (payload.kind) {
        case DRAG_KIND.TOKEN:
            return (
                <div style={opacityStyle} className="relative transition-opacity duration-150">
                    <TokenGhost payload={payload} bold={bold} />
                    {isGuildHallOffBoard && (
                        <div className="absolute top-1.5 left-[2px] z-50 pointer-events-none w-8 h-8 flex items-center justify-center">
                            <img
                                src="/assets/ui/ui_disallow_red.png"
                                alt="Disallow"
                                className="w-8 h-8 object-contain select-none animate-bounce drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    imageRendering: 'pixelated',
                                    animationDuration: '2s'
                                }}
                            />
                        </div>
                    )}
                </div>
            );
        case DRAG_KIND.HERO: return <div style={opacityStyle} className="transition-opacity duration-150"><HeroGhost payload={payload} bold={bold} /></div>;
        case DRAG_KIND.ITEM: return <div style={opacityStyle} className="transition-opacity duration-150"><ItemGhost payload={payload} bold={bold} /></div>;
        case DRAG_KIND.FLAG: return <FlagGhost payload={payload} bold={bold} />;
        default: return null;
    }
};

/**
 * A flag in flight: the hero's own flag sprite at 128 px, lifted, with no hero drawn. A flag
 * drag moves only the flag, and so does dragging a hero on the board.
 */
export const FlagGhost = ({ payload }) => {
    const artScale = boardArtSteps(liveBoardFit());
    const size = 64 * artScale;
    return (
        <div data-flag-ghost={payload?.heroId || ''} className="flex items-center justify-center" style={{ width: size, height: size }}>
            <FlagMark colour={flagColourOf(payload?.heroId)} size={size} lifted />
        </div>
    );
};

/**
 * A Token in flight: one size, no frame, all the way.
 * It is drawn at exactly the size it will be once placed, so what you are carrying is already
 * the size of the hole it is going into.
 * `lifted` is what says 'this is in your hand': a hard black silhouette 2 art pixels
 * down-right (the only Tokens with a shadow at all) and a few pixels of upward offset, like a
 * real object picked up off a table. A 'slight' scale-up is impossible: from a 64px source
 * there is nothing between 128 and 192, and anything between them lands off the pixel grid.
 */
const TokenGhost = ({ payload }) => {
    const artScale = boardArtSteps(liveBoardFit());
    const size = tokenSizeFor(TOKEN_SURFACE.CARRY, payload.typeId, artScale);
    return (
        // ⚠️ The explicit box is load-bearing, not tidiness. dnd-kit sizes its DragOverlay to
        // the node the drag STARTED from (a 128px tile, a drawer slot), so without a box of
        // its own the ghost inherits whatever that was and the carried Token changes size
        // depending on where it was picked up. Which is bloom, reintroduced by accident.
        <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <TokenSprite typeId={payload.typeId} surface={TOKEN_SURFACE.CARRY} scale={artScale} lifted />
        </div>
    );
};

/**
 * A Hero in flight: one size (128px), no card frame, sprite-only (same style as Tokens).
 */
const HeroGhost = ({ payload }) => {
    const artScale = boardArtSteps(liveBoardFit());
    const size = tokenSizeFor(TOKEN_SURFACE.CARRY, 1, artScale);
    const hero = payload.heroId ? (GameState.heroes || []).find(h => h.id === payload.heroId) : null;
    const spriteRef = payload.spriteId || payload.heroSprite || payload.classId || hero?.spriteId || hero?.icon || hero?.heroSprite || hero?.classId || payload;
    const src = resolveSpritePath(spriteRef);
    return (
        <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <PixelArt
                src={src}
                alt={payload.name || hero?.name || 'Hero'}
                size={size}
                lifted
            />
        </div>
    );
};

const ItemGhost = ({ payload }) => {
    const item = useMemo(() => getItem(payload.itemId), [payload.itemId]);
    const multi = payload.selection?.length > 1 ? payload.selection.length : null;
    const badge = multi && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-gi-primary text-black text-[11px] font-bold flex items-center justify-center border border-black/40">
            ×{multi}
        </span>
    );
    const src = item ? resolveSpritePath(item) : null;
    return (
        <div className="relative flex items-center justify-center w-[64px] h-[64px]" data-item-ghost={payload.itemId}>
            {src
                ? <PixelArt src={src} alt={item.name || payload.itemId} size={64} lifted />
                : <ItemIcon item={item || payload.itemId} size={64} />}
            {badge}
        </div>
    );
};

export default DragGhost;

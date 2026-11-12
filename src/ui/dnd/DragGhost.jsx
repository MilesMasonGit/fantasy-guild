import { useMemo } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as Placement from '../../systems/board/Placement.js';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { DRAG_KIND } from './dragConstants.js';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor, PixelArt, boardArtSteps } from '../components/base/TokenSprite.jsx';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { FlagMark } from '../components/board/FlagMark.jsx';
import { flagColourOf } from '../../systems/board/FlagColours.js';
import { MARKER_ART_PX, MARKER_FOOT } from '../components/board/flagGeometry.js';

/**
 * DragGhost: the floating representation of whatever is being dragged.
 * `bold` is true while the cursor is over the board, false over a drawer; only the Guild Hall's
 * ghost reads it.
 * Bloom is retired for Tokens: a carried Token never changes size or shows a card frame. It is
 * 128px from pick-up to release, and being held is expressed by the shadow instead, the hard
 * pixel shadow of `PixelArt`'s lifted state.
 * `ItemGhost` always draws a single 64px icon, lifted like the others.
 */

function liveBoardFit() {
    if (typeof document === 'undefined') return 1;
    const el = document.querySelector('[data-board-scale]');
    return el ? parseFloat(el.getAttribute('data-board-scale')) || 1 : 1;
}

const isGuildHallPayload = (payload) => payload?.kind === DRAG_KIND.TOKEN && Placement.isPermanentToken(payload.typeId);

const NOT_DIMMED = {};
const DIMMED = { opacity: 0.5 };

export const DragGhost = ({ payload, bold }) => {
    if (!payload) return null;
    switch (payload.kind) {
        case DRAG_KIND.TOKEN:
            return isGuildHallPayload(payload)
                ? <GuildHallGhost payload={payload} bold={bold} />
                : <CarriedToken payload={payload} offBoard={false} />;
        case DRAG_KIND.ITEM: return <div style={NOT_DIMMED} className="transition-opacity duration-150"><ItemGhost payload={payload} /></div>;
        case DRAG_KIND.FLAG: return <FlagGhost payload={payload} />;
        default: return null;
    }
};

/**
 * A Guild Hall in the hand dims, with a refusal mark, while it is not over the mat.
 * ⚠️ The only ghost that reads dnd-kit's `over`: dnd-kit hands out a fresh context on every one
 * of its renders, every pointer move included, and each reader is redrawn with it.
 */
const GuildHallGhost = ({ payload, bold }) => {
    const { over } = useDndContext();
    const isOverPlaymat = bold && over && over.data?.current?.surface === 'board';
    return <CarriedToken payload={payload} offBoard={!isOverPlaymat} />;
};

const CarriedToken = ({ payload, offBoard }) => (
    <div style={offBoard ? DIMMED : NOT_DIMMED} className="relative transition-opacity duration-150">
        <TokenGhost payload={payload} />
        {offBoard && (
            <div className="absolute top-1.5 left-[2px] z-50 pointer-events-none w-8 h-8 flex items-center justify-center">
                <img
                    src="/assets/ui/u_disallow_red.png"
                    alt="Disallow"
                    className="w-8 h-8 object-contain select-none drop-shadow-[2px_2px_0_#000]"
                    style={{
                        width: '32px',
                        height: '32px',
                        imageRendering: 'pixelated'
                    }}
                />
            </div>
        )}
    </div>
);

/**
 * A flag in flight: the job flag at the mat's size (24 px at its usual fit), with no hero drawn.
 * A flag drag moves only the flag, and so does dragging a hero, on the board or off it.
 * ⚠️ The ghost's box is centred on the pointer (`pickupFlight.js`), and the drop lands on the
 * pointer: the flag is shifted inside its box so its pole foot is the box's middle, where it
 * will stand. Over a Token the hero can work, `OrderDragLine` moves the box (`data-order-ghost`)
 * onto the Token's centre, straight on the element, every frame. The hero's drag hint marks stand
 * over the Token itself (`OrderDragLine`), not on the flag.
 */
export const FlagGhost = ({ payload }) => {
    const size = MARKER_ART_PX * boardArtSteps(liveBoardFit());
    const shift = { x: (0.5 - MARKER_FOOT.x) * size, y: (0.5 - MARKER_FOOT.y) * size };
    return (
        <div data-flag-ghost={payload?.heroId || ''} data-order-ghost={payload?.heroId || ''} className="relative" style={{ width: size, height: size }}>
            <FlagMark size={size} colour={flagColourOf(payload?.heroId)} style={{ position: 'absolute', left: shift.x, top: shift.y }} />
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
 * A selected Token's preview at the pointer is this ghost too (`SelectedTokenHints`).
 */
export const TokenGhost = ({ payload }) => {
    const artScale = boardArtSteps(liveBoardFit());
    const size = tokenSizeFor(TOKEN_SURFACE.CARRY, payload.typeId, artScale);
    return (
        // ⚠️ The explicit box is load-bearing, not tidiness. dnd-kit sizes its DragOverlay to
        // the node the drag STARTED from (a 128px tile, a drawer slot), so without a box of
        // its own the ghost inherits whatever that was and the carried Token changes size
        // depending on where it was picked up. Which is bloom, reintroduced by accident.
        <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            {/* An unbuilt Foundation floats in the hand as on the mat, its bob in the ghost's own art pixels. */}
            <TokenSprite
                typeId={payload.typeId}
                surface={TOKEN_SURFACE.CARRY}
                scale={artScale}
                lifted
                hovering={!!getTokenType(payload.typeId)?.foundation}
                bobUnit={artScale}
            />
        </div>
    );
};

const ItemGhost = ({ payload }) => {
    const item = useMemo(() => getItem(payload.itemId), [payload.itemId]);
    const multi = payload.selection?.length > 1 ? payload.selection.length : null;
    const badge = multi && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-gi-primary text-black ui-text-title font-bold flex items-center justify-center border-2 border-black">
            ×{multi}
        </span>
    );
    // A carried map says its own picture: a dev map is a recipe with no item to read it from.
    const src = payload.sprite || (item ? resolveSpritePath(item) : null);
    return (
        <div className="relative flex items-center justify-center w-[64px] h-[64px]" data-item-ghost={payload.itemId}>
            {src
                ? <PixelArt src={src} alt={item?.name || payload.itemId} size={64} lifted />
                : <ItemIcon item={item || payload.itemId} size={64} />}
            {badge}
        </div>
    );
};

import React, { useMemo } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { getBannerCardWidth } from '../dev/cardSizeStore.js';
import { DRAG_KIND } from './dragConstants.js';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor, PixelArt } from '../components/base/TokenSprite.jsx';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import { GameState } from '../../state/GameState.js';

/**
 * DragGhost — the floating representation of whatever is being dragged.
 *
 * `bold` is true while the cursor is over the board, false over a drawer.
 *
 * ## Bloom is retired for Tokens & Heroes
 * Carried Tokens and Heroes no longer change size at all or show card frames.
 * They are 128px from pick-up to release, and being held is expressed by the
 * shadow instead — see `TokenSprite` / `PixelArt`'s lifted state.
 * `bold` is therefore ignored by `TokenGhost` and `HeroGhost`.
 *
 * ⚠️ **Items still bloom, and still use the retired banner tiers.**
 */

/** Current banner card tier ('md' | 'sm'), read live from the layout marker. */
function boardTier() {
    if (typeof document === 'undefined') return 'md';
    return document.querySelector('[data-card-tier]')?.getAttribute('data-card-tier') || 'md';
}

/** Banner card dimensions for the current tier — matches AreaBannerRow cards. */
function bannerCardSize() {
    const tier = boardTier();
    return tier === 'sm'
        ? { size: 'sm', width: 100, height: 128, sprite: 64 }
        : { size: 'md', width: getBannerCardWidth(), height: 256, sprite: 128 };
}

export const DragGhost = ({ payload, bold }) => {
    const { over } = useDndContext();
    const isOverMiniBoard = over && String(over.id).startsWith('miniboard-tile-');
    const isOverPlaymat = bold && over && (String(over.id).startsWith('tile-') || over.data?.current?.surface === 'board');

    const isGuildHall = payload?.kind === DRAG_KIND.TOKEN && (
        payload.typeId === 'token_guild_hall' ||
        payload.cannotLeaveBoard ||
        payload.isGuildHall ||
        getTokenType(payload.typeId)?.cannotLeaveBoard ||
        getTokenType(payload.typeId)?.isGuildHall
    );

    const isGuildHallOffBoard = isGuildHall && !isOverPlaymat;
    const opacityStyle = (isOverMiniBoard || isGuildHallOffBoard) ? { opacity: 0.5 } : {};

    if (!payload) return null;
    switch (payload.kind) {
        case DRAG_KIND.TOKEN:
            return (
                <div style={opacityStyle} className="relative transition-opacity duration-150">
                    <TokenGhost payload={payload} />
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
        case DRAG_KIND.HERO: return <div style={opacityStyle} className="transition-opacity duration-150"><HeroGhost payload={payload} /></div>;
        case DRAG_KIND.ITEM: return <div style={opacityStyle} className="transition-opacity duration-150"><ItemGhost payload={payload} bold={bold} /></div>;
        default: return null;
    }
};

/**
 * A Token in flight — one size, no frame, all the way (D-219, D-220).
 *
 * It is drawn at exactly the size it will be once placed, so what you are
 * carrying is already the size of the hole it is going into. That used to be
 * true only over the board; now it is true over the Tray as well, which is what
 * lets the size stay constant.
 *
 * `lifted` is what says "this is in your hand": a larger, softer, further shadow
 * and a few pixels of upward offset — a real object picked up off a table.
 * A "slight" scale-up was considered and is impossible: from a 64px source there
 * is nothing between 128 and 192, and anything between them lands off the pixel
 * grid (D-220).
 */
const TokenGhost = ({ payload }) => {
    const size = tokenSizeFor(TOKEN_SURFACE.CARRY, payload.typeId);
    return (
        // ⚠️ The explicit box is load-bearing, not tidiness. dnd-kit sizes its
        // DragOverlay to the node the drag STARTED from — a 74px Tray slot, a
        // 128px tile — so without a box of its own the ghost inherits whatever
        // that was and the carried Token changes size depending on where it was
        // picked up. Which is bloom, reintroduced by accident (D-220).
        <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <TokenSprite typeId={payload.typeId} surface={TOKEN_SURFACE.CARRY} lifted />
        </div>
    );
};

/**
 * A Hero in flight — one size (128px), no card frame, sprite-only (same style as Tokens).
 */
const HeroGhost = ({ payload }) => {
    const size = tokenSizeFor(TOKEN_SURFACE.CARRY);
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

/**
 * Card-frame shell used by the bold item ghost, sized to the banner tier.
 *
 * Restored verbatim from before `345abfe`, which reworked Token and Hero ghosts
 * to be frameless (D-219/D-220) and deleted this helper — but left `ItemGhost`
 * still calling it, so every bold item drag threw. Items deliberately still
 * bloom into a card, as the file header says, so the frame is still wanted.
 */
const GhostCardFrame = ({ title, children }) => {
    const { width, height } = bannerCardSize();
    return (
        <div
            style={{ width, height }}
            className="rounded-xl border border-white/40 bg-black/70 flex flex-col overflow-hidden"
        >
            {title && (
                <div className="bg-black/40 border-b border-white/10 px-2 py-1.5 text-center">
                    <span className="gi-card-title font-bold tracking-widest uppercase text-white text-[11px] truncate block">{title}</span>
                </div>
            )}
            <div className="flex-1 flex items-center justify-center min-h-0" style={{ imageRendering: 'pixelated' }}>
                {children}
            </div>
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
    return (
        <div className="relative flex items-center justify-center w-[64px] h-[64px]">
            <ItemIcon item={item || payload.itemId} size={64} />
            {badge}
        </div>
    );
};

export default DragGhost;

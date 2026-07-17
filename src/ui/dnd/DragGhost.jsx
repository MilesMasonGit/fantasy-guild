import React, { useMemo } from 'react';
import { cn } from '../utils/cn.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import CardFactory from '../../systems/cards/logic/CardFactory.js';
import ActiveCardFace from '../components/ActiveCardFace.jsx';
import { ItemIcon } from '../components/base/ItemIcon.jsx';
import { getBannerCardWidth } from '../dev/cardSizeStore.js';
import { DRAG_KIND } from './dragConstants.js';

/**
 * DragGhost — the floating representation of whatever is being dragged. Its
 * job is the "bloom on cross-over" (owner design 2026-07-15), which differs by
 * kind:
 *
 *   • Cards keep the same card face, but resize between the drawer tile (100px)
 *     and the banner card (the live card tier) so a dropped card is exactly the
 *     size of the cards already on the board.
 *   • Heroes and items show a bare 64px sprite over a drawer, and gain a card
 *     frame (sized to the banner tier) over the board.
 *
 * `bold` is true while the cursor is over the board, false over a drawer.
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
    if (!payload) return null;
    switch (payload.kind) {
        case DRAG_KIND.CARD: return <CardGhost payload={payload} bold={bold} />;
        case DRAG_KIND.HERO: return <HeroGhost payload={payload} bold={bold} />;
        case DRAG_KIND.ITEM: return <ItemGhost payload={payload} bold={bold} />;
        default: return null;
    }
};

const CardGhost = ({ payload, bold }) => {
    const template = useMemo(() => getCard(payload.templateId), [payload.templateId]);
    const mock = useMemo(() => {
        const inst = CardFactory.createInstance(payload.templateId, {});
        if (inst) { inst.id = `ghost-${payload.templateId}`; inst.status = 'idle'; }
        return inst;
    }, [payload.templateId]);
    if (!template || !mock) return null;
    // Drawer tile is always the sm/100 tier; board matches the live banner tier.
    const banner = bannerCardSize();
    const size = bold ? banner.size : 'sm';
    const width = bold ? banner.width : 100;
    return (
        <div style={{ width }}>
            <ActiveCardFace cardId={mock.id} cardState={mock} template={template} showActions={false} size={size} width={width} />
        </div>
    );
};

/** Card-frame shell used by the bold hero/item ghosts, sized to the banner tier. */
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

const HeroGhost = ({ payload, bold }) => {
    const icon = { sprite: payload.spriteId, classId: payload.classId };
    if (!bold) {
        return <ItemIcon item={icon} size={64} style={{ imageRendering: 'pixelated' }} />;
    }
    return (
        <GhostCardFrame title={payload.name}>
            <ItemIcon item={icon} size={bannerCardSize().sprite} />
        </GhostCardFrame>
    );
};

const ItemGhost = ({ payload, bold }) => {
    const item = useMemo(() => getItem(payload.itemId), [payload.itemId]);
    const multi = payload.selection?.length > 1 ? payload.selection.length : null;
    const badge = multi && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-gi-primary text-black text-[11px] font-bold flex items-center justify-center border border-black/40">
            ×{multi}
        </span>
    );
    if (!bold) {
        return (
            <div className="relative flex items-center justify-center w-[64px] h-[64px]">
                <ItemIcon item={item || payload.itemId} size={64} />
                {badge}
            </div>
        );
    }
    return (
        <div className="relative">
            <GhostCardFrame title={item?.name}>
                <ItemIcon item={item || payload.itemId} size={bannerCardSize().sprite} />
            </GhostCardFrame>
            {badge}
        </div>
    );
};

export default DragGhost;

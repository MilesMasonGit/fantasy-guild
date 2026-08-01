import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { useCardTier, BANNER_FOOTER_H, BANNER_BADGE_ROW_H } from './BannerLayout.jsx';
import { BannerHeader } from './bannerHeader.jsx';
import { StationFocusRow } from './bannerFocus.jsx';
import { StationInfoCard, STATION_STATUS_LABELS } from './bannerPanels.jsx';
import { HeroSlotCell, StationSlotCell, StationCenter } from './bannerCenters.jsx';
import { ChevronDown, ChevronUp, User, Hammer } from 'lucide-react';

/**
 * OutpostBannerRow — an Outpost as its own banner (D-16).
 *
 * Outposts used to be the "stationed" face of an area banner. Now they are
 * ordinary rows sitting anywhere in the playmat order the player likes
 * (D-58), holding exactly ONE card whose effect is guild-wide.
 *
 * The row deliberately reuses the area banner's pillars — same mat, same card
 * frame, same hero slot — because to the player it IS the same kind of thing.
 * What differs is the center: Inputs + Recipe instead of a deck loop.
 *
 * Layout:  [Control][Info][Hero] [Inputs][Recipe] [Station]
 */

const STRUCTURAL_EVENTS = [
    AREA_EVENTS.STATUS_CHANGED,
    AREA_EVENTS.STATION_CHANGED,
    AREA_EVENTS.CRAFT_COMPLETED,
    AREA_EVENTS.HERO_CHANGED,
    'outposts_updated',
    'state_changed'
];

/**
 * Structural snapshot of one Outpost. The field NAMES deliberately match the
 * area snapshot's station fields (`stationCardId`, `stationStatus`, …) so the
 * shared station cells work on either banner without a translation layer.
 */
function useOutpostSnapshot(outpostId) {
    return useGameState(
        state => {
            const o = (state.outposts || []).find(x => x.id === outpostId);
            if (!o) return null;
            return {
                onPlaymat: o.onPlaymat !== false,
                assignedHeroId: o.assignedHeroId,
                status: o.status || 'idle',
                stationCardId: o.activeStationCardId || null,
                stationStatus: o.status || 'idle',
                selectedRecipeId: o.selectedRecipeId || null,
                producedCount: o.producedCount || 0,
                productionMode: o.productionMode || 'infinite',
                productionLimit: o.productionLimit || 0
            };
        },
        STRUCTURAL_EVENTS,
        data => !data?.areaId || data.areaId === outpostId,
        { deps: [outpostId] }
    );
}

/** Display name — Outposts are numbered, and named by their installed card. */
export const outpostName = (outpostId, stationCardId) => {
    const n = outpostId.replace('outpost_', '');
    const card = stationCardId ? getCard(stationCardId) : null;
    return card ? card.name : `Outpost ${n}`;
};

export const OutpostBannerRow = ({ outpostId, focus, onFocus, onCollapse }) => {
    const engine = useEngine();
    const snap = useOutpostSnapshot(outpostId);
    const { height: cardH, width: cardW } = useCardTier();

    if (!snap) return null;

    const isFocused = focus?.areaId === outpostId;
    const isDimmed = focus && !isFocused;

    // Recipe focus is the only focus view an Outpost has — no deck, and its
    // hero equips through the same Hero focus the areas use.
    if (isFocused) {
        if (focus.mode === 'recipe') return <StationFocusRow areaId={outpostId} onClose={() => onFocus(null)} />;
        return null;
    }

    return (
        <div className={cn(
            'relative rounded-xl border border-gi-gold/30 overflow-hidden transition-opacity duration-300',
            isDimmed && 'opacity-30 pointer-events-none'
        )}>
            {/* No area art to stand on — an Outpost is guild property, so it
                gets a flat workshop backdrop rather than a region's scenery. */}
            <div className="absolute inset-0 bg-gradient-to-br from-gi-surface/90 to-black/80" />

            <div className="relative z-10 flex flex-col">
                <BannerHeader areaName={outpostName(outpostId, snap.stationCardId)} />
                <div className="flex items-end gap-4 px-3" style={{ height: cardH + BANNER_BADGE_ROW_H }}>
                    <OutpostControlPanel snap={snap} onCollapse={onCollapse} />
                    <StationInfoCard areaId={outpostId} snap={snap} engine={engine} />
                    <HeroSlotCell
                        areaId={outpostId} snap={snap} engine={engine} outpost
                        onOpenEquip={() => snap.assignedHeroId && onFocus({ areaId: outpostId, mode: 'equip' })}
                    />
                    <div className="flex items-stretch min-w-0">
                        <StationCenter areaId={outpostId} snap={snap} engine={engine} onFocus={onFocus} />
                    </div>
                    <StationSlotCell areaId={outpostId} snap={snap} engine={engine} />
                </div>

                <div
                    className="flex items-center gap-4 px-3 text-[10px] uppercase font-bold tracking-wider text-white"
                    style={{ height: BANNER_FOOTER_H }}
                >
                    <div className="w-14 shrink-0" />
                    <div style={{ width: cardW }} className="text-center">Info</div>
                    <div style={{ width: cardW }} className="text-center">Hero</div>
                    <div style={{ width: cardW }} className="text-center">Inputs</div>
                    <div style={{ width: cardW }} className="text-center">Output</div>
                    <div style={{ width: cardW }} className="text-center">Station</div>
                </div>
            </div>
        </div>
    );
};

/**
 * The Outpost's control pillar. Deliberately thinner than the area's: there is
 * no start/stop, because crafting runs whenever it has a hero, a recipe and
 * materials. Taking the banner off the playmat is the "stop" (D-59), and that
 * lives in the Area Manager.
 */
const OutpostControlPanel = ({ snap, onCollapse }) => {
    const statusInfo = STATION_STATUS_LABELS[snap.status] || STATION_STATUS_LABELS.idle;
    return (
        <div className="w-14 shrink-0 self-stretch flex flex-col items-center justify-center gap-2 bg-black/35 border-r border-white/5">
            <Hammer size={16} className={statusInfo.color} />
            <button
                onClick={onCollapse}
                title="Collapse this banner"
                className="p-1.5 rounded border border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-primary transition-colors"
            >
                <ChevronUp size={14} />
            </button>
        </div>
    );
};

export const CollapsedOutpostRow = ({ outpostId, onExpand }) => {
    const snap = useOutpostSnapshot(outpostId);
    if (!snap) return null;
    const statusInfo = STATION_STATUS_LABELS[snap.status] || STATION_STATUS_LABELS.idle;
    return (
        <button
            onClick={onExpand}
            className="w-full flex items-center gap-3 rounded-lg border border-gi-gold/30 bg-gi-surface/70 px-3 py-1.5 hover:border-gi-gold/60 transition-colors"
        >
            <ChevronDown size={12} className="text-gi-muted" />
            <span className="text-[11px] font-bold text-gi-text uppercase tracking-wider">
                {outpostName(outpostId, snap.stationCardId)}
            </span>
            <span className={cn('text-[9px] font-bold uppercase tracking-widest', statusInfo.color)}>
                {statusInfo.label}
            </span>
            {snap.assignedHeroId && <User size={11} className="text-gi-muted ml-auto" />}
        </button>
    );
};

export default OutpostBannerRow;

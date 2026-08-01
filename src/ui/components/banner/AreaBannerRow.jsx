import React, { useMemo, useState } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { useCardTier, BANNER_FOOTER_H, BANNER_BADGE_ROW_H } from './BannerLayout.jsx';
import { AreaMat } from './AreaMat.jsx';
import { ChevronDown, User } from 'lucide-react';

import { STATUS_LABELS } from './bannerCards.jsx';
import { BannerHeader } from './bannerHeader.jsx';
import { DeckFocusRow, HeroFocusRow } from './bannerFocus.jsx';
import { ControlPanel, InfoPanel, HeroInfoPanel } from './bannerPanels.jsx';
import { HeroSlotCell, AdventureCenter } from './bannerCenters.jsx';



/**
 * AreaBannerRow — one unlocked Area as a horizontal banner (concept §11).
 *
 * Layout (static pillars + flexible center, §11.A/B):
 *   [Control][Info][Hero] [Active][Next/Enemy][Deck]
 *
 * One face only: Outposts became their own banners (D-16), so the old
 * adventure↔stationed mode toggle and its 80/20 split are gone.
 *
 * Reactivity (§2F): every subscription filters on this row's areaId; other
 * areas' events are ignored entirely. Progress animation is ref-driven
 * (§6D). Collapsed rows unmount all of this (§6E) — the parent renders
 * CollapsedRow instead.
 */

const STRUCTURAL_EVENTS = [
    AREA_EVENTS.STATUS_CHANGED,
    AREA_EVENTS.CARD_COMPLETED,
    AREA_EVENTS.DECK_UPDATED,
    AREA_EVENTS.HERO_CHANGED,
    AREA_EVENTS.STATION_CHANGED,
    AREA_EVENTS.COMBAT_RESOLVED,
    AREA_EVENTS.CRAFT_COMPLETED
];

/** Structural snapshot of one area — primitive-ish so isEqual bails cheaply. */
function useAreaSnapshot(areaId) {
    return useGameState(
        state => {
            const a = state.areaStates?.[areaId];
            if (!a) return null;
            return {
                status: a.status,
                pausedReason: a.pausedReason || null,
                activeCardIndex: a.activeCardIndex,
                assignedHeroId: a.assignedHeroId,
                deckSig: (a.deckSlots || []).map(s => s.templateId || (s.hazard ? `hazard:${s.hazard.type}` : '_')).join(',')
                // No station fields: crafting lives on Outpost banners now
                // (D-16), which carry their own snapshot in OutpostBannerRow.
            };
        },
        STRUCTURAL_EVENTS,
        data => !data?.areaId || data.areaId === areaId,
        { bypassClone: false }
    );
}

export const AreaBannerRow = ({ areaId, focus, onFocus, onCollapse }) => {
    const engine = useEngine();
    const snap = useAreaSnapshot(areaId);
    const areaSet = useMemo(() => getAreaSet(areaId), [areaId]);
    const { height: cardH, width: cardW } = useCardTier();

    if (!snap) return null;

    const isFocused = focus?.areaId === areaId;
    const isDimmed = focus && !isFocused;

    // Focus views replace the whole row body (§11.D — inline morphing). All three
    // compose from the shared FocusScaffold (mat + header + card slots).
    if (isFocused) {
        if (focus.mode === 'deck') return <DeckFocusRow areaId={areaId} onClose={() => onFocus(null)} />;
        if (focus.mode === 'equip') return <HeroFocusRow areaId={areaId} heroId={snap.assignedHeroId} onClose={() => onFocus(null)} />;
        return null;
    }

    return (
        <div className={cn(
            'relative rounded-xl border border-gi-border overflow-hidden transition-opacity duration-300',
            isDimmed && 'opacity-30 pointer-events-none'
        )}>
            {/* Full-width Area Banner "mat" — the static full-bleed art the row
                of cards sits on. */}
            <AreaMat areaId={areaId} />

            {/* Floating UI layer — header band + card row, laid on the mat */}
            <div className="relative z-10 flex flex-col">
                <BannerHeader areaName={areaSet?.name || areaId} areaId={areaId} snap={snap} engine={engine} />
                <div className="flex items-end gap-4 px-3" style={{ height: cardH + BANNER_BADGE_ROW_H }}>
                <ControlPanel areaId={areaId} snap={snap} engine={engine} onCollapse={onCollapse} />
                {snap.assignedHeroId ? (
                    <HeroInfoPanel areaId={areaId} snap={snap} engine={engine} />
                ) : (
                    <InfoPanel areaId={areaId} snap={snap} engine={engine} areaName={areaSet?.name || areaId} />
                )}
                <HeroSlotCell
                    areaId={areaId} snap={snap} engine={engine}
                    onOpenEquip={() => snap.assignedHeroId && onFocus({ areaId, mode: 'equip' })}
                />

                {/* Center: the deck loop. Content-width (no flex-1) so the cards
                       pack tight instead of being pushed to a far-right edge. */}
                <div className="flex items-stretch min-w-0">
                    <AdventureCenter areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                </div>
                </div>

                {/* Footer band — card labels aligned underneath each card slot */}
                <div
                    className="flex items-center gap-4 px-3 text-[10px] uppercase font-bold tracking-wider text-white"
                    style={{ height: BANNER_FOOTER_H }}
                >
                    <div className="w-14 shrink-0" />
                    <div style={{ width: cardW }} className="text-center">Info</div>
                    <div style={{ width: cardW }} className="text-center">Hero</div>
                    <div style={{ width: cardW }} className="text-center">Active</div>
                    <div style={{ width: cardW }} className="text-center">
                        {snap.status === 'in_combat' ? 'Enemy' : 'Next'}
                    </div>
                    <div style={{ width: cardW }} className="text-center">Deck</div>
                </div>
            </div>
        </div>
    );
};


export const CollapsedRow = ({ areaId, onExpand }) => {
    const snap = useAreaSnapshot(areaId);
    const areaSet = getAreaSet(areaId);
    if (!snap) return null;
    const statusInfo = STATUS_LABELS[snap.status] || STATUS_LABELS.paused;
    return (
        <button
            onClick={onExpand}
            className="w-full flex items-center gap-3 rounded-lg border border-gi-border bg-gi-surface/70 px-3 py-1.5 hover:border-gi-primary/50 transition-colors"
        >
            <ChevronDown size={12} className="text-gi-muted" />
            <span className="text-[11px] font-bold text-gi-text uppercase tracking-wider">{areaSet?.name || areaId}</span>
            <span className={cn('text-[9px] font-bold uppercase tracking-widest', statusInfo.color)}>{statusInfo.label}</span>
            {snap.assignedHeroId && <User size={11} className="text-gi-muted ml-auto" />}
        </button>
    );
};

export default AreaBannerRow;

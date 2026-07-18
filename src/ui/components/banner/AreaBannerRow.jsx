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
import { DeckFocusRow, HeroFocusRow, StationFocusRow } from './bannerFocus.jsx';
import { ControlPanel, InfoPanel, HeroInfoPanel, StationInfoCard } from './bannerPanels.jsx';
import { HeroSlotCell, StationSlotCell, AdventureCenter, StationCenter } from './bannerCenters.jsx';



/**
 * AreaBannerRow — one unlocked Area as a horizontal banner (concept §11).
 *
 * Layout (static pillars + flexible center, §11.A/B):
 *   [Control][Info][Hero] [ ... mode-dependent center ... ] [Station]
 *
 * The center is the 80/20 split banner (§11.C): the active mode's slice
 * holds the working UI, the inactive slice is a thin art strip that toggles
 * the mode when clicked.
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
    AREA_EVENTS.MODE_SWITCHED,
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
                mode: a.mode,
                status: a.status,
                pausedReason: a.pausedReason || null,
                activeCardIndex: a.activeCardIndex,
                assignedHeroId: a.assignedHeroId,
                deckSig: (a.deckSlots || []).map(s => s.templateId || (s.hazard ? `hazard:${s.hazard.type}` : '_')).join(','),
                stationCardId: a.stationState?.activeStationCardId || null,
                stationStatus: a.stationState?.status || 'idle',
                drinkId: a.stationState?.drinkItemId || null,
                selectedRecipeId: a.stationState?.selectedRecipeId || null,
                producedCount: a.stationState?.producedCount || 0,
                productionMode: a.stationState?.productionMode || 'infinite',
                productionLimit: a.stationState?.productionLimit || 0
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
        if (focus.mode === 'recipe') return <StationFocusRow areaId={areaId} onClose={() => onFocus(null)} />;
        return null;
    }

    const wilds = snap.mode === 'adventure';

    return (
        <div className={cn(
            'relative rounded-xl border border-gi-border overflow-hidden transition-opacity duration-300',
            isDimmed && 'opacity-30 pointer-events-none'
        )}>
            {/* Full-width Area Banner "mat" — the static full-bleed art the row of
                cards sits on. Wilds art is the base; the Outpost art covers it when
                stationed (see AreaMat — sharp, full colour, no sliding split). */}
            <AreaMat areaId={areaId} stationed={!wilds} />

            {/* Floating UI layer — header band + card row, laid on the mat */}
            <div className="relative z-10 flex flex-col">
                <BannerHeader areaName={areaSet?.name || areaId} areaId={areaId} snap={snap} engine={engine} />
                <div className="flex items-end gap-4 px-3" style={{ height: cardH + BANNER_BADGE_ROW_H }}>
                <ControlPanel areaId={areaId} snap={snap} engine={engine} onCollapse={onCollapse} />
                {snap.mode === 'stationed' ? (
                    <StationInfoCard areaId={areaId} snap={snap} engine={engine} />
                ) : snap.assignedHeroId ? (
                    <HeroInfoPanel areaId={areaId} snap={snap} engine={engine} />
                ) : (
                    <InfoPanel areaId={areaId} snap={snap} engine={engine} areaName={areaSet?.name || areaId} />
                )}
                <HeroSlotCell
                    areaId={areaId} snap={snap} engine={engine}
                    onOpenEquip={() => snap.assignedHeroId && onFocus({ areaId, mode: 'equip' })}
                />

                {/* Center: the active mode's UI. Content-width (no flex-1) so the
                       cards pack tight and the Station card sits right after the
                       Deck instead of being pushed to a far-right edge (owner
                       design 2026-07-16). Mode switch via the header toggle. */}
                <div className="flex items-stretch min-w-0">
                    {wilds ? (
                        <AdventureCenter areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                    ) : (
                        <StationCenter areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                    )}
                </div>

                <StationSlotCell areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                </div>

                {/* Footer band — card labels aligned underneath each card slot */}
                <div
                    className="flex items-center gap-4 px-3 text-[10px] uppercase font-bold tracking-wider text-white"
                    style={{ height: BANNER_FOOTER_H }}
                >
                    <div className="w-14 shrink-0" />
                    <div style={{ width: cardW }} className="text-center">Info</div>
                    <div style={{ width: cardW }} className="text-center">Hero</div>
                    {wilds ? (
                        <>
                            <div style={{ width: cardW }} className="text-center">Active</div>
                            <div style={{ width: cardW }} className="text-center">
                                {snap.status === 'in_combat' ? 'Enemy' : 'Next'}
                            </div>
                            <div style={{ width: cardW }} className="text-center">Deck</div>
                        </>
                    ) : (
                        <>
                            <div style={{ width: cardW }} className="text-center">Drink</div>
                            <div style={{ width: cardW }} className="text-center">Inputs</div>
                            <div style={{ width: cardW }} className="text-center">Output</div>
                        </>
                    )}
                    <div style={{ width: cardW }} className="text-center">Station</div>
                </div>
            </div>
        </div>
    );
};


export const CollapsedRow = ({ areaId, onExpand }) => {
    const snap = useAreaSnapshot(areaId);
    const areaSet = getAreaSet(areaId);
    if (!snap) return null;
    const statusInfo = snap.mode === 'stationed'
        ? { label: snap.stationStatus === 'crafting' ? 'Crafting' : 'Outpost', color: 'text-gi-gold' }
        : (STATUS_LABELS[snap.status] || STATUS_LABELS.paused);
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

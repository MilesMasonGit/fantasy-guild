import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { useCardTier, BANNER_FOOTER_H, BANNER_BADGE_ROW_H, LAYOUT_SPRING } from './BannerLayout.jsx';
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
 * (§6D). Collapsed rows unmount all of this (§6E) — `collapsed` swaps this
 * row's own body for the compact strip instead, sharing a `layoutId` with
 * the normal/focused bodies so collapsing/expanding glides too (motion
 * pass 2026-08-01) rather than the container hard-swapping components.
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

/** Red flash token + an imperative shake, fired once per AREA_EVENTS.COMBAT_RESOLVED
 *  defeat for this area (motion pass 2026-08-01). The shake is imperative
 *  (`useAnimate`'s `animate()`, not the declarative `animate` prop) on purpose —
 *  a state-driven target would replay on every unrelated re-render once "a
 *  defeat happened" turned true, instead of firing exactly once per event. */
function useDefeatImpact(areaId) {
    const [flashId, setFlashId] = useState(null);
    const [scope, animate] = useAnimate();

    useEffect(() => {
        return EventBus.subscribe(AREA_EVENTS.COMBAT_RESOLVED, e => {
            if (e.areaId !== areaId || e.outcome !== 'defeat') return;
            setFlashId(Math.random().toString(36).slice(2));
            animate(scope.current, { x: [0, -8, 8, -6, 6, -3, 3, 0] }, { duration: 0.45, ease: 'easeInOut' });
        });
    }, [areaId, animate, scope]);

    return { flashId, scope };
}

export const AreaBannerRow = ({ areaId, focus, onFocus, collapsed, onCollapse }) => {
    const engine = useEngine();
    const snap = useAreaSnapshot(areaId);
    const areaSet = useMemo(() => getAreaSet(areaId), [areaId]);
    const { height: cardH, width: cardW } = useCardTier();
    const { flashId: defeatFlashId, scope: shakeScope } = useDefeatImpact(areaId);

    if (!snap) return null;

    const isFocused = focus?.areaId === areaId;
    const isDimmed = focus && !isFocused;
    const statusInfo = STATUS_LABELS[snap.status] || STATUS_LABELS.paused;

    // Collapsed strip, focus views, and the normal row are three mutually
    // exclusive bodies for the same banner, all sharing one AnimatePresence
    // (motion pass 2026-08-01) so switching between any pair overlaps briefly
    // — required for the shared layoutId glides (this row's own outer box,
    // and the Deck anchor card inside it) to have an outgoing rect to
    // measure. `initial={false}` skips the enter animation on first mount,
    // so every area doesn't fade in on page load.
    return (
        <AnimatePresence initial={false}>
            {collapsed ? (
                <motion.button
                    key="collapsed"
                    layoutId={`banner-${areaId}`}
                    layout
                    transition={LAYOUT_SPRING}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    onClick={onCollapse}
                    className="w-full flex items-center gap-3 rounded-lg border border-gi-border bg-gi-surface/70 px-3 py-1.5 hover:border-gi-primary/50 transition-colors"
                >
                    <ChevronDown size={12} className="text-gi-muted" />
                    <span className="text-[11px] font-bold text-gi-text uppercase tracking-wider">{areaSet?.name || areaId}</span>
                    <span className={cn('text-[9px] font-bold uppercase tracking-widest', statusInfo.color)}>{statusInfo.label}</span>
                    {snap.assignedHeroId && <User size={11} className="text-gi-muted ml-auto" />}
                </motion.button>
            ) : isFocused ? (
                focus.mode === 'deck' ? (
                    <DeckFocusRow key="deck" areaId={areaId} onClose={() => onFocus(null)} />
                ) : focus.mode === 'equip' ? (
                    <HeroFocusRow key="equip" areaId={areaId} heroId={snap.assignedHeroId} onClose={() => onFocus(null)} />
                ) : null
            ) : (
                <motion.div
                    key="normal"
                    layoutId={`banner-${areaId}`}
                    layout
                    transition={LAYOUT_SPRING}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: isDimmed ? 0.3 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={cn(
                        'relative rounded-xl border border-gi-border overflow-hidden',
                        isDimmed && 'pointer-events-none'
                    )}
                >
                    {/* Full-width Area Banner "mat" — the static full-bleed art the row
                        of cards sits on. */}
                    <AreaMat areaId={areaId} />

                    {/* Red pulse on a defeat (motion pass 2026-08-01) — a fresh key
                        per event replays the flash every time, harmlessly idle between. */}
                    <AnimatePresence>
                        {defeatFlashId && (
                            <motion.div
                                key={defeatFlashId}
                                className="absolute inset-0 z-30 rounded-xl pointer-events-none"
                                style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.55), transparent 70%)' }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0.9, 0] }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Floating UI layer — header band + card row, laid on the mat.
                        `ref={shakeScope}` is the imperative shake's target (kept off
                        the outer motion.div so it doesn't fight that element's own
                        layoutId/layout transform tracking). */}
                    <div ref={shakeScope} className="relative z-10 flex flex-col">
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
                </motion.div>
            )}
        </AnimatePresence>
    );
};


export default AreaBannerRow;

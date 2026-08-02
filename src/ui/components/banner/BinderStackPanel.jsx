import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useCardTier } from './BannerLayout.jsx';
import { RowTemplateCard } from './bannerCards.jsx';
import { CardPips } from '../card-modules/CardPips.jsx';
import { BinderCard } from './AreaBinder.jsx';
import { SKILLS } from '../../../config/registries/skillRegistry.js';

// Tunable visual constants — how much of a covered card peeks out, and how
// much room the inspection slot reserves on the right. Exact values are a
// polish detail, not a design decision.
const CASCADE_OFFSET = 30;
const COLUMN_GAP = 12;
const INSPECT_W = 220;
const PANEL_GAP = 20;
const PANEL_PAD = 14;
// Staggered "deal" entrance (motion pass 2026-08-01): each card fades/slides
// in a beat after the last, in dealing order (one to each stack in turn, i.e.
// round-robin — matching how they were dealt into columns), so the panel's
// height growth reads as cards being dealt out rather than a block popping
// in. Capped so a big collection doesn't take forever to finish dealing.
const STAGGER_STEP = 0.015;
const STAGGER_MAX = 0.4;

// Skill-registry order (Combat → Gathering → Processing → Special) is the
// grouping key (owner call 2026-08-01: "Fishing all together, Occult all
// together" — a fixed, meaningful order beats a random deal). Cards with no
// skill (boosts, universals, stations, ...) fall into one group at the end.
const SKILL_ORDER = Object.keys(SKILLS);
const NO_SKILL_RANK = SKILL_ORDER.length;
const skillRank = (skillId) => {
    const i = SKILL_ORDER.indexOf(skillId);
    return i === -1 ? NO_SKILL_RANK : i;
};

/**
 * BinderStackPanel — the expanded-area card pool for Deck/Station binder
 * focus views (binder-expansion pass, owner design 2026-08-01). `entries`
 * (same shape `useAreaBinderEntries` produces — only owned cards are shown,
 * per owner call 2026-08-01) sort by skill, then deal into solitaire-style
 * cascading stacks: every card's title stays visible, only the last card of
 * each stack shows its full face, and every card is directly draggable off
 * its stacked position regardless of whether it's covered. A card with every
 * owned copy already deployed renders in grayscale — still yours, nothing
 * spare to drag. Clicking a card loads it into a small inspection slot on
 * the right — the card exactly as it would look in a slot, nothing more (a
 * broader Card UI pass will put more info on the face itself).
 *
 * No height cap: the panel — and so the banner around it — grows to fit
 * however many cards are owned (owner decision).
 */
export const BinderStackPanel = ({ areaId, entries }) => {
    const { width: cardW, height: cardH, bannerWidth } = useCardTier();
    const [selectedId, setSelectedId] = useState(null);

    const owned = useMemo(() => entries.filter(e => e.owned > 0), [entries]);

    const sorted = useMemo(() => {
        return [...owned].sort((a, b) => {
            const r = skillRank(a.template?.skill) - skillRank(b.template?.skill);
            if (r !== 0) return r;
            return (a.template?.name || a.templateId).localeCompare(b.template?.name || b.templateId);
        });
    }, [owned]);

    const columnCount = useMemo(() => {
        const available = bannerWidth - INSPECT_W - PANEL_GAP - PANEL_PAD * 2;
        return Math.max(1, Math.floor((available + COLUMN_GAP) / (cardW + COLUMN_GAP)));
    }, [bannerWidth, cardW]);

    const columns = useMemo(() => {
        const cols = Array.from({ length: columnCount }, () => []);
        sorted.forEach((entry, i) => cols[i % columnCount].push(entry));
        return cols;
    }, [sorted, columnCount]);

    if (owned.length === 0) {
        return (
            <div className="px-4 py-6 text-[11px] text-gi-muted italic border-t border-white/5">
                No cards collected here yet — buy a pack to start this collection.
            </div>
        );
    }

    const selected = selectedId ? owned.find(e => e.templateId === selectedId) : null;

    return (
        <div className="flex items-start border-t border-white/5" style={{ gap: PANEL_GAP, padding: PANEL_PAD }}>
            {/* Card pool — solitaire-style cascading stacks, dealt round-robin
                across as many columns as the banner's fixed width allows. */}
            <div className="flex-1 min-w-0 flex flex-wrap items-start" style={{ gap: COLUMN_GAP }}>
                {columns.map((col, ci) => (
                    <div
                        key={ci}
                        className="relative shrink-0"
                        style={{ width: cardW, height: cardH + Math.max(0, col.length - 1) * CASCADE_OFFSET }}
                    >
                        {col.map((entry, i) => {
                            const dealIndex = i * columnCount + ci;
                            return (
                                <motion.div
                                    key={entry.templateId}
                                    className="absolute left-0"
                                    style={{ top: i * CASCADE_OFFSET, zIndex: i + 1 }}
                                    initial={{ opacity: 0, y: -12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 32, delay: Math.min(dealIndex * STAGGER_STEP, STAGGER_MAX) }}
                                >
                                    <BinderCard
                                        areaId={areaId}
                                        templateId={entry.templateId}
                                        owned={entry.owned}
                                        deployed={entry.deployed}
                                        selected={selectedId === entry.templateId}
                                        onClick={() => setSelectedId(entry.templateId)}
                                    />
                                </motion.div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Inspection slot — the selected card as it'd look in a slot. */}
            <div className="shrink-0 flex flex-col items-center gap-1.5" style={{ width: INSPECT_W }}>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gi-muted">Inspect</span>
                {selected ? (
                    <>
                        <RowTemplateCard templateId={selected.templateId} areaId={areaId} />
                        <CardPips owned={selected.owned} deployed={selected.deployed} max={selected.max} />
                    </>
                ) : (
                    <div
                        className="rounded-xl border border-dashed border-gi-border/60 flex items-center justify-center text-center text-[10px] text-gi-muted/70 px-3"
                        style={{ width: cardW, height: cardH }}
                    >
                        Click a card to inspect it
                    </div>
                )}
            </div>
        </div>
    );
};

export default BinderStackPanel;

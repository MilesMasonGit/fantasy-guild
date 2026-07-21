import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { getSlotTokenSummary, SLOT_TOKENS_CHANGED } from '../../../systems/effects/SlotTokens.js';
import { getSlotFailure, SLOT_FAILURES_CHANGED } from '../../../systems/loop/SlotFailures.js';
import { describeTokenEffects } from '../../../config/registries/TokenRegistry.js';

/**
 * CardTokenOverlay — what a stamped Card looks like (§5 / §7 / §12, Phase 9).
 *
 * Two overlays that sit ON the card face rather than in the badge row beneath
 * it, because §5 asks for "small indicator icons directly on their face":
 *
 *   - {@link TokenBadgeStrip}  the Tokens riding this card
 *   - {@link CardFailureStamp} the "FAILED!" mark when a Card produced nothing
 *
 * Tokens are addressed by SLOT, not by card (roadmap F1) — which is exactly why
 * a face-down Upcoming card can show its badges before it is ever drawn (§12's
 * anticipation rule). The same component serves the active card and the
 * Upcoming queue; only the slot index differs.
 */

/** Token category → the same tone vocabulary CardBadges established. */
const TONE = {
    boon:     'border-emerald-400/70 text-emerald-200',
    bane:     'border-rose-400/70 text-rose-200',
    tradeoff: 'border-amber-400/70 text-amber-200'
};

/**
 * Build the §12 tooltip: the mathematical effect AND where it came from.
 * A player staring at a ×7 stack needs to be able to trace every part of it.
 */
function buildTooltip(entry) {
    const { def, count, sources, tokenId } = entry;
    const name = def?.name || tokenId;
    const head = count > 1 ? `${name} ×${count}` : name;

    const effects = describeTokenEffects(def);
    const lines = [head];

    if (effects.length) lines.push(effects.join(' · '));
    if (def?.description) lines.push(def.description);
    if (sources.length) lines.push(`from ${sources.join(', ')}`);
    if (!def) lines.push('(unknown token — its definition is missing)');

    return lines.join('\n');
}

/**
 * Live-updating badges for the Tokens stamped on one deck slot.
 *
 * Identical Tokens condense into a single badge with a numeric count (§7), so a
 * fifty-Token pile stays readable. Re-reads whenever the registry changes —
 * `SlotTokens` is a plain module Map with no reactivity of its own.
 */
export function TokenBadgeStrip({ areaId, slotIndex, className, size = 'md' }) {
    const read = useCallback(
        () => (areaId != null && Number.isInteger(slotIndex))
            ? getSlotTokenSummary(areaId, slotIndex)
            : [],
        [areaId, slotIndex]
    );

    const [summary, setSummary] = useState(read);

    useEffect(() => {
        setSummary(read());
        const unsub = EventBus.subscribe(SLOT_TOKENS_CHANGED, (data) => {
            // A null areaId means "everything was cleared" (save load / reset).
            if (data?.areaId && data.areaId !== areaId) return;
            setSummary(read());
        });
        return unsub;
    }, [areaId, slotIndex, read]);

    if (!summary.length) return null;

    const dim = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-sm';

    return (
        <div
            className={cn(
                'absolute top-1 left-1 z-30 flex flex-wrap gap-1 max-w-[80%] pointer-events-auto',
                className
            )}
            data-testid="token-badge-strip"
        >
            {summary.map(entry => (
                <div
                    key={entry.tokenId}
                    title={buildTooltip(entry)}
                    data-token-id={entry.tokenId}
                    data-token-count={entry.count}
                    className={cn(
                        'relative rounded-full border-2 bg-black/70 backdrop-blur-sm',
                        'flex items-center justify-center leading-none select-none',
                        dim,
                        TONE[entry.def?.category] || 'border-white/40 text-white/80'
                    )}
                >
                    <span aria-hidden="true">{entry.def?.icon || '❔'}</span>

                    {/* §7: identical Tokens condense rather than repeat. */}
                    {entry.count > 1 && (
                        <span
                            className={cn(
                                'absolute -bottom-1 -right-1 px-1 rounded-full',
                                'bg-black border border-white/30 text-white',
                                'text-[9px] font-bold tabular-nums'
                            )}
                        >
                            ×{entry.count}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

/**
 * The "FAILED!" stamp (§12).
 *
 * A failed Card burned its full Work Time and produced nothing, so the player
 * needs to see *that* it failed and *why* — §12 calls this out as the way to
 * diagnose supply-chain bottlenecks at a glance.
 *
 * Reads the mark off the SLOT, not the card: the ephemeral card is discarded
 * the instant it resolves, so a stamp driven by `card.lastFailure` would flash
 * for a single frame and never be seen.
 */
export function SlotFailureStamp({ areaId, slotIndex, className }) {
    const read = useCallback(
        () => (areaId != null && Number.isInteger(slotIndex)) ? getSlotFailure(areaId, slotIndex) : null,
        [areaId, slotIndex]
    );
    const [failure, setFailure] = useState(read);

    useEffect(() => {
        setFailure(read());
        const unsub = EventBus.subscribe(SLOT_FAILURES_CHANGED, (data) => {
            if (data?.areaId && data.areaId !== areaId) return;
            setFailure(read());
        });
        return unsub;
    }, [areaId, slotIndex, read]);

    return <CardFailureStamp failure={failure} className={className} />;
}

/**
 * The stamp itself, given an already-resolved failure.
 * @param {{reason: string, detail?: object}|null} failure
 */
export function CardFailureStamp({ failure, className }) {
    if (!failure) return null;

    const why = failure.reason === 'capacity'
        ? 'The bank has nowhere to put what this card makes.'
        : failure.reason === 'inputs'
            ? 'Not enough materials to work this card.'
            : 'This card could not be completed.';

    return (
        <div
            className={cn(
                'absolute inset-0 z-40 flex items-center justify-center pointer-events-none',
                className
            )}
            title={why}
            data-testid="card-failure-stamp"
            data-failure-reason={failure.reason}
        >
            <div className="absolute inset-0 bg-black/50" />
            <div
                className={cn(
                    '-rotate-12 px-3 py-1 border-4 border-red-500/80 rounded',
                    'text-red-300 font-black uppercase tracking-widest text-pixel-lg',
                    'bg-black/70 shadow-lg'
                )}
            >
                Failed!
            </div>
        </div>
    );
}

export default TokenBadgeStrip;

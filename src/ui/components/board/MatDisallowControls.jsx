import React, { useEffect } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Flags from '../../../systems/board/Flags.js';
import { CAP_EVENTS, useRefreshOn } from './MatCapBadge.jsx';
import {
    useDisallowMode, toggleDisallowMode, setDisallowMode, disallowedCount
} from '../../hooks/useDisallowMode.js';
import { cn } from '../../utils/cn.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** The bar's button look, shared with the Token cap and Upkeep badges. */
const BUTTON_CLS = 'flex items-center gap-1 px-2 py-0.5 rounded border whitespace-nowrap cursor-pointer transition-colors';
const OFF_CLS = 'bg-black/30 border-[#2a1d15] text-amber-100 hover:border-gi-gold/60 hover:text-white';
/** Disallow mode on: red-tinted, as in the owner's mockup. */
const ON_CLS = 'bg-[#791F1F] border-[#E24B4A] text-red-50';

const click = () => EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });

/**
 * ⭐ **Disallow mode toggle** (B2.3, FB-32). On: each click on a Token flips it
 * allowed ⇄ disallowed (FP-35), the mat shows a red dashed edge and a hint,
 * and dragging pauses. Esc or a second press ends it — and so does this
 * button going away with the bar (leaving the playmat for the Guild Hall).
 */
export const DisallowModeToggle = () => {
    const on = useDisallowMode();

    useEffect(() => {
        if (!on) return undefined;
        // CR3-409 (owner: one Escape, one layer): while a drag is live,
        // Escape only cancels it. dnd-kit's own Escape-to-cancel listener
        // attaches at pointerdown, after this one (registered the moment
        // disallow mode turned on), so it always runs AFTER this check — by
        // the time it fires, `gi-dnd-active` is still present here.
        const onKey = (e) => {
            if (e.key === 'Escape' && !document.body.classList.contains('gi-dnd-active')) setDisallowMode(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [on]);

    // Off the playmat, the mode is off: the bar is only drawn there.
    useEffect(() => () => setDisallowMode(false), []);

    return (
        <button
            type="button"
            data-disallow-toggle={on ? 'on' : 'off'}
            aria-pressed={on}
            title={on ? 'Finish disallowing (Esc)' : 'Click Tokens to allow or disallow them'}
            onClick={() => { click(); toggleDisallowMode(); }}
            className={cn(BUTTON_CLS, on ? ON_CLS : OFF_CLS)}
        >
            <span aria-hidden="true">⊘</span>
            <span>Disallow mode{on ? ': on' : ''}</span>
        </button>
    );
};

/**
 * ⭐ **Allow all** (B2.3, FB-32): every disallowed Token on the mat allowed
 * again, at once, no confirm (owner). With none it stays and does nothing. The
 * count is read on the cap badge's events — `Flags.setDisallowed` publishes
 * `TILE_CHANGED` — so it follows a panel switch or a flip in the mode too.
 */
export const AllowAllButton = () => {
    useRefreshOn(CAP_EVENTS);
    const count = disallowedCount();
    return (
        <button
            type="button"
            data-allow-all={count}
            title={count ? 'Let heroes work every Token again' : 'No Token is disallowed'}
            onClick={() => { if (!count) return; click(); Flags.allowAll(); }}
            className={cn(BUTTON_CLS, OFF_CLS)}
        >
            Allow all{count ? ` (${count})` : ''}
        </button>
    );
};

/** The bar's right-hand disallow controls, in order (B2.3). */
export const MatDisallowControls = () => (
    <>
        <DisallowModeToggle />
        <AllowAllButton />
    </>
);

export default MatDisallowControls;

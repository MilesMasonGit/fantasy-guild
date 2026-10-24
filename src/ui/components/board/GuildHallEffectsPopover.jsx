import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getTokenType, tokenName, getAllTokenTypes } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { renderStatement } from '../../../systems/effects/statementText.js';
import { toolNamer } from '../../../systems/effects/toolNames.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { t } from '../../../i18n/index.js';

export const EFFECTS_POPOVER_W = 300;
/** The gap between the Hall star and the popover, and the closest it comes to a window edge. */
const GAP_PX = 12;
const EDGE_PX = 8;
const SCROLL_STEP_PX = 120;

/**
 * Where the popover's top-left goes beside the anchor (the Hall star's box): to its right,
 * centred on it, flipped to its left when the right side has no room, and never off the window.
 * Whole pixels, so the sprites inside stay crisp.
 */
export function effectsPopoverPlace(anchor, width, height, viewW, viewH) {
    let left = anchor.right + GAP_PX;
    if (left + width > viewW - EDGE_PX) left = anchor.left - GAP_PX - width;
    let top = anchor.top + anchor.height / 2 - height / 2;
    left = Math.max(EDGE_PX, Math.min(left, viewW - EDGE_PX - width));
    top = Math.max(EDGE_PX, Math.min(top, viewH - EDGE_PX - height));
    return { left: Math.round(left), top: Math.round(top) };
}

/** The Hall's live outputs and boosts. An upgrade or a load rewrites the Hall's definition. */
function useHallEffects() {
    return useGameState(
        () => {
            const def = getTokenType('token_guild_hall');
            return { outputs: def?.config?.outputs || [], statements: def?.statements || [] };
        },
        [ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, ENGINE_EVENTS.GAME_RESET, BOARD_EVENTS.TOKEN_PLACED]
    );
}

const SectionLabel = ({ children }) => (
    <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{children}</span>
);

const Empty = ({ children }) => <span className="ui-text-body text-gi-muted">{children}</span>;

/** The list itself: outputs as ribbons, boosts as one sentence each. Rows are never boxed. */
export const GuildHallEffectsList = () => {
    const data = useHallEffects();
    const outputs = data?.outputs || [];
    const statements = data?.statements || [];
    const names = {
        token: id => tokenName(id) || id,
        item: id => getItem(id)?.name || id,
        tool: toolNamer(getAllTokenTypes())
    };
    return (
        <div className="flex flex-col gap-3 text-gi-text">
            <div className="flex flex-col gap-1.5">
                <SectionLabel>{t('guildHall.outputs')}</SectionLabel>
                {outputs.length > 0 ? outputs.map((output, idx) => (
                    <EntityRibbon
                        key={`${output.itemId}-${idx}`}
                        kind="item"
                        id={output.itemId}
                        quantity={output.minQty ?? output.quantity ?? 1}
                        chance="100%"
                        size="md"
                    />
                )) : <Empty>{t('guildHall.noOutputs')}</Empty>}
            </div>
            <div className="flex flex-col gap-1.5">
                <SectionLabel>{t('guildHall.boosts')}</SectionLabel>
                {statements.length > 0 ? statements.map((statement, idx) => (
                    <div key={statement.id || `stm-${idx}`} data-hall-effect-statement className="ui-text-body leading-snug">
                        {renderStatement(statement, names)}
                    </div>
                )) : <Empty>{t('guildHall.noBoosts')}</Empty>}
            </div>
        </div>
    );
};

/**
 * The Guild Hall's Effects, floating beside the Hall star: shown while the star is hovered, or
 * pinned open by a click on it. A chamfer frame with a gold title and no header or X, like the
 * other small floating pop-ups. Placed once when it opens (and when the window resizes), never
 * per frame.
 * Only a pinned popover takes the pointer (so its list can scroll); a hovered one lets it through,
 * so it never holds itself open.
 *
 * @param {{ anchorRef: React.RefObject<HTMLElement>, pinned: boolean }} props
 */
export const GuildHallEffectsPopover = ({ anchorRef, pinned, popoverRef }) => {
    const ownRef = useRef(null);
    const boxRef = popoverRef || ownRef;
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        const place = () => {
            const anchor = anchorRef?.current?.getBoundingClientRect?.();
            const box = boxRef.current;
            if (!anchor || !box) return;
            setPos(effectsPopoverPlace(anchor, box.offsetWidth, box.offsetHeight, window.innerWidth, window.innerHeight));
        };
        place();
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, [anchorRef, boxRef]);

    // A load or an upgrade while it is open can change its height: keep it centred on the star.
    useEffect(() => {
        const box = boxRef.current;
        if (!box || typeof ResizeObserver === 'undefined') return undefined;
        let last = null;
        const ro = new ResizeObserver(() => {
            if (box.offsetHeight === last) return;
            last = box.offsetHeight;
            const anchor = anchorRef?.current?.getBoundingClientRect?.();
            if (anchor) setPos(effectsPopoverPlace(anchor, box.offsetWidth, box.offsetHeight, window.innerWidth, window.innerHeight));
        });
        ro.observe(box);
        return () => ro.disconnect();
    }, [anchorRef, boxRef]);

    if (typeof document === 'undefined') return null;
    return createPortal(
        <div
            ref={boxRef}
            role="dialog"
            aria-label={t('guildHall.effectsTitle')}
            data-hall-effects
            data-hall-effects-pinned={pinned ? 'true' : 'false'}
            className={cn('fixed left-0 top-0 z-(--z-mat-tip) select-none', pinned ? 'pointer-events-auto' : 'pointer-events-none')}
            style={{
                width: EFFECTS_POPOVER_W,
                transform: pos ? `translate3d(${pos.left}px, ${pos.top}px, 0)` : 'translate3d(-9999px, -9999px, 0)'
            }}
        >
            <PixelFrame kind={FRAME_KIND.CHAMFER} frameClassName="flex flex-col max-h-[70vh] px-2 py-1.5">
                <div className="shrink-0 pb-1.5 ui-text-title font-bold text-gi-gold">{t('guildHall.effectsTitle')}</div>
                <ArrowScrollList step={SCROLL_STEP_PX} compact className="flex-1 min-h-0">
                    <GuildHallEffectsList />
                </ArrowScrollList>
            </PixelFrame>
        </div>,
        document.body
    );
};

export default GuildHallEffectsPopover;
